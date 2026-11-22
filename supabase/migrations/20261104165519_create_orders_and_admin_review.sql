/*
# Create orders table and admin review RPC functions

1. New Tables
- `orders`
  - `id` (uuid, primary key, auto-generated)
  - `user_id` (uuid, FK to auth.users, defaults to auth.uid(), nullable for legacy rows)
  - `service_name` (text, not null) — name of the service ordered
  - `quantity` (integer, not null, check > 0)
  - `link` (text, not null) — the social media link/username provided
  - `total_price` (numeric, not null, check >= 0) — total charge in INR
  - `status` (text, not null, default 'Pending', check in Pending/Approved/Rejected/In Progress/Completed)
  - `created_at` (timestamptz, default now())

2. Security — RLS + Grants
- RLS enabled on `orders`.
- `authenticated` role gets SELECT (owner or admin), INSERT (owner only). No direct UPDATE/DELETE — admin actions go through SECURITY DEFINER RPCs.
- 4 policies: select_own_or_admin, insert_own, no_direct_update, no_direct_delete.
- `service_role` granted all CRUD for server-side use.

3. RPC Functions (SECURITY DEFINER)
- `approve_order(p_order_id uuid)` — sets status to 'Completed' if currently 'Pending'. Admin-only via is_admin() check.
- `reject_order_and_refund(p_order_id uuid)` — sets status to 'Rejected' if currently 'Pending' AND refunds total_price back to the user's wallet_balance. Admin-only.
- Both functions REVOKE EXECUTE from PUBLIC/anon, GRANT to authenticated only.

4. Important Notes
- The Dashboard's "Place Order" flow will insert into this table; user_id defaults to auth.uid() so the client doesn't need to pass it.
- Wallet deduction on order placement is handled client-side in the Dashboard; the refund on rejection restores the balance server-side.
- Idempotent: safe to re-run.
*/

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  service_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  link text NOT NULL DEFAULT '',
  total_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','In Progress','Completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO service_role;

DROP POLICY IF EXISTS "Users can read own or all orders for admin" ON public.orders;
CREATE POLICY "Users can read own or all orders for admin"
  ON public.orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
CREATE POLICY "Users can insert own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Orders cannot be updated directly" ON public.orders;
CREATE POLICY "Orders cannot be updated directly"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Orders cannot be deleted directly" ON public.orders;
CREATE POLICY "Orders cannot be deleted directly"
  ON public.orders FOR DELETE
  TO authenticated
  USING (false);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON public.orders (created_at DESC);

-- Approve order: set status from Pending -> Completed
CREATE OR REPLACE FUNCTION public.approve_order(p_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 'Pending' THEN
    RAISE EXCEPTION 'Order already reviewed';
  END IF;

  UPDATE public.orders
  SET status = 'Completed'
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

-- Reject order and refund: set status to Rejected AND credit wallet back
CREATE OR REPLACE FUNCTION public.reject_order_and_refund(p_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 'Pending' THEN
    RAISE EXCEPTION 'Order already reviewed';
  END IF;

  UPDATE public.orders
  SET status = 'Rejected'
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  IF v_order.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + v_order.total_price
    WHERE id = v_order.user_id;
  END IF;

  RETURN v_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_order(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_order_and_refund(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_order_and_refund(uuid) TO authenticated;
