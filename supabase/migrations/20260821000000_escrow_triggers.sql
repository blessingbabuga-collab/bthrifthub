-- Trigger to maintain wallet balances based on transactions

CREATE OR REPLACE FUNCTION public.update_wallet_balances()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.type = 'escrow_hold' AND NEW.status = 'completed' THEN
    UPDATE public.wallets 
    SET pending_balance = pending_balance + NEW.net_amount
    WHERE id = NEW.wallet_id;
  ELSIF NEW.type = 'escrow_release' AND NEW.status = 'completed' THEN
    UPDATE public.wallets 
    SET pending_balance = pending_balance - NEW.net_amount,
        available_balance = available_balance + NEW.net_amount
    WHERE id = NEW.wallet_id;
  ELSIF NEW.type = 'withdrawal' AND NEW.status = 'completed' THEN
    UPDATE public.wallets 
    SET available_balance = available_balance - NEW.amount,
        withdrawn_balance = withdrawn_balance + NEW.amount
    WHERE id = NEW.wallet_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_transaction_completed ON public.transactions;
CREATE TRIGGER on_transaction_completed
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_wallet_balances();

-- RPC for buyer to confirm delivery
CREATE OR REPLACE FUNCTION public.confirm_delivery(target_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_buyer_id uuid;
  v_tx record;
BEGIN
  -- Verify ownership
  SELECT buyer_id INTO v_buyer_id FROM public.orders WHERE id = target_order_id;
  IF v_buyer_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Update order
  UPDATE public.orders 
  SET status = 'delivered', escrow_status = 'released' 
  WHERE id = target_order_id;

  -- Create order event
  INSERT INTO public.order_status_events (order_id, status, note)
  VALUES (target_order_id, 'delivered', 'Delivery confirmed by buyer. Funds released to seller(s).');

  -- Process escrow releases
  FOR v_tx IN SELECT * FROM public.transactions WHERE order_id = target_order_id AND type = 'escrow_hold' AND status = 'completed'
  LOOP
    INSERT INTO public.transactions (wallet_id, order_id, type, amount, platform_commission, net_amount, status, description)
    VALUES (v_tx.wallet_id, target_order_id, 'escrow_release', v_tx.amount, v_tx.platform_commission, v_tx.net_amount, 'completed', 'Escrow released for order');
  END LOOP;
END;
$$;

-- RPC for seller to mark as shipped
CREATE OR REPLACE FUNCTION public.mark_order_shipped(target_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_seller boolean;
BEGIN
  -- Verify user is a seller for this order
  SELECT EXISTS (
    SELECT 1 FROM public.order_items WHERE order_id = target_order_id AND seller_id = auth.uid()
  ) INTO v_is_seller;

  IF NOT v_is_seller THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Update order
  UPDATE public.orders 
  SET status = 'shipped'
  WHERE id = target_order_id;

  -- Create order event
  INSERT INTO public.order_status_events (order_id, status, note)
  VALUES (target_order_id, 'shipped', 'Order marked as shipped by seller.');
END;
$$;

-- Allow sellers to view orders that contain their items
CREATE POLICY "sellers view their orders" ON public.orders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = id AND i.seller_id = auth.uid())
);

-- Allow authenticated users to insert transactions (required for checkout)
CREATE POLICY "Users can insert transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.wallets WHERE wallets.id = wallet_id AND wallets.user_id = auth.uid()
  )
);
