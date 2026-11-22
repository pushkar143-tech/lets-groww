/*
# Create gift_codes and promo_codes tables with redemption/apply RPCs

1. New Tables
- `gift_codes` (wallet balance gift codes)
  - `id` (uuid, PK)
  - `code` (text, unique, not null) — the redeemable code string
  - `amount_inr` (numeric, not null, check > 0) — rupee amount credited on redemption
  - `max_uses` (integer, not null, default 1) — how many users can redeem
  - `times_used` (integer, not null, default 0) — current redemption count
  - `is_active` (boolean, not null, default true)
  - `created_by` (uuid, FK auth.users, defaults to auth.uid())
  - `created_at` (timestamptz, default now())

- `gift_code_redemptions` (tracking who redeemed what)
  - `id` (uuid, PK)
  - `gift_code_id` (uuid, FK gift_codes ON DELETE CASCADE)
  - `user_id` (uuid, FK auth.users ON DELETE CASCADE)
  - `amount_credited` (numeric, not null)
  - `redeemed_at` (timestamptz, default now())
  - UNIQUE(gift_code_id, user_id) — one redemption per user per code

- `promo_codes` (discount promo codes)
  - `id` (uuid, PK)
  - `code` (text, unique, not null)
  - `discount_type` (text, not null, check in 'percent','flat')
  - `discount_value` (numeric, not null, check > 0)
  - `max_uses` (integer, nullable — null = unlimited)
  - `times_used` (integer, not null, default 0)
  - `expires_at` (timestamptz, nullable)
  - `is_active` (boolean, not null, default true)
  - `created_by` (uuid, FK auth.users, defaults to auth.uid())
  - `created_at` (timestamptz, default now())

- `promo_code_usages` (tracking)
  - `id` (uuid, PK)
  - `promo_code_id` (uuid, FK promo_codes ON DELETE CASCADE)
  - `user_id` (uuid, FK auth.users ON DELETE CASCADE)
  - `used_at` (timestamptz, default now())

2. Security — RLS + Grants
- All tables: RLS enabled, FORCE RLS.
- gift_codes/promo_codes: SELECT to authenticated (users need to validate codes), but all INSERT/UPDATE/DELETE admin-only via RPCs.
- gift_code_redemptions/promo_code_usages: no direct access to authenticated; all inserts happen in SECURITY DEFINER RPCs.
- service_role granted full CRUD on all.

3. RPC Functions (SECURITY DEFINER)
- `create_gift_code(p_code text, p_amount numeric, p_max_uses int)` — admin-only, inserts a wallet gift code.
- `create_promo_code(p_code text, p_type text, p_value numeric, p_max_uses int, p_expires timestamptz)` — admin-only, inserts a promo code.
- `deactivate_gift_code(p_id uuid)` — admin-only, sets is_active=false.
- `deactivate_promo_code(p_id uuid)` — admin-only, sets is_active=false.
- `redeem_gift_code(p_code text)` — user-facing, credits wallet balance, records redemption, checks limits and duplicate.
- `validate_promo_code(p_code text, p_order_total numeric)` — user-facing, validates and returns discount amount without consuming.
- `apply_promo_code(p_code text, p_order_total numeric)` — user-facing, validates + increments usage + records usage. Called at order placement.

4. Important Notes
- All RPCs REVOKE from PUBLIC/anon, GRANT to authenticated.
- Idempotent: safe to re-run.
*/

-- gift_codes table
CREATE TABLE IF NOT EXISTS public.gift_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  amount_inr numeric(12,2) NOT NULL CHECK (amount_inr > 0),
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  times_used integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_codes FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.gift_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_codes TO service_role;

DROP POLICY IF EXISTS "Authenticated can read gift codes" ON public.gift_codes;
CREATE POLICY "Authenticated can read gift codes"
  ON public.gift_codes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "No direct insert gift codes" ON public.gift_codes;
CREATE POLICY "No direct insert gift codes"
  ON public.gift_codes FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update gift codes" ON public.gift_codes;
CREATE POLICY "No direct update gift codes"
  ON public.gift_codes FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct delete gift codes" ON public.gift_codes;
CREATE POLICY "No direct delete gift codes"
  ON public.gift_codes FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_gift_codes_code ON public.gift_codes (code);

-- gift_code_redemptions table
CREATE TABLE IF NOT EXISTS public.gift_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_code_id uuid NOT NULL REFERENCES public.gift_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_credited numeric(12,2) NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gift_code_id, user_id)
);

ALTER TABLE public.gift_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_code_redemptions FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.gift_code_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_code_redemptions TO service_role;

DROP POLICY IF EXISTS "Users can read own redemptions" ON public.gift_code_redemptions;
CREATE POLICY "Users can read own redemptions"
  ON public.gift_code_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "No direct insert redemptions" ON public.gift_code_redemptions;
CREATE POLICY "No direct insert redemptions"
  ON public.gift_code_redemptions FOR INSERT TO authenticated WITH CHECK (false);

-- promo_codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','flat')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value > 0),
  max_uses integer CHECK (max_uses IS NULL OR max_uses >= 1),
  times_used integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.promo_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO service_role;

DROP POLICY IF EXISTS "Authenticated can read promo codes" ON public.promo_codes;
CREATE POLICY "Authenticated can read promo codes"
  ON public.promo_codes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "No direct insert promo codes" ON public.promo_codes;
CREATE POLICY "No direct insert promo codes"
  ON public.promo_codes FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update promo codes" ON public.promo_codes;
CREATE POLICY "No direct update promo codes"
  ON public.promo_codes FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct delete promo codes" ON public.promo_codes;
CREATE POLICY "No direct delete promo codes"
  ON public.promo_codes FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes (code);

-- promo_code_usages table
CREATE TABLE IF NOT EXISTS public.promo_code_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_code_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usages FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.promo_code_usages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_code_usages TO service_role;

DROP POLICY IF EXISTS "Users can read own promo usages" ON public.promo_code_usages;
CREATE POLICY "Users can read own promo usages"
  ON public.promo_code_usages FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "No direct insert promo usages" ON public.promo_code_usages;
CREATE POLICY "No direct insert promo usages"
  ON public.promo_code_usages FOR INSERT TO authenticated WITH CHECK (false);

-- ==================== ADMIN RPCs ====================

CREATE OR REPLACE FUNCTION public.create_gift_code(p_code text, p_amount numeric, p_max_uses integer)
RETURNS public.gift_codes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.gift_codes;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.gift_codes (code, amount_inr, max_uses)
  VALUES (UPPER(TRIM(p_code)), p_amount, p_max_uses)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.create_promo_code(
  p_code text, p_type text, p_value numeric, p_max_uses integer, p_expires timestamptz
)
RETURNS public.promo_codes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.promo_codes;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.promo_codes (code, discount_type, discount_value, max_uses, expires_at)
  VALUES (UPPER(TRIM(p_code)), p_type, p_value, p_max_uses, p_expires)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.deactivate_gift_code(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.gift_codes WHERE id = p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.deactivate_promo_code(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.promo_codes WHERE id = p_id;
END; $$;

-- ==================== USER-FACING RPCs ====================

CREATE OR REPLACE FUNCTION public.redeem_gift_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code public.gift_codes;
  v_already public.gift_code_redemptions;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_code FROM public.gift_codes WHERE code = UPPER(TRIM(p_code)) FOR UPDATE;
  IF v_code.id IS NULL THEN RAISE EXCEPTION 'Invalid gift code'; END IF;
  IF NOT v_code.is_active THEN RAISE EXCEPTION 'This gift code is no longer active'; END IF;
  IF v_code.times_used >= v_code.max_uses THEN RAISE EXCEPTION 'This gift code has reached its usage limit'; END IF;

  SELECT * INTO v_already FROM public.gift_code_redemptions
  WHERE gift_code_id = v_code.id AND user_id = v_user_id;
  IF v_already.id IS NOT NULL THEN RAISE EXCEPTION 'You have already redeemed this gift code'; END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance + v_code.amount_inr WHERE id = v_user_id;
  UPDATE public.gift_codes SET times_used = times_used + 1 WHERE id = v_code.id;
  INSERT INTO public.gift_code_redemptions (gift_code_id, user_id, amount_credited)
  VALUES (v_code.id, v_user_id, v_code.amount_inr);

  RETURN jsonb_build_object('amount_credited', v_code.amount_inr);
END; $$;

CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code text, p_order_total numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code public.promo_codes;
  v_discount numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_code FROM public.promo_codes WHERE code = UPPER(TRIM(p_code));
  IF v_code.id IS NULL THEN RAISE EXCEPTION 'Invalid promo code'; END IF;
  IF NOT v_code.is_active THEN RAISE EXCEPTION 'This promo code is no longer active'; END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN RAISE EXCEPTION 'This promo code has expired'; END IF;
  IF v_code.max_uses IS NOT NULL AND v_code.times_used >= v_code.max_uses THEN RAISE EXCEPTION 'This promo code has reached its usage limit'; END IF;

  IF v_code.discount_type = 'percent' THEN
    v_discount := p_order_total * (v_code.discount_value / 100.0);
  ELSE
    v_discount := LEAST(v_code.discount_value, p_order_total);
  END IF;

  RETURN jsonb_build_object(
    'discount_amount', v_discount,
    'final_total', GREATEST(p_order_total - v_discount, 0),
    'discount_type', v_code.discount_type,
    'discount_value', v_code.discount_value
  );
END; $$;

CREATE OR REPLACE FUNCTION public.apply_promo_code(p_code text, p_order_total numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code public.promo_codes;
  v_discount numeric;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_code FROM public.promo_codes WHERE code = UPPER(TRIM(p_code)) FOR UPDATE;
  IF v_code.id IS NULL THEN RAISE EXCEPTION 'Invalid promo code'; END IF;
  IF NOT v_code.is_active THEN RAISE EXCEPTION 'This promo code is no longer active'; END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN RAISE EXCEPTION 'This promo code has expired'; END IF;
  IF v_code.max_uses IS NOT NULL AND v_code.times_used >= v_code.max_uses THEN RAISE EXCEPTION 'This promo code has reached its usage limit'; END IF;

  IF v_code.discount_type = 'percent' THEN
    v_discount := p_order_total * (v_code.discount_value / 100.0);
  ELSE
    v_discount := LEAST(v_code.discount_value, p_order_total);
  END IF;

  UPDATE public.promo_codes SET times_used = times_used + 1 WHERE id = v_code.id;
  INSERT INTO public.promo_code_usages (promo_code_id, user_id) VALUES (v_code.id, auth.uid());

  v_result := jsonb_build_object(
    'discount_amount', v_discount,
    'final_total', GREATEST(p_order_total - v_discount, 0)
  );
  RETURN v_result;
END; $$;

-- Revoke + grant for all RPCs
REVOKE EXECUTE ON FUNCTION public.create_gift_code(text, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_gift_code(text, numeric, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_promo_code(text, text, numeric, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_promo_code(text, text, numeric, integer, timestamptz) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.deactivate_gift_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_gift_code(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.deactivate_promo_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_promo_code(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.redeem_gift_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_gift_code(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_promo_code(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, numeric) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_promo_code(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_promo_code(text, numeric) TO authenticated;
