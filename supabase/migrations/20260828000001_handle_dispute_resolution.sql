CREATE OR REPLACE FUNCTION public.handle_dispute_resolution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tx record;
BEGIN
  IF NEW.status != OLD.status AND (NEW.status = 'resolved_buyer' OR NEW.status = 'resolved_seller') THEN
    
    IF NEW.status = 'resolved_seller' THEN
      -- Release escrow to seller(s)
      UPDATE public.orders SET escrow_status = 'released', status = 'delivered' WHERE id = NEW.order_id;
      
      FOR v_tx IN SELECT * FROM public.transactions WHERE order_id = NEW.order_id AND type = 'escrow_hold' AND status = 'completed'
      LOOP
        INSERT INTO public.transactions (wallet_id, order_id, type, amount, platform_commission, net_amount, status, description)
        VALUES (v_tx.wallet_id, NEW.order_id, 'escrow_release', v_tx.amount, v_tx.platform_commission, v_tx.net_amount, 'completed', 'Dispute resolved in favor of seller');
      END LOOP;
      
    ELSIF NEW.status = 'resolved_buyer' THEN
      -- Refund buyer (cancel escrow hold on seller's side)
      UPDATE public.orders SET escrow_status = 'refunded', status = 'cancelled' WHERE id = NEW.order_id;
      
      FOR v_tx IN SELECT * FROM public.transactions WHERE order_id = NEW.order_id AND type = 'escrow_hold' AND status = 'completed'
      LOOP
        INSERT INTO public.transactions (wallet_id, order_id, type, amount, platform_commission, net_amount, status, description)
        VALUES (v_tx.wallet_id, NEW.order_id, 'refund', v_tx.amount, v_tx.platform_commission, v_tx.net_amount, 'completed', 'Dispute resolved in favor of buyer - Refund');
      END LOOP;
    END IF;

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_dispute_resolution ON public.disputes;
CREATE TRIGGER on_dispute_resolution
AFTER UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.handle_dispute_resolution();


-- Update wallet balances to handle 'refund' type
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
  ELSIF NEW.type = 'refund' AND NEW.status = 'completed' THEN
    UPDATE public.wallets 
    SET pending_balance = pending_balance - NEW.net_amount
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
