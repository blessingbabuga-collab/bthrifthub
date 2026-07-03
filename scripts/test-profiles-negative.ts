/**
 * Negative API tests for buyer-facing profile access.
 *
 * Asserts that as an anonymous OR signed-in NON-owner viewer:
 *   - Profiles of sellers with NO active listing are invisible via every
 *     read path (single, bulk .in(), .ilike() search, order+range pagination).
 *   - Sensitive columns (bio, location, full_name, phone) cannot be
 *     sideloaded via raw `profiles` reads or product embeds — the
 *     column-scoped grant + view scope enforce this.
 *   - Pagination (`.range()` + `.order()`) over the search-scoped view
 *     never surfaces an inactive-only seller, even at page boundaries.
 *
 * Run: bun scripts/test-profiles-negative.ts
 * Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error(
    "[skip] profile negative tests require SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(0);
}

const tag = `pneg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = "Test!" + Math.random().toString(36).slice(2, 12) + "Aa1";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = (): SupabaseClient =>
  createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
const assert = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures += 1; console.error(`  ✗ ${msg}`); }
};

type P = "active" | "sold_only" | "draft_only" | "no_listings" | "viewer";
const ids: Record<P, string> = {} as Record<P, string>;
const productIds: Record<string, string> = {};

// Fields that must NEVER be reachable from a non-owner read path.
const SENSITIVE = ["bio", "location", "full_name", "phone", "updated_at"] as const;

async function seed() {
  for (const persona of ["active", "sold_only", "draft_only", "no_listings", "viewer"] as P[]) {
    const email = `${tag}_${persona}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { username: `${tag}_${persona}` },
    });
    if (error || !data.user) throw new Error(`create ${persona}: ${error?.message}`);
    ids[persona] = data.user.id;
    await admin.from("profiles").upsert({
      id: data.user.id,
      username: `${tag}_${persona}`,
      full_name: `full-${persona}`,
      bio: `secret-bio-${persona}`,
      location: `secret-loc-${persona}`,
    }, { onConflict: "id" });
  }
  const { data: rows, error } = await admin.from("products").insert([
    { seller_id: ids.active,      title: `${tag} A1`, price: 100, image_url: "x", category: "c", status: "active" },
    { seller_id: ids.active,      title: `${tag} A2`, price: 100, image_url: "x", category: "c", status: "active" },
    { seller_id: ids.sold_only,   title: `${tag} S1`, price: 100, image_url: "x", category: "c", status: "sold" },
    { seller_id: ids.draft_only,  title: `${tag} D1`, price: 100, image_url: "x", category: "c", status: "draft" },
  ]).select("id, seller_id, status");
  if (error) throw error;
  for (const r of rows ?? []) productIds[`${r.seller_id}:${r.status}`] = r.id;
}

async function teardown() {
  for (const p of ["active", "sold_only", "draft_only", "no_listings", "viewer"] as P[]) {
    if (ids[p]) await admin.auth.admin.deleteUser(ids[p]).catch(() => {});
  }
}

async function signIn(email: string) {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

async function run() {
  await seed();

  console.log("[anon] inactive-only sellers invisible on every read path");
  {
    const c = anon();
    const hidden = [ids.sold_only, ids.draft_only, ids.no_listings];
    for (const id of hidden) {
      const { data } = await c.from("profiles").select("id").eq("id", id).maybeSingle();
      assert(data == null, `profiles single lookup hides ${id}`);
      const { data: v } = await c.from("public_seller_profiles").select("id").eq("id", id).maybeSingle();
      assert(v == null, `view single lookup hides ${id}`);
    }
    const { data: bulk } = await c.from("profiles").select("id").in("id", hidden);
    assert((bulk ?? []).length === 0, "profiles bulk .in() returns 0 hidden rows");
    const { data: vbulk } = await c.from("public_seller_profiles").select("id").in("id", hidden);
    assert((vbulk ?? []).length === 0, "view bulk .in() returns 0 hidden rows");
    const { data: search } = await c.from("public_seller_profiles").select("id, username").ilike("username", `${tag}_%`);
    const s = new Set((search ?? []).map((r) => r.id));
    assert(s.has(ids.active), "search reveals active seller");
    for (const id of hidden) assert(!s.has(id), `search does NOT leak ${id}`);
  }

  console.log("\n[anon] sensitive columns cannot be sideloaded");
  {
    const c = anon();
    for (const col of SENSITIVE) {
      const { data, error } = await c.from("profiles").select(`id, ${col}`).eq("id", ids.active).maybeSingle();
      const leaked = (data as Record<string, unknown> | null)?.[col];
      assert(error != null || leaked == null || leaked === "",
        `profiles column '${col}' not exposed to anon (err=${!!error}, val=${JSON.stringify(leaked)})`);
    }
    // Sideload via product join must also not expose sensitive columns.
    const { data: joined, error: jerr } = await c
      .from("products")
      .select("id, seller:profiles(id, bio, location, full_name)")
      .eq("seller_id", ids.active)
      .limit(1);
    const first = (joined ?? [])[0] as { seller?: Record<string, unknown> | null } | undefined;
    const seller = first?.seller ?? null;
    const anyLeak = seller && ["bio", "location", "full_name"].some((k) => {
      const v = seller[k];
      return typeof v === "string" && v.length > 0;
    });
    assert(jerr != null || !anyLeak, "product→profiles embed does not sideload sensitive columns");
  }

  console.log("\n[viewer] signed-in non-owner has no extra visibility");
  {
    const c = await signIn(`${tag}_viewer@example.test`);
    const hidden = [ids.sold_only, ids.draft_only, ids.no_listings];
    const { data: bulk } = await c.from("profiles").select("id").in("id", hidden);
    assert((bulk ?? []).length === 0, "viewer profiles bulk .in() returns 0 hidden rows");
    for (const col of SENSITIVE) {
      const { data, error } = await c.from("profiles").select(`id, ${col}`).eq("id", ids.active).maybeSingle();
      const leaked = (data as Record<string, unknown> | null)?.[col];
      assert(error != null || leaked == null || leaked === "",
        `viewer cannot read other user's '${col}'`);
    }
  }

  console.log("\n[pagination] .order+.range never leaks inactive sellers");
  {
    const c = anon();
    const seen = new Set<string>();
    const PAGE = 2;
    for (let from = 0; from < 20; from += PAGE) {
      const { data, error } = await c
        .from("public_seller_profiles")
        .select("id, username")
        .ilike("username", `${tag}_%`)
        .order("username", { ascending: true })
        .range(from, from + PAGE - 1);
      assert(!error, `pagination page ${from} succeeds`);
      if (!data || data.length === 0) break;
      for (const r of data) seen.add(r.id);
    }
    assert(seen.has(ids.active), "pagination surfaces active seller");
    for (const hid of [ids.sold_only, ids.draft_only, ids.no_listings, ids.viewer]) {
      assert(!seen.has(hid), `pagination does NOT leak ${hid}`);
    }
  }
}

run()
  .catch((e) => { failures += 1; console.error("Unhandled:", e); })
  .finally(async () => {
    await teardown();
    if (failures > 0) { console.error(`\n${failures} negative-profile assertion(s) failed`); process.exit(1); }
    console.log("\nAll negative-profile assertions passed.");
    process.exit(0);
  });