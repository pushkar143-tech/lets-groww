/*
# Add server-side auto-verify deposit function

1. New Functions
- `auto_verify_deposit(p_utr text, p_amount numeric)`
  - SECURITY DEFINER, callable only by `service_role` (the edge function uses the service role key).
  - Searches `deposit_requests` for a Pending row whose `utr` matches `p_utr` exactly.
  - If no UTR match, falls back to a Pending row whose `amount_inr` equals `p_amount` and was created within the last 3 minutes.
  - Atomically marks the matched row Approved and credits the owner's `wallet_balance` (only when a `user_id` is present).
  - Returns a JSON object `{ found, deposit_id, user_id, amount, status }` so the edge function can report the result.
  - If no match is found, returns `{ found: false }` without raising, so the webhook responds gracefully.

2. Security
- `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` — only `service_role` may call it.
- The edge function validates the `secret_key` against a stored secret BEFORE calling this RPC, so the secret check lives at the API boundary.
- No changes to existing RLS policies or grants. The manual `approve_deposit` admin flow remains intact as a backup.

3. Important Notes
- The function is idempotent against re-delivery: a row already Approved/Rejected is skipped (the WHERE clause filters on `status = 'Pending'`), so a duplicate webhook does not double-credit the wallet.
- Amount fallback is intentionally narrow (exact amount, last 3 minutes) to avoid matching an unrelated pending deposit.
*/

CREATE OR REPLACE FUNCTION public.auto_verify_deposit(p_utr text, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit public.deposit_requests;
BEGIN
  -- Try exact UTR match first (primary path)
  SELECT * INTO v_deposit
  FROM public.deposit_requests
  WHERE utr = p_utr
    AND status = 'Pending'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  -- Fallback: exact amount within the last 3 minutes
  IF v_deposit.id IS NULL THEN
    SELECT * INTO v_deposit
    FROM public.deposit_requests
    WHERE amount_inr = p_amount
      AND status = 'Pending'
      AND created_at >= now() - interval '3 minutes'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_deposit.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  UPDATE public.deposit_requests
  SET status = 'Approved'
  WHERE id = v_deposit.id
  RETURNING * INTO v_deposit;

  IF v_deposit.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + v_deposit.amount_inr
    WHERE id = v_deposit.user_id;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'deposit_id', v_deposit.id,
    'user_id', v_deposit.user_id,
    'amount', v_deposit.amount_inr,
    'status', v_deposit.status
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_verify_deposit(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_verify_deposit(text, numeric) TO service_role;
