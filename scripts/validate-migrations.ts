/**
 * Static validator for supabase/migrations/*.sql. Runs in CI BEFORE build:dev
 * so schema-level RLS/GRANT mistakes fail the pipeline early, without
 * requiring a live database connection.
 *
 * Enforces:
 *   1. Every `CREATE TABLE public.<name>` has, in the SAME migration or an
 *      earlier one, `ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY`
 *      and at least one `GRANT ... ON public.<name>` (or column-scoped grant).
 *   2. No migration re-introduces the retired broad `profiles_seller_read`
 *      policy or grants unrestricted `SELECT ON public.profiles` (only
 *      column-scoped SELECTs are allowed for anon/authenticated).
 *   3. The `public_seller_profiles` view exists in the migration history
 *      (buyer-facing seller-card endpoint).
 *
 * Exits 1 on the first violation.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

let errors = 0;
const fail = (msg: string) => {
  errors += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

// Aggregate SQL across all migrations in order — later migrations can enable
// RLS or add grants for tables created earlier.
const all = files.map((f) => ({ f, sql: readFileSync(join(DIR, f), "utf8") }));
const combined = all.map((m) => m.sql).join("\n");

// --- 1. CREATE TABLE public.X requires RLS + GRANT somewhere in history ----
console.log("[1] every public table has RLS enabled + a GRANT");
const created = new Set<string>();
for (const { f, sql } of all) {
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const name = m[1].toLowerCase();
    if (created.has(name)) continue;
    created.add(name);
    const hasRls = new RegExp(
      `alter\\s+table\\s+(?:public\\.)?${name}\\s+enable\\s+row\\s+level\\s+security`,
      "i",
    ).test(combined);
    const hasGrant = new RegExp(
      `grant\\s+[^;]+\\s+on\\s+(?:table\\s+)?public\\.${name}\\b`,
      "i",
    ).test(combined);
    if (!hasRls) fail(`table public.${name} (from ${f}) never gets ENABLE ROW LEVEL SECURITY`);
    if (!hasGrant) fail(`table public.${name} (from ${f}) never gets a GRANT`);
    if (hasRls && hasGrant) ok(`public.${name}: RLS + GRANT present`);
  }
}

// --- 2. Retired policies / grants must not come back (NET final state) ------
// Replay migrations in order and track whether a forbidden pattern is
// currently active. Later DROP/REVOKE cancels an earlier CREATE/GRANT with
// the same shape.
console.log("\n[2] retired broad profile-read patterns stay gone (net state)");
let sellerReadPolicyActive = 0;
let rowLevelProfilesGrantActive = 0;
for (const { sql } of all) {
  // policy profiles_seller_read
  const creates = (sql.match(/create\s+policy\s+profiles_seller_read\b/gi) || []).length;
  const drops = (sql.match(/drop\s+policy\s+(?:if\s+exists\s+)?profiles_seller_read\b/gi) || []).length;
  sellerReadPolicyActive += creates - drops;

  // row-level (non-column-scoped) GRANT SELECT ON public.profiles TO anon/authenticated
  const grantRe =
    /grant\s+([a-z, ]*\bselect\b[a-z, ]*)\s+on\s+(?:table\s+)?public\.profiles\s+to\s+([^;]+);/gi;
  let g: RegExpExecArray | null;
  while ((g = grantRe.exec(sql))) {
    const isColumnScoped = /\bselect\s*\(/i.test(g[0]);
    if (!isColumnScoped && /(anon|authenticated)/i.test(g[2])) rowLevelProfilesGrantActive += 1;
  }
  const revokeRe =
    /revoke\s+(?:[a-z, ]*\bselect\b[a-z, ]*|all(?:\s+privileges)?)\s+on\s+(?:table\s+)?public\.profiles\s+from\s+([^;]+);/gi;
  let r: RegExpExecArray | null;
  while ((r = revokeRe.exec(sql))) {
    if (/(anon|authenticated)/i.test(r[1])) rowLevelProfilesGrantActive = 0;
  }
}
if (sellerReadPolicyActive > 0) fail("policy profiles_seller_read is currently active — must stay dropped");
else ok("policy profiles_seller_read is not active");
if (rowLevelProfilesGrantActive > 0) fail("row-level GRANT SELECT ON public.profiles to anon/authenticated is currently active — must be column-scoped");
else ok("no row-level GRANT SELECT ON public.profiles to anon/authenticated is active");

// --- 3. public_seller_profiles view is present ------------------------------
console.log("\n[3] public_seller_profiles view is defined");
if (/create\s+(?:or\s+replace\s+)?view\s+public\.public_seller_profiles\b/i.test(combined)) {
  ok("public_seller_profiles view found in migration history");
} else {
  fail("public_seller_profiles view missing from migration history");
}

if (errors > 0) {
  console.error(`\n${errors} migration validation error(s)`);
  process.exit(1);
}
console.log("\nMigration validation passed.");