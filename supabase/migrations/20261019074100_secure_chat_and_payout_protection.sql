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
