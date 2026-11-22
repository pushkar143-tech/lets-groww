/*
# Admin Users Management — account status, wallet transactions, and admin RPCs

## Purpose
Adds a dedicated Users management page to the admin panel with:
- Account status tracking (Active / Restricted / Suspended)
- Wallet add/deduct/gift operations with full transaction history
- Account restriction/suspension with reason notes
- Admin-only RPCs that enforce the is_admin() check

## 1. New Columns
### profiles.account_status (text, default 'Active')
- Values: 'Active', 'Restricted', 'Suspended'
- CHECK constraint enforces valid values
- Existing rows default to 'Active'

### profiles.status_reason (text, nullable)
- Optional note explaining why a user was restricted/suspended
- Set by admin when changing status

### profiles.status_updated_at (timestamptz, nullable)
- Timestamp of the last status change by admin

## 2. New Tables
### wallet_transactions
- Records every wallet balance change (deposit credit, admin add/deduct, gift, order debit, refund)
- Columns:
  - id (uuid PK)
  - user_id (uuid FK -> auth.users, NOT NULL)
  - type (text): 'deposit' | 'admin_add' | 'admin_deduct' | 'gift' | 'order_debit' | 'refund'
  - amount (numeric): positive = credit, negative = debit
  - balance_after (numeric): wallet balance after this transaction
  - note (text, nullable): reason/note for the transaction
  - admin_id (uuid, nullable): admin who initiated the change
  - created_at (timestamptz, default now())
- RLS enabled: users read own transactions, admins read all
- service_role granted for edge function access

## 3. New Functions (all SECURITY DEFINER, admin-only)
### admin_adjust_wallet(p_user_id uuid, p_amount numeric, p_note text, p_type text)
- Adds or deducts from a user's wallet. p_amount is always positive; p_type determines direction.
- Prevents balance from going negative.
- Records a wallet_transactions row.
- Returns the new balance.

### admin_send_gift(p_user_id uuid, p_amount numeric, p_title text)
- Credits gift balance to a user's wallet.
- Records a wallet_transactions row with type='gift'.

### admin_set_account_status(p_user_id uuid, p_status text, p_reason text)
- Sets account_status to 'Active', 'Restricted', or 'Suspended'.
- Sets status_reason and status_updated_at.
- Cannot be used to change own account (admin cannot suspend themselves).

### admin_get_user_stats(p_user_id uuid)
- Returns JSON with total_deposits, total_orders, deposit_count, order_count for a user.

## 4. Security
- RLS enabled on wallet_transactions.
- Grant SELECT on wallet_transactions to authenticated (owner-scoped + admin).
- Grant service_role on wallet_transactions for edge functions.
- All admin RPCs check is_admin() and REVOKE EXECUTE from PUBLIC/anon.
- profiles SELECT policy already allows admin reads; UPDATE remains blocked for clients (only admin RPCs can change it via SECURITY DEFINER).

## 5. Important Notes
1. The existing wallet_balance CHECK (>= 0) on profiles prevents negative balances at the DB level.
2. admin_adjust_wallet uses FOR UPDATE lock on the profile row to prevent race conditions.
3. Account status is enforced in place_order and deposit insert policies via a new helper function user_can_transact().
*/

-- ===== 1. Add account_status columns to profiles =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'Active'
    CHECK (account_status IN ('Active', 'Restricted', 'Suspended'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status_reason text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;

-- ===== 2. Create wallet_transactions table =====
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'admin_add', 'admin_deduct', 'gift', 'order_debit', 'refund')),
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  note text,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transactions, admins can read all
DROP POLICY IF EXISTS "Users can read own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can read own wallet transactions"
ON public.wallet_transactions FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- No direct client inserts/updates/deletes on wallet_transactions
DROP POLICY IF EXISTS "No direct insert wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "No direct insert wallet_transactions"
ON public.wallet_transactions FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "No direct update wallet_transactions"
ON public.wallet_transactions FOR UPDATE
TO authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct delete wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "No direct delete wallet_transactions"
ON public.wallet_transactions FOR DELETE
TO authenticated
USING (false);

-- Grants
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT SELECT, INSERT ON public.wallet_transactions TO service_role;

-- Index for user transaction lookups
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions (user_id, created_at DESC);

-- ===== 3. Helper: check if user can transact (not suspended/restricted) =====
CREATE OR REPLACE FUNCTION public.user_can_transact(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT account_status = 'Active' FROM public.profiles WHERE id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_transact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_transact(uuid) TO authenticated;

-- ===== 4. admin_adjust_wallet RPC =====
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_note text,
  p_type text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current numeric;
  v_new numeric;
  v_signed numeric;
  v_adjust_type text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_type NOT IN ('add', 'deduct') THEN
    RAISE EXCEPTION 'Invalid type. Use ''add'' or ''deduct''.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be a positive number';
  END IF;

  SELECT wallet_balance INTO v_current
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF p_type = 'add' THEN
    v_signed := p_amount;
    v_adjust_type := 'admin_add';
  ELSE
    v_signed := -p_amount;
    v_adjust_type := 'admin_deduct';
  END IF;

  v_new := v_current + v_signed;

  IF v_new < 0 THEN
    RAISE EXCEPTION 'Cannot deduct more than the current balance (₹%)', v_current;
  END IF;

  UPDATE public.profiles
  SET wallet_balance = v_new
  WHERE id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, note, admin_id)
  VALUES (p_user_id, v_adjust_type, v_signed, v_new, p_note, auth.uid());

  RETURN v_new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text, text) TO authenticated;

-- ===== 5. admin_send_gift RPC =====
CREATE OR REPLACE FUNCTION public.admin_send_gift(
  p_user_id uuid,
  p_amount numeric,
  p_title text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current numeric;
  v_new numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Gift amount must be a positive number';
  END IF;

  SELECT wallet_balance INTO v_current
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_new := v_current + p_amount;

  UPDATE public.profiles
  SET wallet_balance = v_new
  WHERE id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, note, admin_id)
  VALUES (p_user_id, 'gift', p_amount, v_new, p_title, auth.uid());

  RETURN v_new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_send_gift(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_gift(uuid, numeric, text) TO authenticated;

-- ===== 6. admin_set_account_status RPC =====
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  p_user_id uuid,
  p_status text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_status NOT IN ('Active', 'Restricted', 'Suspended') THEN
    RAISE EXCEPTION 'Invalid status. Use Active, Restricted, or Suspended.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own account status';
  END IF;

  UPDATE public.profiles
  SET account_status = p_status,
      status_reason = p_reason,
      status_updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text, text) TO authenticated;

-- ===== 7. admin_get_user_stats RPC =====
CREATE OR REPLACE FUNCTION public.admin_get_user_stats(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_deposits numeric;
  v_deposit_count integer;
  v_total_orders numeric;
  v_order_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(SUM(amount_inr), 0), COUNT(*)
  INTO v_total_deposits, v_deposit_count
  FROM public.deposit_requests
  WHERE user_id = p_user_id AND status = 'Approved';

  SELECT COALESCE(SUM(total_price), 0), COUNT(*)
  INTO v_total_orders, v_order_count
  FROM public.orders
  WHERE user_id = p_user_id;

  RETURN json_build_object(
    'total_deposits', v_total_deposits,
    'deposit_count', v_deposit_count,
    'total_orders', v_total_orders,
    'order_count', v_order_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_user_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_stats(uuid) TO authenticated;

-- ===== 8. Enforce account status in deposit insert =====
-- Add a check so restricted/suspended users cannot submit deposits
DROP POLICY IF EXISTS "Users can submit own deposit requests" ON public.deposit_requests;
CREATE POLICY "Users can submit own deposit requests"
ON public.deposit_requests FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'Pending'
  AND public.user_can_transact(auth.uid())
);

-- ===== 9. Enforce account status in order insert =====
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
CREATE POLICY "Users can insert own orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.user_can_transact(auth.uid())
);
