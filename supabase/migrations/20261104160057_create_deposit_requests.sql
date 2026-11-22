/*
# Create deposit requests for UPI payments

1. New Tables
- `deposit_requests`
- `id` (uuid, primary key): unique identifier for each submitted deposit request.
- `amount_inr` (numeric): payment amount submitted in Indian rupees.
- `utr` (text): the user's 12-digit UTR / transaction ID.
- `status` (text): review status, automatically set to `Pending` for new requests.
- `created_at` (timestamptz): submission timestamp.

2. Validation
- Amount must be greater than zero.
- UTR must contain exactly 12 digits.
- Status is constrained to Pending, Approved, or Rejected.
- New requests always default to Pending.

3. Security
- Row Level Security is enabled.
- Anonymous and authenticated visitors may submit only the amount and UTR fields.
- The status and timestamps are not client-writable.
- No read, update, or delete access is exposed to the public client.

4. Important Notes
- This is a no-sign-in flow, so requests are intentionally accepted from the public payment page.
- Admin review can be added later through a protected admin workflow without changing the user submission form.
*/

CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_inr numeric(12, 2) NOT NULL CHECK (amount_inr > 0),
  utr text NOT NULL CHECK (utr ~ '^[0-9]{12}$'),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.deposit_requests FROM anon, authenticated;
GRANT INSERT (amount_inr, utr) ON TABLE public.deposit_requests TO anon, authenticated;

DROP POLICY IF EXISTS "Public can submit deposit requests" ON public.deposit_requests;
CREATE POLICY "Public can submit deposit requests"
ON public.deposit_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (status = 'Pending');

DROP POLICY IF EXISTS "Public cannot read deposit requests" ON public.deposit_requests;
CREATE POLICY "Public cannot read deposit requests"
ON public.deposit_requests
FOR SELECT
TO anon, authenticated
USING (false);

DROP POLICY IF EXISTS "Public cannot update deposit requests" ON public.deposit_requests;
CREATE POLICY "Public cannot update deposit requests"
ON public.deposit_requests
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Public cannot delete deposit requests" ON public.deposit_requests;
CREATE POLICY "Public cannot delete deposit requests"
ON public.deposit_requests
FOR DELETE
TO anon, authenticated
USING (false);
