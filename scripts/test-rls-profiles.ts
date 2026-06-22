/**
 * Automated RLS tests for `public.profiles`.
 *
 * Verifies the policies installed by the "tighten profiles SELECT" migration:
 *   - profiles_self_read     : a signed-in user can always read their own row
 *   - profiles_seller_read   : anon + authenticated can only read profiles
 *                              of users who have at least one ACTIVE product
 *
 * Run locally / in CI:
 *   SUPABASE_URL=...                 \
 *   SUPABASE_PUBLISHABLE_KEY=...     \
 *   SUPABASE_SERVICE_ROLE_KEY=...    \
 *     bun scripts/test-rls-profiles.ts
 *
 * The script:
 *   1. Uses the service-role key to create 4 throw-away auth users + profiles
 *      + products (one active seller, one inactive-only seller, one buyer,
 *      one viewer).
 *   2. Runs SELECTs as anon and as each signed-in user via the publishable key.
 *   3. Asserts visibility rules.
 *   4. ALWAYS deletes the test users (cascade clears profiles + products),
 *      even on failure.
 *
 * Exits with code 1 on the first failed assertion.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error(
    "[skip] RLS tests require SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(0);
}

const tag = `rlstest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = "Test!" + Math.random().toString(36).slice(2, 12) + "Aa1";

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Persona =
  | "active_seller"        // 1 active listing
  | "inactive_seller"      // 1 sold listing
  | "mixed_seller"         // 2 active + 2 inactive listings
  | "many_inactive_seller" // 3 inactive listings, 0 active
  | "buyer"
  | "viewer";
const personas: Persona[] = [
  "active_seller",
  "inactive_seller",
  "mixed_seller",
  "many_inactive_seller",
  "buyer",
  "viewer",
];
const ids: Record<Persona, string> = {} as Record<Persona, string>;
const emails: Record<Persona, string> = {} as Record<Persona, string>;

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${msg}`);
  }
}

function anonClient(): SupabaseClient {
  return createClient(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedInClient(persona: Persona): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: emails[persona],
    password: PASSWORD,
  });
  if (error) throw new Error(`sign-in as ${persona} failed: ${error.message}`);
  return client;
}

async function visible(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client.from("profiles").select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(`select profile failed: ${error.message}`);
  return data?.id === id;
}

async function setup() {
  console.log(`Seeding test users (tag=${tag})`);
  for (const persona of personas) {
    const email = `${tag}_${persona}@example.test`;
    emails[persona] = email;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { username: `${tag}_${persona}` },
    });
    if (error || !data.user) throw new Error(`create ${persona} failed: ${error?.message}`);
    ids[persona] = data.user.id;

    // handle_new_user trigger inserts a profile row; ensure it exists.
    await admin
      .from("profiles")
      .upsert({ id: data.user.id, username: `${tag}_${persona}`, full_name: persona }, { onConflict: "id" });
  }

  // active_seller: one ACTIVE product
  await admin.from("products").insert({
    seller_id: ids.active_seller,
    title: `${tag} active`,
    price: 1000,
    image_url: "https://example.test/x.jpg",
    category: "Streetwear",
    status: "active",
  });
  // inactive_seller: one non-active product only
  await admin.from("products").insert({
    seller_id: ids.inactive_seller,
    title: `${tag} sold`,
    price: 1000,
    image_url: "https://example.test/x.jpg",
    category: "Streetwear",
    status: "sold",
  });

  // mixed_seller: 2 active + 2 inactive listings
  await admin.from("products").insert([
    { seller_id: ids.mixed_seller, title: `${tag} mix a1`, price: 1000, image_url: "https://example.test/x.jpg", category: "Streetwear", status: "active" },
    { seller_id: ids.mixed_seller, title: `${tag} mix a2`, price: 1000, image_url: "https://example.test/x.jpg", category: "Streetwear", status: "active" },
    { seller_id: ids.mixed_seller, title: `${tag} mix s1`, price: 1000, image_url: "https://example.test/x.jpg", category: "Streetwear", status: "sold" },
    { seller_id: ids.mixed_seller, title: `${tag} mix d1`, price: 1000, image_url: "https://example.test/x.jpg", category: "Streetwear", status: "draft" },
  ]);

  // many_inactive_seller: 3 non-active listings, 0 active
  await admin.from("products").insert([
    { seller_id: ids.many_inactive_seller, title: `${tag} mi 1`, price: 1000, image_url: "https://example.test/x.jpg", category: "Streetwear", status: "sold" },
    { seller_id: ids.many_inactive_seller, title: `${tag} mi 2`, price: 1000, image_url: "https://example.test/x.jpg", category: "Streetwear", status: "draft" },
    { seller_id: ids.many_inactive_seller, title: `${tag} mi 3`, price: 1000, image_url: "https://example.test/x.jpg", category: "Streetwear", status: "archived" },
  ]);
}

async function teardown() {
  for (const persona of personas) {
    if (ids[persona]) {
      await admin.auth.admin.deleteUser(ids[persona]).catch(() => {});
    }
  }
}

async function run() {
  await setup();

  console.log("\n[1] anon visitor");
  {
    const c = anonClient();
    assert(await visible(c, ids.active_seller),       "sees seller with active listing");
    assert(!(await visible(c, ids.inactive_seller)), "does NOT see seller whose only listing is inactive");
    assert(!(await visible(c, ids.buyer)),           "does NOT see buyer (no listings)");
    assert(!(await visible(c, ids.viewer)),          "does NOT see viewer (no listings)");
    assert(await visible(c, ids.mixed_seller),       "sees seller with mixed active + inactive listings");
    assert(!(await visible(c, ids.many_inactive_seller)), "does NOT see seller with multiple inactive listings and no active ones");
  }

  console.log("\n[2] authenticated viewer (no listings)");
  {
    const c = await signedInClient("viewer");
    assert(await visible(c, ids.viewer),              "reads own profile");
    assert(await visible(c, ids.active_seller),       "sees seller with active listing");
    assert(!(await visible(c, ids.inactive_seller)), "does NOT see inactive-only seller");
    assert(!(await visible(c, ids.buyer)),           "does NOT see unrelated buyer");
    assert(await visible(c, ids.mixed_seller),       "sees mixed seller (≥1 active listing)");
    assert(!(await visible(c, ids.many_inactive_seller)), "does NOT see seller with multiple inactive listings only");
  }

  console.log("\n[3] authenticated inactive-only seller");
  {
    const c = await signedInClient("inactive_seller");
    assert(await visible(c, ids.inactive_seller), "still reads OWN profile despite having no active listings");
  }

  console.log("\n[4] listing transition: active -> sold hides the seller");
  {
    await admin.from("products").update({ status: "sold" }).eq("seller_id", ids.active_seller);
    const c = anonClient();
    assert(!(await visible(c, ids.active_seller)), "seller profile is hidden once they have no active listings");

    // restore so the next assertion is meaningful
    await admin.from("products").update({ status: "active" }).eq("seller_id", ids.active_seller);
    assert(await visible(c, ids.active_seller),   "seller profile is visible again after re-activating a listing");
  }

  console.log("\n[5] mixed seller: deactivating ONE of several active listings does not hide them");
  {
    // Sanity: mixed_seller starts with 2 active listings
    const c = anonClient();
    assert(await visible(c, ids.mixed_seller), "mixed seller is visible at baseline (2 active listings)");

    // Mark one active listing as sold — one active still remains
    const { data: actives } = await admin
      .from("products")
      .select("id")
      .eq("seller_id", ids.mixed_seller)
      .eq("status", "active");
    const firstActiveId = actives?.[0]?.id;
    assert(!!firstActiveId, "found an active listing to deactivate");
    if (firstActiveId) {
      await admin.from("products").update({ status: "sold" }).eq("id", firstActiveId);
      assert(await visible(c, ids.mixed_seller), "mixed seller still visible while ≥1 active listing remains");

      // Deactivate the remaining active listing -> seller must disappear
      await admin
        .from("products")
        .update({ status: "sold" })
        .eq("seller_id", ids.mixed_seller)
        .eq("status", "active");
      assert(!(await visible(c, ids.mixed_seller)), "mixed seller hidden once ALL listings are inactive");
    }
  }

  console.log("\n[6] many-inactive seller becomes visible after adding an active listing");
  {
    const c = anonClient();
    assert(!(await visible(c, ids.many_inactive_seller)), "still hidden with only inactive listings");
    await admin.from("products").insert({
      seller_id: ids.many_inactive_seller,
      title: `${tag} mi newly-active`,
      price: 1000,
      image_url: "https://example.test/x.jpg",
      category: "Streetwear",
      status: "active",
    });
    assert(await visible(c, ids.many_inactive_seller), "becomes visible once a single active listing is added");
  }
}

run()
  .catch((err) => {
    failures += 1;
    console.error("Unhandled error:", err);
  })
  .finally(async () => {
    await teardown();
    if (failures > 0) {
      console.error(`\n${failures} RLS assertion(s) failed`);
      process.exit(1);
    }
    console.log("\nAll profiles RLS assertions passed.");
    process.exit(0);
  });