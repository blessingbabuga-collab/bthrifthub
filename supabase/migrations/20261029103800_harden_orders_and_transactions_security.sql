-- Migration: Database Security Hardening
-- 1. Restrict client arbitrary UPDATEs on orders.
-- 2. Restrict direct client INSERTs on transactions.
-- 3. Provide cancel_order RPC function with role checks.

CREATE OR REPLACE FUNCTION public.cancel_order(target_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order record;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = target_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- Only buyer or seller on order can cancel
  IF v_order.buyer_id != auth.uid() AND NOT public.is_seller_on_order(target_order_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized to cancel this order');
  END IF;

  -- Cannot cancel already delivered or shipped orders
  IF v_order.status IN ('shipped', 'out_for_delivery', 'delivered') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot cancel order once it is shipped or delivered');
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = target_order_id;

  INSERT INTO public.order_status_events (order_id, status, note)
  VALUES (target_order_id, 'cancelled', 'Order cancelled by user.');

  RETURN jsonb_build_object('success', true, 'message', 'Order cancelled successfully');
END;
$$;

-- Drop insecure direct update/insert policies
DROP POLICY IF EXISTS "buyers update their orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert transactions" ON public.transactions;

GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;
