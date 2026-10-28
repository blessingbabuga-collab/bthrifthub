-- Function to allow buyers and merchants to securely retrieve the WhatsApp contact number for confirmed/paid orders
CREATE OR REPLACE FUNCTION public.get_order_chat_contact(
  p_order_id uuid,
  p_target_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id uuid;
  v_order record;
  v_is_buyer boolean;
  v_is_seller boolean;
  v_phone text;
  v_name text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Fetch the order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Only allow when payment is confirmed (status is paid, shipped, out_for_delivery, or delivered)
  IF v_order.status NOT IN ('paid', 'shipped', 'out_for_delivery', 'delivered') THEN
    RETURN jsonb_build_object('success', false, 'error', 'WhatsApp chat is only available once payment is confirmed.');
  END IF;

  v_is_buyer := (v_order.buyer_id = v_caller_id);
  v_is_seller := EXISTS (
    SELECT 1 FROM public.order_items oi 
    WHERE oi.order_id = p_order_id AND oi.seller_id = v_caller_id
  );

  IF NOT v_is_buyer AND NOT v_is_seller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Case 1: Caller is the buyer, wanting to chat with a merchant/seller
  IF v_is_buyer THEN
    IF p_target_user_id IS NOT NULL THEN
      -- Ensure target seller is actually a seller in this order
      IF NOT EXISTS (
        SELECT 1 FROM public.order_items oi 
        WHERE oi.order_id = p_order_id AND oi.seller_id = p_target_user_id
      ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid seller for this order');
      END IF;

      SELECT phone_number, full_name INTO v_phone, v_name
      FROM public.profiles
      WHERE id = p_target_user_id;
    ELSE
      -- Pick the primary seller from order_items
      SELECT p.phone_number, p.full_name INTO v_phone, v_name
      FROM public.order_items oi
      JOIN public.profiles p ON p.id = oi.seller_id
      WHERE oi.order_id = p_order_id
      LIMIT 1;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'role', 'seller',
      'name', v_name,
      'phone_number', v_phone
    );
  END IF;

  -- Case 2: Caller is the merchant/seller, wanting to chat with the buyer
  IF v_is_seller THEN
    -- Check order's delivery phone or profile phone_number
    v_phone := v_order.phone;
    v_name := v_order.full_name;

    IF v_phone IS NULL OR trim(v_phone) = '' THEN
      SELECT phone_number, full_name INTO v_phone, v_name
      FROM public.profiles
      WHERE id = v_order.buyer_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'role', 'buyer',
      'name', v_name,
      'phone_number', v_phone
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Invalid request');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_chat_contact(uuid, uuid) TO authenticated;
