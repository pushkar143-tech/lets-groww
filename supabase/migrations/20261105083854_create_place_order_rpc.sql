/*
# Create place_order atomic RPC function

1. Purpose
- Currently the Dashboard inserts an order and only deducts wallet balance in local React state, not in the database.
- The realtime wallet listener then syncs the un-deducted DB balance back, making it appear the charge was refunded.
- This migration creates a SECURITY DEFINER function `place_order` that atomically:
  a) Validates the user has sufficient wallet_balance
  b) Deducts total_price from profiles.wallet_balance
  c) Inserts the order row
  d) Returns the new wallet balance
- This eliminates the race condition and ensures the deduction always happens server-side.

2. Security
- SECURITY DEFINER, admin-only check NOT needed (any authenticated user places their own order).
- REVOKE EXECUTE from PUBLIC/anon, GRANT to authenticated only.
- Idempotent: safe to re-run.
*/

CREATE OR REPLACE FUNCTION public.place_order(
  p_service_name text,
  p_quantity integer,
  p_link text,
  p_total_price numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance numeric;
  v_order public.orders;
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

  SELECT wallet_balance INTO v_balance
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < p_total_price THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_total_price
  WHERE id = v_user_id;

  INSERT INTO public.orders (user_id, service_name, quantity, link, total_price, status)
  VALUES (v_user_id, p_service_name, p_quantity, p_link, p_total_price, 'Pending')
  RETURNING * INTO v_order;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'new_balance', v_balance - p_total_price
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order(text, integer, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(text, integer, text, numeric) TO authenticated;
