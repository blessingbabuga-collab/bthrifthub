"""
End-to-end test: start from an active listing detail page and verify the
buyer can only open seller profiles that have at least one active listing.

Because the buyer app fetches seller data through the same Supabase view
(`public_seller_profiles`) whether from a product page, a search, or a
direct URL, we drive the real page load then use the running app's
Supabase client (same origin, same auth, same RLS) to verify:

  - Loading /product/<active_id> resolves the seller card for that listing.
  - Loading /product/<sold_id> renders the product without exposing an
    inactive-only seller through the same client fetchers.
  - The exact fetcher used by the product page (`fetchSellerProfile`)
    returns the active seller and NULL for the inactive-only seller.

Run:  bun run test:e2e-listing
"""
import asyncio, json, os, random, string, sys, time, urllib.request

URL = os.environ.get("SUPABASE_URL")
ANON = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
SERVICE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
APP = os.environ.get("E2E_BASE_URL", "http://localhost:8080")

if not (URL and ANON and SERVICE):
    print("[skip] e2e-listing requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(0)

TAG = f"e2el_{int(time.time())}_{''.join(random.choices(string.ascii_lowercase+string.digits, k=6))}"
PASSWORD = "Test!" + "".join(random.choices(string.ascii_letters+string.digits, k=10)) + "Aa1"

failures = 0
def check(cond: bool, msg: str) -> None:
    global failures
    if cond: print(f"  ✓ {msg}")
    else: failures += 1; print(f"  ✗ {msg}", file=sys.stderr)

def _admin(path, method="POST", body=None, extra=None):
    req = urllib.request.Request(
        f"{URL}{path}", method=method,
        headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}",
                 "Content-Type": "application/json",
                 "Prefer": "return=representation", **(extra or {})},
        data=None if body is None else json.dumps(body).encode(),
    )
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode(errors='ignore')}")

state = {"ids": {}, "products": {}, "emails": {}}

def seed():
    for persona in ("active", "sold_only", "buyer"):
        email = f"{TAG}_{persona}@example.test"
        state["emails"][persona] = email
        u = _admin("/auth/v1/admin/users", "POST", {
            "email": email, "password": PASSWORD, "email_confirm": True,
            "user_metadata": {"username": f"{TAG}_{persona}"},
        })
        uid = u.get("id") or u.get("user", {}).get("id")
        assert uid, f"no id for {persona}"
        state["ids"][persona] = uid
        _admin("/rest/v1/profiles?on_conflict=id", "POST",
               {"id": uid, "username": f"{TAG}_{persona}", "full_name": persona, "bio": "secret"},
               extra={"Prefer": "return=representation,resolution=merge-duplicates"})
    prods = _admin("/rest/v1/products", "POST", [
        {"seller_id": state["ids"]["active"], "title": f"{TAG} active-listing",
         "price": 1000, "image_url": "https://example.test/x.jpg",
         "category": "Streetwear", "status": "active"},
        {"seller_id": state["ids"]["sold_only"], "title": f"{TAG} sold-listing",
         "price": 1000, "image_url": "https://example.test/x.jpg",
         "category": "Streetwear", "status": "sold"},
    ])
    for p in prods:
        if p["seller_id"] == state["ids"]["active"]: state["products"]["active"] = p["id"]
        else: state["products"]["sold"] = p["id"]

def teardown():
    for uid in state["ids"].values():
        try: _admin(f"/auth/v1/admin/users/{uid}", "DELETE")
        except Exception: pass

async def run_browser():
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # 1. Sign in as buyer via the real /auth UI.
        await page.goto(f"{APP}/auth", wait_until="networkidle")
        await page.add_style_tag(content="#__lv_err_overlay{display:none!important;pointer-events:none!important;}")
        await page.locator('input[type="email"]').fill(state["emails"]["buyer"])
        await page.locator('input[type="password"]').fill(PASSWORD)
        async with page.expect_response(
            lambda r: "/auth/v1/token" in r.url and r.request.method == "POST", timeout=15000
        ) as ri:
            await page.get_by_role("button", name="Sign in").click()
        tok = await ri.value
        check(tok.status == 200, f"buyer signs in ({tok.status})")

        # 2. Land on the ACTIVE listing detail page.
        await page.goto(f"{APP}/product/{state['products']['active']}", wait_until="networkidle")
        os.makedirs("/tmp/browser", exist_ok=True)
        await page.screenshot(path="/tmp/browser/e2e-listing-active.png")
        title_ok = await page.locator("h1").inner_text()
        check(TAG in title_ok, f"active listing renders (h1={title_ok!r})")

        # 3. Ask the running app's fetcher (the SAME one the page uses) to
        #    resolve the seller for BOTH the active and the inactive seller,
        #    then confirm only the active one is reachable.
        payload = {
            "activeSellerId": state["ids"]["active"],
            "inactiveSellerId": state["ids"]["sold_only"],
            "tag": TAG,
        }
        result = await page.evaluate(
            """async (p) => {
                const [{ supabase }, prod] = await Promise.all([
                    import('/src/integrations/supabase/client.ts'),
                    import('/src/lib/products.ts'),
                ]);
                const activeSeller = await prod.fetchSellerProfile(p.activeSellerId);
                let inactiveSeller = null, inactiveErr = null;
                try { inactiveSeller = await prod.fetchSellerProfile(p.inactiveSellerId); }
                catch (e) { inactiveErr = String(e); }
                // Pagination sweep over the buyer search view.
                const seen = new Set();
                for (let from = 0; from < 20; from += 1) {
                    const { data, error } = await supabase
                        .from('public_seller_profiles')
                        .select('id, username')
                        .ilike('username', p.tag + '_%')
                        .order('username', { ascending: true })
                        .range(from, from);
                    if (error || !data || data.length === 0) break;
                    for (const r of data) seen.add(r.id);
                }
                return {
                    activeVisible: activeSeller?.id === p.activeSellerId,
                    inactiveVisible: inactiveSeller != null,
                    inactiveErr,
                    pageActive: seen.has(p.activeSellerId),
                    pageInactive: seen.has(p.inactiveSellerId),
                };
            }""",
            payload,
        )
        check(result["activeVisible"], "product page fetcher resolves the ACTIVE seller")
        check(not result["inactiveVisible"],
              f"product page fetcher CANNOT resolve inactive-only seller (got {result['inactiveVisible']})")
        check(result["pageActive"], "paginated search reveals active seller")
        check(not result["pageInactive"], "paginated search does NOT leak inactive-only seller")

        # 4. Direct-navigate to the SOLD listing detail (RLS on products
        #    hides it entirely for a non-owner). The page must NOT reveal
        #    the inactive-only seller identity through the seller card.
        await page.goto(f"{APP}/product/{state['products']['sold']}", wait_until="networkidle")
        await page.screenshot(path="/tmp/browser/e2e-listing-sold.png")
        body = (await page.locator("body").inner_text()).lower()
        check(f"{TAG.lower()}_sold_only" not in body,
              "sold listing page never surfaces inactive seller username")

        if errors: print("Page errors:", errors, file=sys.stderr)
        await browser.close()

def main():
    seed()
    try: asyncio.run(run_browser())
    finally: teardown()
    if failures:
        print(f"\n{failures} e2e-listing assertion(s) failed", file=sys.stderr); sys.exit(1)
    print("\nAll listing→seller E2E assertions passed.")

if __name__ == "__main__":
    main()