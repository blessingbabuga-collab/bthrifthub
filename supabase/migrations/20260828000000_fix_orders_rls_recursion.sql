-- Drop the recursive policy
DROP POLICY IF EXISTS "sellers view their orders" ON public.orders;

-- Create a security definer function to check if user is a seller for a specific order
CREATE OR REPLACE FUNCTION is_seller_on_order(order_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.order_items 
    WHERE order_id = order_uuid AND seller_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the policy using the security definer function
CREATE POLICY "sellers view their orders" ON public.orders FOR SELECT TO authenticated USING (
  is_seller_on_order(id, auth.uid())
);
