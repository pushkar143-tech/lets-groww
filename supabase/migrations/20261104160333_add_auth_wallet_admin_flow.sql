/*
# Add authenticated wallets and admin deposit review

1. New Tables
- `profiles`
- `id` (uuid, primary key): matches the Supabase Auth user.
- `email` (text): account email shown to administrators.
- `role` (text): protected account role, either `user` or `admin`.
- `wallet_balance` (numeric): wallet balance in INR, changed only by trusted server logic.
- `created_at` (timestamptz): profile creation timestamp.

2. Modified Tables
- `deposit_requests`
- `user_id` (uuid): authenticated owner of the request; defaults from the current session.
- Existing anonymous requests remain intact with a null owner for data safety.
- New authenticated submissions are linked to the submitting account.

3. Trusted Operations
- New users receive a profile automatically after signup.
- `approve_deposit` verifies the caller is an admin, allows only Pending requests, marks the request Approved or Rejected, and atomically credits the owner's wallet only on approval.

4. Security
- Row Level Security is enabled on profiles and deposit requests.
- Users can read only their own profile and deposit requests.
- Administrators can read all profiles and deposit requests.
- Users cannot write wallet balances, roles, request status, or request ownership.
- The approval function is callable only by authenticated users and performs its own admin check.

5. Realtime
- Wallet profiles and deposit requests are added to Supabase Realtime so balance and admin lists refresh without a page reload.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  wallet_balance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (wallet_balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.deposit_requests
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.deposit_requests
  ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid, p_approve boolean)
RETURNS public.deposit_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit public.deposit_requests;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_deposit
  FROM public.deposit_requests
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF v_deposit.id IS NULL THEN
    RAISE EXCEPTION 'Deposit not found';
  END IF;

  IF v_deposit.status <> 'Pending' THEN
    RAISE EXCEPTION 'Deposit already reviewed';
  END IF;

  UPDATE public.deposit_requests
  SET status = CASE WHEN p_approve THEN 'Approved' ELSE 'Rejected' END
  WHERE id = p_deposit_id
  RETURNING * INTO v_deposit;

  IF p_approve AND v_deposit.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + v_deposit.amount_inr
    WHERE id = v_deposit.user_id;
  END IF;

  RETURN v_deposit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_deposit(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid, boolean) TO authenticated;

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;

REVOKE ALL ON TABLE public.deposit_requests FROM anon, authenticated;
GRANT SELECT ON public.deposit_requests TO authenticated;
GRANT INSERT (amount_inr, utr) ON public.deposit_requests TO authenticated;

DROP POLICY IF EXISTS "Public can submit deposit requests" ON public.deposit_requests;
DROP POLICY IF EXISTS "Public cannot read deposit requests" ON public.deposit_requests;
DROP POLICY IF EXISTS "Public cannot update deposit requests" ON public.deposit_requests;
DROP POLICY IF EXISTS "Public cannot delete deposit requests" ON public.deposit_requests;

DROP POLICY IF EXISTS "Users can submit own deposit requests" ON public.deposit_requests;
CREATE POLICY "Users can submit own deposit requests"
ON public.deposit_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'Pending');

DROP POLICY IF EXISTS "Users and admins can read deposits" ON public.deposit_requests;
CREATE POLICY "Users and admins can read deposits"
ON public.deposit_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Deposits cannot be updated directly" ON public.deposit_requests;
CREATE POLICY "Deposits cannot be updated directly"
ON public.deposit_requests FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deposits cannot be deleted" ON public.deposit_requests;
CREATE POLICY "Deposits cannot be deleted"
ON public.deposit_requests FOR DELETE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "Users and admins can read profiles" ON public.profiles;
CREATE POLICY "Users and admins can read profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Profiles cannot be inserted by clients" ON public.profiles;
CREATE POLICY "Profiles cannot be inserted by clients"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "Profiles cannot be updated by clients" ON public.profiles;
CREATE POLICY "Profiles cannot be updated by clients"
ON public.profiles FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Profiles cannot be deleted by clients" ON public.profiles;
CREATE POLICY "Profiles cannot be deleted by clients"
ON public.profiles FOR DELETE
TO authenticated
USING (false);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'deposit_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_requests;
  END IF;
END $$;
