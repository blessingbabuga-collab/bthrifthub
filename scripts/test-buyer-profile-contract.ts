/**
 * API contract tests for buyer-facing seller-profile endpoints.
 *
 * The buyer app reads seller cards through:
 *   - public.public_seller_profiles     (view — canonical read path)
 *   - public.profiles                   (column-scoped fallback via product joins)
 *
 * This suite seeds a controlled set of sellers/buyers and asserts that
 * EVERY shape of buyer query (single lookup, bulk `.in(...)`, `.ilike(...)`
 * search) transparently applies the "seller has ≥1 active listing" filter.
 * If a code path forgets the filter or grants too much, this suite fails.
 *
 * Run:  bun scripts/test-buyer-profile-contract.ts
 * Env:  SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error(
    "[skip] buyer-profile contract tests require SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(0);
}

const tag = `bcontract_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = "Test!" + Math.random().toString(36).slice(2, 12) + "Aa1";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

type P = "active" | "inactive" | "buyer";
const ids: Record<P, string> = {} as Record<P, string>;
let failures = 0;
const assert = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures += 1; console.error(`  ✗ ${msg}`); }
};

const anon = (): SupabaseClient =>
  createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });

async function seed() {
  for (const persona of ["active", "inactive", "buyer"] as P[]) {
    const email = `${tag}_${persona}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { username: `${tag}_${persona}` },
    });
    if (error || !data.user) throw new Error(`create ${persona}: ${error?.message}`);
    ids[persona] = data.user.id;
    await admin.from("profiles").upsert(
      { id: data.user.id, username: `${tag}_${persona}`, full_name: persona, bio: "hidden-bio" },
      { onConflict: "id" },
    );
  }
  await admin.from("products").insert([
    { seller_id: ids.active, title: `${tag} a`, price: 1, image_url: "x", category: "c", status: "active" },
    { seller_id: ids.inactive, title: `${tag} i`, price: 1, image_url: "x", category: "c", status: "sold" },
  ]);
}

async function teardown() {
  for (const p of ["active", "inactive", "buyer"] as P[]) {
    if (ids[p]) await admin.auth.admin.deleteUser(ids[p]).catch(() => {});
  }
}

async function run() {
  await seed();
  const c = anon();
  const all3 = [ids.active, ids.inactive, ids.buyer];

  console.log("[view] public_seller_profiles — single lookup applies the filter");
  {
    const { data: a } = await c.from("public_seller_profiles").select("id, username, avatar_url").eq("id", ids.active).maybeSingle();
    assert(a?.id === ids.active, "active seller visible via view");
    const { data: i } = await c.from("public_seller_profiles").select("id").eq("id", ids.inactive).maybeSingle();
    assert(i == null, "inactive-only seller HIDDEN via view");
    const { data: b } = await c.from("public_seller_profiles").select("id").eq("id", ids.buyer).maybeSingle();
    assert(b == null, "buyer HIDDEN via view");
  }

  console.log("\n[view] public_seller_profiles — bulk .in() applies the filter");
  {
    const { data, error } = await c.from("public_seller_profiles").select("id").in("id", all3);
    assert(!error, "bulk .in() succeeds without error");
    const s = new Set((data ?? []).map((r) => r.id));
    assert(s.size === 1 && s.has(ids.active), `bulk returns ONLY the active seller (got ${s.size})`);
    assert(!s.has(ids.inactive) && !s.has(ids.buyer), "bulk does NOT leak hidden ids");
  }

  console.log("\n[view] public_seller_profiles — username .ilike() search applies the filter");
  {
    const { data } = await c.from("public_seller_profiles").select("id, username").ilike("username", `${tag}_%`);
    const s = new Set((data ?? []).map((r) => r.id));
    assert(s.has(ids.active), "search reveals active seller");
    assert(!s.has(ids.inactive), "search does NOT reveal inactive-only seller");
    assert(!s.has(ids.buyer), "search does NOT reveal buyer");
  }

  console.log("\n[view] public_seller_profiles — only id/username/avatar_url are exposed");
  {
    // Selecting a column not in the view must error, not silently return sensitive data.
    const { data, error } = await c.from("public_seller_profiles").select("id, bio").eq("id", ids.active).maybeSingle();
    assert(error != null || !(data as unknown as { bio?: string })?.bio, "view does not expose bio column");
  }

  console.log("\n[table] public.profiles — column-scoped grant still enforces filter for buyers");
  {
    // Buyer-side fallback paths use profiles directly (e.g. seller badge join).
    // RLS must still hide inactive-only sellers even when queried through the
    // raw table with the column-scoped grant.
    const { data } = await c.from("profiles").select("id, username, avatar_url").in("id", all3);
    const s = new Set((data ?? []).map((r) => r.id));
    assert(s.size === 1 && s.has(ids.active), "profiles table bulk read returns ONLY active seller");
    // And requesting a non-granted column must be denied (no silent bio leak).
    const { data: bioAttempt, error: bioErr } = await c.from("profiles").select("id, bio").eq("id", ids.active).maybeSingle();
    const leaked = (bioAttempt as unknown as { bio?: string } | null)?.bio;
    assert(bioErr != null || !leaked, "column-scoped grant blocks bio read for buyers");
  }

  console.log("\n[view] public_seller_profiles — ordered pagination never leaks inactive sellers");
  {
    // Simulate the buyer "sellers directory" pattern: order + range paging.
    const seen = new Set<string>();
    const PAGE = 1; // small pages force many boundaries
    for (let from = 0; from < 20; from += PAGE) {
      const { data, error } = await c
        .from("public_seller_profiles")
        .select("id, username")
        .ilike("username", `${tag}_%`)
        .order("username", { ascending: true })
        .range(from, from + PAGE - 1);
      assert(!error, `page[${from}] succeeds`);
      if (!data || data.length === 0) break;
      for (const r of data) seen.add(r.id);
    }
    assert(seen.has(ids.active), "pagination reveals active seller");
    assert(!seen.has(ids.inactive), "pagination does NOT leak inactive-only seller");
    assert(!seen.has(ids.buyer), "pagination does NOT leak buyer");
  }

  console.log("\n[view] public_seller_profiles — bulk fetch of many ids stays filtered");
  {
    // Emulate a bulk-hydration pattern (e.g. hydrating seller badges for a
    // page of products). Even when the caller asks for a big id set that
    // includes hidden ones, only the active seller may come back.
    const many = [ids.active, ids.inactive, ids.buyer, ids.active, ids.inactive];
    const { data } = await c.from("public_seller_profiles").select("id").in("id", many);
    const s = new Set((data ?? []).map((r) => r.id));
    assert(s.size === 1 && s.has(ids.active), "bulk hydrate returns ONLY active seller");
  }
}

run()
  .catch((e) => { failures += 1; console.error("Unhandled:", e); })
  .finally(async () => {
    await teardown();
    if (failures > 0) { console.error(`\n${failures} contract assertion(s) failed`); process.exit(1); }
    console.log("\nAll buyer-profile contract assertions passed.");
    process.exit(0);
  });