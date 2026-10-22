-- Add delivery_otp to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_otp text,
ADD COLUMN IF NOT EXISTS otp_attempts integer DEFAULT 0;

-- Function to generate 6 digit numeric code
CREATE OR REPLACE FUNCTION public.generate_delivery_otp()
RETURNS text LANGUAGE sql AS $$
  SELECT LPAD(FLOOR(random() * 1000000)::text, 6, '0');
$$;

-- Trigger to auto-generate delivery_otp when order is inserted or paid
CREATE OR REPLACE FUNCTION public.set_order_delivery_otp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.delivery_otp IS NULL THEN
    NEW.delivery_otp := public.generate_delivery_otp();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_order_delivery_otp ON public.orders;
CREATE TRIGGER trigger_set_order_delivery_otp
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_delivery_otp();

-- RPC for seller to verify OTP and release escrow
CREATE OR REPLACE FUNCTION public.verify_delivery_otp(target_order_id uuid, entered_otp text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_seller boolean;
  v_order record;
  v_tx record;
BEGIN
  -- Verify user is a seller for this order
  SELECT EXISTS (
    SELECT 1 FROM public.order_items WHERE order_id = target_order_id AND seller_id = auth.uid()
  ) INTO v_is_seller;

  IF NOT v_is_seller THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Only the merchant can verify handover OTP');
  END IF;

  -- Get order details
  SELECT * INTO v_order FROM public.orders WHERE id = target_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  IF v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order is already marked as delivered');
  END IF;

  -- Rate limit OTP attempts (max 5)
  IF COALESCE(v_order.otp_attempts, 0) >= 5 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Too many invalid attempts. Contact platform support.');
  END IF;

  -- Check OTP
  IF trim(v_order.delivery_otp) != trim(entered_otp) THEN
    UPDATE public.orders 
    SET otp_attempts = COALESCE(otp_attempts, 0) + 1 
    WHERE id = target_order_id;
    RETURN jsonb_build_object('success', false, 'message', 'Invalid verification PIN. Please recheck with the buyer.');
  END IF;

  -- Update order to delivered and escrow released
  UPDATE public.orders 
  SET status = 'delivered', 
      escrow_status = 'released',
      otp_attempts = 0
  WHERE id = target_order_id;

  -- Create order event
  INSERT INTO public.order_status_events (order_id, status, note)
  VALUES (target_order_id, 'delivered', 'Delivery confirmed via buyer Handover OTP. Escrow released to merchant.');

  -- Process escrow releases
  FOR v_tx IN SELECT * FROM public.transactions WHERE order_id = target_order_id AND type = 'escrow_hold' AND status = 'completed'
  LOOP
    INSERT INTO public.transactions (wallet_id, order_id, type, amount, platform_commission, net_amount, status, description)
    VALUES (v_tx.wallet_id, target_order_id, 'escrow_release', v_tx.amount, v_tx.platform_commission, v_tx.net_amount, 'completed', 'Escrow released via Delivery OTP');
  END LOOP;

  RETURN jsonb_build_object('success', true, 'message', 'Delivery confirmed successfully. Funds released to your wallet.');
END;
$$;
