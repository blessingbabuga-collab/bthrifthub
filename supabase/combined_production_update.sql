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
-- 1. Helper function to check if buyer has a confirmed/paid order with merchant for a product
CREATE OR REPLACE FUNCTION public.can_chat(p_buyer_id uuid, p_seller_id uuid, p_product_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- A buyer and seller can only chat if there exists a paid or delivered order containing the product or between the two parties
  RETURN EXISTS (
    SELECT 1 
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.buyer_id = p_buyer_id
      AND oi.seller_id = p_seller_id
      AND (p_product_id IS NULL OR oi.product_id = p_product_id)
      AND o.status IN ('paid', 'shipped', 'out_for_delivery', 'delivered')
  );
END;
$$;

-- 2. Restrict chat creation to confirmed paid orders only
DROP POLICY IF EXISTS "Buyers can insert new chats" ON public.chats;
CREATE POLICY "Buyers can insert new chats" ON public.chats 
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() = buyer_id AND 
    public.can_chat(buyer_id, seller_id, product_id)
  );

-- 3. Atomic Debit function for secure withdrawals (Prevents Race Condition Double Spending)
CREATE OR REPLACE FUNCTION public.debit_wallet_for_withdrawal(p_user_id uuid, p_amount numeric, p_description text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet record;
  v_tx_id uuid;
BEGIN
  -- Row-level exclusive lock on the wallet
  SELECT * INTO v_wallet 
  FROM public.wallets 
  WHERE user_id = p_user_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Wallet not found');
  END IF;

  IF COALESCE(v_wallet.available_balance, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient available balance');
  END IF;

  -- Create completed withdrawal transaction (which triggers update_wallet_balances atomically)
  INSERT INTO public.transactions (
    wallet_id,
    type,
    amount,
    platform_commission,
    net_amount,
    status,
    description
  ) VALUES (
    v_wallet.id,
    'withdrawal',
    p_amount,
    0,
    p_amount,
    'completed',
    p_description
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true, 
    'wallet_id', v_wallet.id,
    'transaction_id', v_tx_id,
    'remaining_balance', v_wallet.available_balance - p_amount
  );
END;
$$;

-- 4. Rollback function in case Paystack transfer request fails or throws
CREATE OR REPLACE FUNCTION public.rollback_failed_withdrawal(p_wallet_id uuid, p_amount numeric, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insert refund transaction
  INSERT INTO public.transactions (
    wallet_id,
    type,
    refund,
    amount,
    platform_commission,
    net_amount,
    status,
    description
  ) VALUES (
    p_wallet_id,
    'refund',
    p_amount,
    0,
    p_amount,
    'completed',
    'Payout failed (' || p_reason || '). Balance refunded.'
  );

  -- Adjust balances back
  UPDATE public.wallets
  SET available_balance = available_balance + p_amount,
      withdrawn_balance = GREATEST(0, withdrawn_balance - p_amount)
  WHERE id = p_wallet_id;
END;
$$;

-- 5. Seed missing email templates (order_paid, payout_success)
INSERT INTO email_templates (event_type, subject, body_html, variables_help_text) 
VALUES
  (
    'order_paid_buyer', 
    'Payment Confirmed — Order #{{tracking_code}}', 
    '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:12px;">' ||
    '<h2 style="color:#d97706;">Payment Received!</h2>' ||
    '<p>Hi <strong>{{buyer_name}}</strong>,</p>' ||
    '<p>Your payment for <strong>{{product_name}}</strong> has been securely confirmed and is being held in <strong>BTHRIFTS Escrow</strong>.</p>' ||
    '<div style="background:#f9fafb;padding:16px;border-radius:8px;margin:20px 0;">' ||
    '<p style="margin:0;font-size:14px;color:#6b7280;">Your Handover Delivery PIN:</p>' ||
    '<h1 style="margin:8px 0;letter-spacing:4px;color:#111827;font-family:monospace;">{{delivery_otp}}</h1>' ||
    '<p style="margin:0;font-size:12px;color:#9ca3af;">Keep this code confidential. Only provide it to the seller or courier after you have received and inspected the item.</p>' ||
    '</div>' ||
    '<p>Total Paid: <strong>₦{{total_amount}}</strong></p>' ||
    '<p>Chat with your merchant is now open in your BTHRIFTS dashboard to coordinate delivery.</p>' ||
    '</div>', 
    'Available variables: {{buyer_name}}, {{product_name}}, {{tracking_code}}, {{delivery_otp}}, {{total_amount}}'
  ),
  (
    'order_paid_seller',
    'New Paid Order Received — #{{tracking_code}}',
    '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:12px;">' ||
    '<h2 style="color:#059669;">You have a new paid order!</h2>' ||
    '<p>Hi <strong>{{seller_name}}</strong>,</p>' ||
    '<p>Payment for <strong>{{product_name}}</strong> has been confirmed and placed in escrow.</p>' ||
    '<p>Earnings to receive upon delivery: <strong>₦{{net_amount}}</strong> (after commission).</p>' ||
    '<p>Please package the item and mark the order as <strong>Shipped</strong> in your dashboard. You can now chat directly with the buyer to coordinate delivery.</p>' ||
    '<p><em>Remember to collect the 6-digit Delivery PIN from the buyer upon handover to immediately release your payout to your wallet.</em></p>' ||
    '</div>',
    'Available variables: {{seller_name}}, {{product_name}}, {{tracking_code}}, {{net_amount}}'
  ),
  (
    'payout_completed',
    'Payout Disbursed to Your Bank Account',
    '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:12px;">' ||
    '<h2 style="color:#059669;">Payout Successful!</h2>' ||
    '<p>Hi <strong>{{user_name}}</strong>,</p>' ||
    '<p>Your withdrawal of <strong>₦{{amount}}</strong> has been transferred to your bank account: <strong>{{bank_name}} (****{{account_last4}})</strong>.</p>' ||
    '<p>Reference: {{transfer_reference}}</p>' ||
    '<p>Thanks for selling on BTHRIFTS!</p>' ||
    '</div>',
    'Available variables: {{user_name}}, {{amount}}, {{bank_name}}, {{account_last4}}, {{transfer_reference}}'
  )
ON CONFLICT (event_type) DO UPDATE 
SET subject = EXCLUDED.subject, 
    body_html = EXCLUDED.body_html,
    variables_help_text = EXCLUDED.variables_help_text;
-- Create platform_settings table to store admin configurable fee rates
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    description text,
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read platform settings (needed for checkout calculations)
DROP POLICY IF EXISTS "Allow public read platform settings" ON public.platform_settings;
CREATE POLICY "Allow public read platform settings" ON public.platform_settings
    FOR SELECT TO public USING (true);

-- Only admins can modify platform settings
DROP POLICY IF EXISTS "Allow admin full access to platform settings" ON public.platform_settings;
CREATE POLICY "Allow admin full access to platform settings" ON public.platform_settings
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Seed default commission percentage (8.00%)
INSERT INTO public.platform_settings (key, value, description)
VALUES ('platform_commission_percent', '8', 'Platform commission percentage deducted from merchant sales')
ON CONFLICT (key) DO NOTHING;

-- Helper SQL function to get current commission percentage safely
CREATE OR REPLACE FUNCTION public.get_platform_commission_percent()
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_val text;
BEGIN
    SELECT value INTO v_val FROM public.platform_settings WHERE key = 'platform_commission_percent';
    IF v_val IS NULL OR NOT (v_val ~ '^[0-9]+(\.[0-9]+)?$') THEN
        RETURN 8.00; -- default fallback
    END IF;
    RETURN v_val::numeric;
END;
$$;
-- Allow 'paystack' as a valid payment_method in orders table
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_method_check 
CHECK (payment_method IN ('card', 'transfer', 'cod', 'paystack'));
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
DROP FUNCTION IF EXISTS public.confirm_delivery(uuid);
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
DROP FUNCTION IF EXISTS public.verify_delivery_otp(uuid, text);
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
