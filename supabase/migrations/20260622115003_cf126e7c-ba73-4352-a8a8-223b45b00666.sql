
DROP POLICY IF EXISTS profiles_public_read ON public.profiles;

CREATE POLICY profiles_self_read
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_seller_read
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.seller_id = profiles.id AND p.status = 'active'
  ));
