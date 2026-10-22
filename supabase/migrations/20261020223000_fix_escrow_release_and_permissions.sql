-- Ensure wallets table exists and every user has a wallet
INSERT INTO public.wallets (user_id)
SELECT id FROM public.profiles WHERE id NOT IN (SELECT user_id FROM public.wallets)
ON CONFLICT (user_id) DO NOTHING;

-- Grant INSERT & SELECT on transactions to authenticated users
DROP POLICY IF EXISTS "Users can insert transactions" ON public.transactions;
CREATE POLICY "Users can insert transactions" ON public.transactions 
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view transactions" ON public.transactions 
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.wallets WHERE wallets.id = transactions.wallet_id AND wallets.user_id = auth.uid()
  )
);

-- Improved confirm_delivery RPC function that self-heals missing checkout transactions
CREATE OR REPLACE FUNCTION public.confirm_delivery(target_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_buyer_id uuid;
  v_order_status text;
  v_order_tracking text;
  v_has_hold boolean;
  v_item record;
  v_seller_wallet_id uuid;
  v_comm_percent numeric;
  v_commission numeric;
  v_net numeric;
  v_tx record;
BEGIN
  -- 1. Fetch order details
  SELECT buyer_id, status, tracking_code 
  INTO v_buyer_id, v_order_status, v_order_tracking
  FROM public.orders 
  WHERE id = target_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- Verify caller is the buyer
  IF v_buyer_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Only the buyer can confirm delivery directly');
  END IF;

  IF v_order_status = 'delivered' THEN
    -- If already delivered, check if transactions were created
    SELECT EXISTS (
      SELECT 1 FROM public.transactions WHERE order_id = target_order_id AND type = 'escrow_release'
    ) INTO v_has_hold;

    IF v_has_hold THEN
      RETURN jsonb_build_object('success', true, 'message', 'Order already marked as delivered and funds released.');
    END IF;
  END IF;

  -- 2. Update order to delivered and escrow released
  UPDATE public.orders 
  SET status = 'delivered', escrow_status = 'released' 
  WHERE id = target_order_id;

  -- 3. Create order event
  INSERT INTO public.order_status_events (order_id, status, note)
  VALUES (target_order_id, 'delivered', 'Delivery confirmed by buyer. Funds released to seller(s).');

  -- 4. Check if an escrow_hold already exists
  SELECT EXISTS (
    SELECT 1 FROM public.transactions WHERE order_id = target_order_id AND type = 'escrow_hold'
  ) INTO v_has_hold;

  IF v_has_hold THEN
    -- Release existing escrow hold
    FOR v_tx IN SELECT * FROM public.transactions WHERE order_id = target_order_id AND type = 'escrow_hold'
    LOOP
      -- Avoid duplicate escrow_release
      IF NOT EXISTS (
        SELECT 1 FROM public.transactions WHERE order_id = target_order_id AND type = 'escrow_release' AND wallet_id = v_tx.wallet_id
      ) THEN
        INSERT INTO public.transactions (wallet_id, order_id, type, amount, platform_commission, net_amount, status, description)
        VALUES (v_tx.wallet_id, target_order_id, 'escrow_release', v_tx.amount, v_tx.platform_commission, v_tx.net_amount, 'completed', 'Escrow released for order');
      END IF;
    END LOOP;
  ELSE
    -- If escrow_hold was missing (e.g. blocked by earlier RLS policy at checkout), compute and release directly!
    v_comm_percent := public.get_platform_commission_percent();

    FOR v_item IN 
      SELECT seller_id, SUM(unit_price * quantity) as total_seller_amt
      FROM public.order_items 
      WHERE order_id = target_order_id 
      GROUP BY seller_id
    LOOP
      -- Ensure seller has a wallet
      INSERT INTO public.wallets (user_id) 
      VALUES (v_item.seller_id) 
      ON CONFLICT (user_id) DO NOTHING;

      SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_item.seller_id;

      v_commission := ROUND(v_item.total_seller_amt * (v_comm_percent / 100.0), 2);
      v_net := v_item.total_seller_amt - v_commission;

      -- Insert escrow_release
      INSERT INTO public.transactions (
        wallet_id, order_id, type, amount, platform_commission, net_amount, status, description
      ) VALUES (
        v_seller_wallet_id, 
        target_order_id, 
        'escrow_release', 
        v_item.total_seller_amt, 
        v_commission, 
        v_net, 
        'completed', 
        'Escrow released for order ' || COALESCE(v_order_tracking, '')
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Delivery confirmed. Escrow released to seller.');
END;
$$;

-- Also upgrade verify_delivery_otp with the same self-healing logic
CREATE OR REPLACE FUNCTION public.verify_delivery_otp(target_order_id uuid, entered_otp text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_seller boolean;
  v_order record;
  v_has_hold boolean;
  v_item record;
  v_seller_wallet_id uuid;
  v_comm_percent numeric;
  v_commission numeric;
  v_net numeric;
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
  IF trim(COALESCE(v_order.delivery_otp, '')) != trim(entered_otp) THEN
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
  SELECT EXISTS (
    SELECT 1 FROM public.transactions WHERE order_id = target_order_id AND type = 'escrow_hold'
  ) INTO v_has_hold;

  IF v_has_hold THEN
    FOR v_tx IN SELECT * FROM public.transactions WHERE order_id = target_order_id AND type = 'escrow_hold'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.transactions WHERE order_id = target_order_id AND type = 'escrow_release' AND wallet_id = v_tx.wallet_id
      ) THEN
        INSERT INTO public.transactions (wallet_id, order_id, type, amount, platform_commission, net_amount, status, description)
        VALUES (v_tx.wallet_id, target_order_id, 'escrow_release', v_tx.amount, v_tx.platform_commission, v_tx.net_amount, 'completed', 'Escrow released via Delivery OTP');
      END IF;
    END LOOP;
  ELSE
    v_comm_percent := public.get_platform_commission_percent();

    FOR v_item IN 
      SELECT seller_id, SUM(unit_price * quantity) as total_seller_amt
      FROM public.order_items 
      WHERE order_id = target_order_id 
      GROUP BY seller_id
    LOOP
      INSERT INTO public.wallets (user_id) 
      VALUES (v_item.seller_id) 
      ON CONFLICT (user_id) DO NOTHING;

      SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_item.seller_id;

      v_commission := ROUND(v_item.total_seller_amt * (v_comm_percent / 100.0), 2);
      v_net := v_item.total_seller_amt - v_commission;

      INSERT INTO public.transactions (
        wallet_id, order_id, type, amount, platform_commission, net_amount, status, description
      ) VALUES (
        v_seller_wallet_id, 
        target_order_id, 
        'escrow_release', 
        v_item.total_seller_amt, 
        v_commission, 
        v_net, 
        'completed', 
        'Escrow released via Delivery OTP for order ' || COALESCE(v_order.tracking_code, '')
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Delivery confirmed successfully. Funds released to your wallet.');
END;
$$;

-- Retroactively credit any past delivered orders whose sellers haven't received their escrow_release yet!
DO $$
DECLARE
  v_ord record;
  v_item record;
  v_seller_wallet_id uuid;
  v_comm_percent numeric := public.get_platform_commission_percent();
  v_commission numeric;
  v_net numeric;
BEGIN
  FOR v_ord IN 
    SELECT o.id, o.tracking_code 
    FROM public.orders o
    WHERE o.status = 'delivered'
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.order_id = o.id AND t.type = 'escrow_release'
      )
  LOOP
    FOR v_item IN 
      SELECT seller_id, SUM(unit_price * quantity) as total_seller_amt
      FROM public.order_items 
      WHERE order_id = v_ord.id 
      GROUP BY seller_id
    LOOP
      INSERT INTO public.wallets (user_id) 
      VALUES (v_item.seller_id) 
      ON CONFLICT (user_id) DO NOTHING;

      SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_item.seller_id;

      v_commission := ROUND(v_item.total_seller_amt * (v_comm_percent / 100.0), 2);
      v_net := v_item.total_seller_amt - v_commission;

      INSERT INTO public.transactions (
        wallet_id, order_id, type, amount, platform_commission, net_amount, status, description
      ) VALUES (
        v_seller_wallet_id, 
        v_ord.id, 
        'escrow_release', 
        v_item.total_seller_amt, 
        v_commission, 
        v_net, 
        'completed', 
        'Retroactive escrow release for order ' || COALESCE(v_ord.tracking_code, '')
      );
    END LOOP;
  END LOOP;
END $$;
