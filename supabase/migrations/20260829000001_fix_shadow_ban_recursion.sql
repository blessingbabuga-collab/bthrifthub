DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
  FOR SELECT
  USING (
    (status = 'active' AND shadow_banned = false) 
    OR seller_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "products_admin_update" ON public.products;
CREATE POLICY "products_admin_update" ON public.products
  FOR UPDATE
  USING (
    public.is_admin()
  );
