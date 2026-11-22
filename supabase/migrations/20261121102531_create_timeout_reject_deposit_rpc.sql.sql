/*
# Add timeout_reject_deposit RPC for user-initiated deposit cancellation

1. New Function
- `timeout_reject_deposit(p_deposit_id uuid)`
  - SECURITY DEFINER, callable by `authenticated` only.
  - Reverts a pending deposit to 'Rejected' status if the 3-minute verification window expires.
  - Only succeeds if the caller owns the deposit row (user_id = auth.uid()) and the row is still 'Pending'.
  - Returns jsonb `{ success: true/false, status: text }` so the caller can confirm the outcome.
  - Does NOT touch the wallet balance (no credit was ever applied for a pending deposit).

2. Security
- REVOKE EXECUTE from PUBLIC, anon. GRANT to authenticated only.
- Ownership check inside the function ensures a user can only reject their own pending deposits.
- The status check (`status = 'Pending'`) prevents rejecting an already-approved deposit, so the
  auto-verify webhook and manual admin approval always take precedence over the timeout.

3. Important Notes
- Idempotent: calling it on an already-rejected deposit is a no-op (returns { success: false }).
- Calling it on an approved deposit returns { success: false } without modifying anything.
- This function is invoked client-side when the 180-second countdown reaches zero.
*/

CREATE OR REPLACE FUNCTION public.timeout_reject_deposit(p_deposit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit public.deposit_requests;
BEGIN
  SELECT * INTO v_deposit
  FROM public.deposit_requests
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF v_deposit.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_found');
  END IF;

  -- Only the owner can reject their own deposit
  IF v_deposit.user_id IS NULL OR v_deposit.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Only pending deposits can be timed out
  IF v_deposit.status <> 'Pending' THEN
    RETURN jsonb_build_object('success', false, 'status', v_deposit.status);
  END IF;

  UPDATE public.deposit_requests
  SET status = 'Rejected'
  WHERE id = p_deposit_id;

  RETURN jsonb_build_object('success', true, 'status', 'Rejected');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.timeout_reject_deposit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.timeout_reject_deposit(uuid) TO authenticated;
