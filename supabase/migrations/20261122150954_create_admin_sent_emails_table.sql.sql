/*
# Admin Sent Emails Audit Table

## Purpose
Stores a log of every email sent by an admin to a user, for audit and in-app notification display.

## 1. New Table: admin_sent_emails
- id (uuid PK)
- user_id (uuid FK -> auth.users, nullable — allows emails to addresses not tied to an account)
- to_email (text, NOT NULL) — recipient email
- subject (text, NOT NULL)
- message (text, NOT NULL)
- admin_id (uuid FK -> auth.users — the admin who sent it)
- created_at (timestamptz, default now())

## 2. Security
- RLS enabled
- Only admins can read (SELECT) — via is_admin() check
- No direct client INSERT/UPDATE/DELETE — only the send-email edge function (service_role) writes
- Grants: SELECT to authenticated (admin-scoped), INSERT to service_role
*/

CREATE TABLE IF NOT EXISTS public.admin_sent_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_sent_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read sent emails" ON public.admin_sent_emails;
CREATE POLICY "Admins can read sent emails"
ON public.admin_sent_emails FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "No direct insert sent emails" ON public.admin_sent_emails;
CREATE POLICY "No direct insert sent emails"
ON public.admin_sent_emails FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update sent emails" ON public.admin_sent_emails;
CREATE POLICY "No direct update sent emails"
ON public.admin_sent_emails FOR UPDATE
TO authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct delete sent emails" ON public.admin_sent_emails;
CREATE POLICY "No direct delete sent emails"
ON public.admin_sent_emails FOR DELETE
TO authenticated
USING (false);

GRANT SELECT ON public.admin_sent_emails TO authenticated;
GRANT INSERT ON public.admin_sent_emails TO service_role;

CREATE INDEX IF NOT EXISTS idx_admin_sent_emails_user_id ON public.admin_sent_emails (user_id, created_at DESC);
