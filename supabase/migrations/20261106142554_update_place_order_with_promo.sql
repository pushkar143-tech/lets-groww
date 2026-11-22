/*
# Update place_order to support promo code application at checkout

Adds optional p_promo_code text parameter. When provided:
- Validates the promo code via the existing logic (active, not expired, under max_uses)
- Computes the discount (percent or flat, capped at order total)
- Charges only the discounted total_price to the wallet
- Increments promo_codes.times_used and records usage

The order row stores the FINAL (discounted) total_price so refunds reconcile.
If no promo code is provided, behaves exactly as before.
*/

CREATE OR REPLACE FUNCTION public.place_order(
  p_service_name text,
  p_quantity integer,
  p_link text,
  p_total_price numeric,
  p_promo_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance numeric;
  v_order public.orders;
  v_promo public.promo_codes;
  v_discount numeric := 0;
  v_final_price numeric := p_total_price;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  IF p_total_price < 0 THEN
    RAISE EXCEPTION 'Invalid price';
  END IF;

  -- Apply promo code if provided
  IF p_promo_code IS NOT NULL AND TRIM(p_promo_code) <> '' THEN
    SELECT * INTO v_promo FROM public.promo_codes
    WHERE code = UPPER(TRIM(p_promo_code)) FOR UPDATE;

    IF v_promo.id IS NULL THEN
      RAISE EXCEPTION 'Invalid promo code';
    END IF;
    IF NOT v_promo.is_active THEN
      RAISE EXCEPTION 'This promo code is no longer active';
    END IF;
    IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
      RAISE EXCEPTION 'This promo code has expired';
    END IF;
    IF v_promo.max_uses IS NOT NULL AND v_promo.times_used >= v_promo.max_uses THEN
      RAISE EXCEPTION 'This promo code has reached its usage limit';
    END IF;

    IF v_promo.discount_type = 'percent' THEN
      v_discount := p_total_price * (v_promo.discount_value / 100.0);
    ELSE
      v_discount := LEAST(v_promo.discount_value, p_total_price);
    END IF;

    v_final_price := GREATEST(p_total_price - v_discount, 0);
  END IF;

  SELECT wallet_balance INTO v_balance
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < v_final_price THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_final_price
  WHERE id = v_user_id;

  INSERT INTO public.orders (user_id, service_name, quantity, link, total_price, status)
  VALUES (v_user_id, p_service_name, p_quantity, p_link, v_final_price, 'Pending')
  RETURNING * INTO v_order;

  -- Consume promo code after successful order
  IF v_promo.id IS NOT NULL THEN
    UPDATE public.promo_codes SET times_used = times_used + 1 WHERE id = v_promo.id;
    INSERT INTO public.promo_code_usages (promo_code_id, user_id)
    VALUES (v_promo.id, v_user_id);
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'new_balance', v_balance - v_final_price,
    'discount', v_discount,
    'final_price', v_final_price
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order(text, integer, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(text, integer, text, numeric, text) TO authenticated;
