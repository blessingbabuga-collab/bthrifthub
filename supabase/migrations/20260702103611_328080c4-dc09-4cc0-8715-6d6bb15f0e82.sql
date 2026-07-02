-- Stop exposing full profile rows (bio, full_name, location, avatar) publicly.
-- Replace the row-level policy with a narrow view that only reveals the
-- minimum needed to render a seller badge on public product pages.
DROP POLICY IF EXISTS profiles_seller_read ON public.profiles;

CREATE OR REPLACE VIEW public.public_seller_profiles
WITH (security_invoker = true) AS
SELECT p.id, p.username, p.avatar_url
FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.products pr
  WHERE pr.seller_id = p.id AND pr.status = 'active'
);

-- The view runs with the caller's privileges (security_invoker), so add a
-- targeted policy that lets anon/authenticated read ONLY id/username/avatar_url
-- of profiles that own an active listing. The view enforces the column subset.
CREATE POLICY profiles_public_seller_card_read
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products pr
    WHERE pr.seller_id = profiles.id AND pr.status = 'active'
  )
);

GRANT SELECT (id, username, avatar_url) ON public.profiles TO anon, authenticated;
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, username, avatar_url) ON public.profiles TO anon;

GRANT SELECT ON public.public_seller_profiles TO anon, authenticated;