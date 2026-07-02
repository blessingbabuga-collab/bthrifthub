/**
 * End-to-end test: signs a buyer in through the real /auth UI, then verifies
 * that from inside the running app they can only see seller profiles that
 * have at least one active listing — through the live client, hitting the
 * real API/RLS boundary (`public_seller_profiles` view + `profiles` table).
 *
 * Requires:
 *   - dev server running on http://localhost:8080
 *   - SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY env
 *
 * Run:  bun scripts/e2e-buyer-visibility.ts
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.E2E_BASE_URL ?? "http://localhost:8080";

if (!URL || !ANON || !SERVICE) {
  console.error("[skip] e2e requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(0);
}

const tag = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const PASSWORD = "Test!" + Math.random().toString(36).slice(2, 10) + "Aa1";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

type P = "active" | "inactive" | "buyer";
const ids: Record<P, string> = {} as Record<P, string>;
const emails: Record<P, string> = {} as Record<P, string>;
let failures = 0;
const assert = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures += 1; console.error(`  ✗ ${msg}`); }
};

async function seed() {
  for (const persona of ["active", "inactive", "buyer"] as P[]) {
    const email = `${tag}_${persona}@example.test`;
    emails[persona] = email;
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { username: `${tag}_${persona}` },
    });
    if (error || !data.user) throw new Error(`create ${persona}: ${error?.message}`);
    ids[persona] = data.user.id;
    await admin.from("profiles").upsert(
      { id: data.user.id, username: `${tag}_${persona}`, full_name: persona },
      { onConflict: "id" },
    );
  }
  await admin.from("products").insert([
    { seller_id: ids.active, title: `${tag} active`, price: 1000, image_url: "https://example.test/x.jpg", category: "Streetwear", status: "active" },
    { seller_id: ids.inactive, title: `${tag} sold`, price: 1000, image_url: "https://example.test/x.jpg", category: "Streetwear", status: "sold" },
  ]);
}

async function teardown() {
  for (const p of ["active", "inactive", "buyer"] as P[]) {
    if (ids[p]) await admin.auth.admin.deleteUser(ids[p]).catch(() => {});
  }
}

async function main() {
  await seed();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const page = await context.new_page ? (await (context as unknown as { new_page: () => Promise<import("playwright").Page> }).new_page()) : await context.newPage();

  try {
    // 1. Sign the buyer in through the real /auth UI
    await page.goto(`${APP}/auth`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill(emails.buyer);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 15_000 }).catch(() => {}),
      page.getByRole("button", { name: /sign in/i }).click(),
    ]);

    // Confirm we're signed in as the buyer via the running client
    const signedInAs = await page.evaluate(async () => {
      const mod = await import("/src/integrations/supabase/client.ts");
      const { data } = await mod.supabase.auth.getUser();
      return data.user?.email ?? null;
    });
    assert(signedInAs === emails.buyer, `buyer session live in the app (as ${signedInAs})`);

    // 2. Query the buyer-facing seller endpoint from inside the running app.
    //    This exercises the real client + real network + real RLS/view.
    const result = await page.evaluate(async (payload) => {
      const mod = await import("/src/integrations/supabase/client.ts");
      const s = mod.supabase;
      const single = await s.from("public_seller_profiles").select("id, username").in("id", payload.all);
      const search = await s.from("public_seller_profiles").select("id, username").ilike("username", `${payload.tag}_%`);
      const activeDirect = await s.from("public_seller_profiles").select("id").eq("id", payload.activeId).maybeSingle();
      const inactiveDirect = await s.from("public_seller_profiles").select("id").eq("id", payload.inactiveId).maybeSingle();
      return {
        bulk: (single.data ?? []).map((r: { id: string }) => r.id),
        search: (search.data ?? []).map((r: { id: string }) => r.id),
        activeVisible: activeDirect.data?.id === payload.activeId,
        inactiveVisible: inactiveDirect.data != null,
      };
    }, { all: [ids.active, ids.inactive, ids.buyer], tag, activeId: ids.active, inactiveId: ids.inactive });

    assert(result.activeVisible, "active seller visible via app client");
    assert(!result.inactiveVisible, "inactive-only seller HIDDEN via app client");
    assert(result.bulk.includes(ids.active), "bulk .in() from app includes active seller");
    assert(!result.bulk.includes(ids.inactive), "bulk .in() from app EXCLUDES inactive seller");
    assert(!result.bulk.includes(ids.buyer), "bulk .in() from app EXCLUDES buyer");
    assert(result.search.includes(ids.active), "search from app includes active seller");
    assert(!result.search.includes(ids.inactive), "search from app EXCLUDES inactive seller");

    await page.screenshot({ path: "/tmp/browser/e2e-buyer-visibility.png" }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main()
  .catch((e) => { failures += 1; console.error("Unhandled:", e); })
  .finally(async () => {
    await teardown();
    if (failures > 0) { console.error(`\n${failures} e2e assertion(s) failed`); process.exit(1); }
    console.log("\nAll buyer-visibility E2E assertions passed.");
    process.exit(0);
  });