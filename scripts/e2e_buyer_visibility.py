"""
End-to-end test: sign in as a buyer through the real /auth UI and verify
that from inside the running app the buyer can only view seller profiles
that have at least one active listing — through the real API/RLS boundary
(`public_seller_profiles` view + `profiles` table).

Requires:
  - dev server running on http://localhost:8080 (or E2E_BASE_URL)
  - SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY env
  - Python 3 + playwright + requests (pre-installed in the sandbox)

Run:  bun run test:e2e   (or)   python3 scripts/e2e_buyer_visibility.py
"""
import asyncio
import json
import os
import random
import string
import sys
import time
import urllib.request

URL = os.environ.get("SUPABASE_URL")
ANON = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
SERVICE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
APP = os.environ.get("E2E_BASE_URL", "http://localhost:8080")

if not (URL and ANON and SERVICE):
    print("[skip] e2e requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(0)

TAG = f"e2e_{int(time.time())}_{''.join(random.choices(string.ascii_lowercase + string.digits, k=6))}"
PASSWORD = "Test!" + "".join(random.choices(string.ascii_letters + string.digits, k=10)) + "Aa1"

failures = 0
def check(cond: bool, msg: str) -> None:
    global failures
    if cond:
        print(f"  ✓ {msg}")
    else:
        failures += 1
        print(f"  ✗ {msg}", file=sys.stderr)


def _admin(path: str, method: str = "POST", body: dict | None = None, extra_headers: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{URL}{path}",
        method=method,
        headers={
            "apikey": SERVICE,
            "Authorization": f"Bearer {SERVICE}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
            **(extra_headers or {}),
        },
        data=None if body is None else json.dumps(body).encode(),
    )
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode(errors='ignore')}") from None


ids: dict[str, str] = {}
emails: dict[str, str] = {}

def seed() -> None:
    for persona in ("active", "inactive", "buyer"):
        email = f"{TAG}_{persona}@example.test"
        emails[persona] = email
        u = _admin("/auth/v1/admin/users", "POST", {
            "email": email, "password": PASSWORD, "email_confirm": True,
            "user_metadata": {"username": f"{TAG}_{persona}"},
        })
        uid = u.get("id") or u.get("user", {}).get("id")
        assert uid, f"no id for {persona}: {u}"
        ids[persona] = uid
        # handle_new_user trigger already inserted the profile; upsert to
        # normalize username/full_name for this test run.
        _admin(
            "/rest/v1/profiles?on_conflict=id",
            "POST",
            {"id": uid, "username": f"{TAG}_{persona}", "full_name": persona},
            extra_headers={"Prefer": "return=representation,resolution=merge-duplicates"},
        )
    _admin("/rest/v1/products", "POST", [
        {"seller_id": ids["active"], "title": f"{TAG} active", "price": 1000, "image_url": "https://example.test/x.jpg", "category": "Streetwear", "status": "active"},
        {"seller_id": ids["inactive"], "title": f"{TAG} sold", "price": 1000, "image_url": "https://example.test/x.jpg", "category": "Streetwear", "status": "sold"},
    ])

def teardown() -> None:
    for persona in ("active", "inactive", "buyer"):
        uid = ids.get(persona)
        if not uid:
            continue
        try:
            _admin(f"/auth/v1/admin/users/{uid}", "DELETE")
        except Exception:
            pass


async def run_browser() -> None:
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # 1. Sign in as the buyer through the real /auth UI.
        await page.goto(f"{APP}/auth", wait_until="networkidle")
        # The dev error overlay can intercept clicks after a hydration warning; hide it.
        await page.add_style_tag(content="#__lv_err_overlay{display:none!important;pointer-events:none!important;}")
        await page.locator('input[type="email"]').fill(emails["buyer"])
        await page.locator('input[type="password"]').fill(PASSWORD)
        async with page.expect_response(
            lambda r: "/auth/v1/token" in r.url and r.request.method == "POST",
            timeout=15000,
        ) as resp_info:
            await page.get_by_role("button", name="Sign in").click()
        token_resp = await resp_info.value
        check(token_resp.status == 200, f"POST /auth/v1/token succeeded ({token_resp.status})")

        # 2. Ask the running app's Supabase client who we are.
        signed_in_as = await page.evaluate(
            """async () => {
                const mod = await import('/src/integrations/supabase/client.ts');
                const s = mod.supabase;
                // Wait briefly for session hydration after the click.
                for (let i = 0; i < 20; i++) {
                    const { data } = await s.auth.getSession();
                    if (data.session?.user?.email) return data.session.user.email;
                    await new Promise((r) => setTimeout(r, 100));
                }
                const { data } = await s.auth.getUser();
                return data.user?.email ?? null;
            }"""
        )
        check(signed_in_as == emails["buyer"], f"live session identifies buyer ({signed_in_as})")

        # 3. Run the buyer-facing seller-profile queries INSIDE the app
        #    (real client + real network + real RLS/view boundary).
        payload = {
            "all": [ids["active"], ids["inactive"], ids["buyer"]],
            "activeId": ids["active"],
            "inactiveId": ids["inactive"],
            "tag": TAG,
        }
        result = await page.evaluate(
            """async (p) => {
                const mod = await import('/src/integrations/supabase/client.ts');
                const s = mod.supabase;
                const bulk = await s.from('public_seller_profiles').select('id, username').in('id', p.all);
                const search = await s.from('public_seller_profiles').select('id, username').ilike('username', p.tag + '_%');
                const active = await s.from('public_seller_profiles').select('id').eq('id', p.activeId).maybeSingle();
                const inactive = await s.from('public_seller_profiles').select('id').eq('id', p.inactiveId).maybeSingle();
                // Paginate 1-row-at-a-time over the search-scoped view; RLS
                // must apply BEFORE order/range so inactive sellers never
                // appear at any page boundary.
                const paged = new Set();
                for (let from = 0; from < 20; from += 1) {
                    const { data, error } = await s
                        .from('public_seller_profiles')
                        .select('id, username')
                        .ilike('username', p.tag + '_%')
                        .order('username', { ascending: true })
                        .range(from, from);
                    if (error || !data || data.length === 0) break;
                    for (const r of data) paged.add(r.id);
                }
                return {
                    bulk: (bulk.data ?? []).map((r) => r.id),
                    search: (search.data ?? []).map((r) => r.id),
                    activeVisible: active.data?.id === p.activeId,
                    inactiveVisible: inactive.data != null,
                    paged: Array.from(paged),
                };
            }""",
            payload,
        )

        check(result["activeVisible"], "active seller visible via app client")
        check(not result["inactiveVisible"], "inactive-only seller HIDDEN via app client")
        check(ids["active"] in result["bulk"], "bulk .in() from app includes active seller")
        check(ids["inactive"] not in result["bulk"], "bulk .in() from app EXCLUDES inactive seller")
        check(ids["buyer"] not in result["bulk"], "bulk .in() from app EXCLUDES buyer (never a seller)")
        check(ids["active"] in result["search"], "username search from app includes active seller")
        check(ids["inactive"] not in result["search"], "username search from app EXCLUDES inactive seller")
        check(ids["active"] in result["paged"], "paginated search from app includes active seller")
        check(ids["inactive"] not in result["paged"], "paginated search from app EXCLUDES inactive seller")
        check(ids["buyer"] not in result["paged"], "paginated search from app EXCLUDES buyer")

        os.makedirs("/tmp/browser", exist_ok=True)
        await page.screenshot(path="/tmp/browser/e2e-buyer-visibility.png")
        if errors:
            print("Page errors:", errors, file=sys.stderr)
        await browser.close()


def main() -> None:
    seed()
    try:
        asyncio.run(run_browser())
    finally:
        teardown()
    if failures:
        print(f"\n{failures} e2e assertion(s) failed", file=sys.stderr)
        sys.exit(1)
    print("\nAll buyer-visibility E2E assertions passed.")


if __name__ == "__main__":
    main()