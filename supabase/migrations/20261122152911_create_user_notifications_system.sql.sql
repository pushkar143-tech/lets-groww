/*
# User Notifications System

## Purpose
Adds a complete notification system for Lets Groww:
- Personal messages (from admin to a specific user)
- Broadcast offers/announcements (from admin to ALL users)
- Warning messages (when admin warns a user)
- Read tracking per user
- Realtime-compatible tables for instant updates

## 1. New Tables

### user_notifications
- Stores all notifications (personal + broadcast)
- Columns:
  - id (uuid PK)
  - type (text): 'personal' | 'broadcast' | 'warning' | 'gift'
  - user_id (uuid, nullable): NULL for broadcast (all users), set for personal/warning
  - title (text, NOT NULL)
  - message (text, NOT NULL)
  - admin_id (uuid, nullable): admin who sent it
  - created_at (timestamptz, default now())
- RLS: admins can read all, users can read their own + broadcasts

### notification_reads
- Tracks which notifications each user has read
- Columns:
  - id (uuid PK)
  - notification_id (uuid FK -> user_notifications, NOT NULL)
  - user_id (uuid FK -> auth.users, NOT NULL)
  - read_at (timestamptz, default now())
- Unique constraint on (notification_id, user_id)
- RLS: users can read/insert their own rows only

## 2. New Functions (all SECURITY DEFINER, admin-only for writes)

### admin_send_personal_notification(p_user_id, p_title, p_message, p_type)
- Sends a notification to a specific user
- type defaults to 'personal' but can be 'warning' or 'gift'
- Returns the notification id

### admin_send_broadcast_notification(p_title, p_message)
- Sends a broadcast notification visible to ALL users
- user_id is NULL (broadcast)
- Returns the notification id

### get_user_notifications(p_limit)
- Returns notifications for the calling user: their personal ones + all broadcasts
- Joins with notification_reads to add an `is_read` boolean
- Ordered by created_at DESC
- SECURITY DEFINER so it can access broadcast rows (user_id IS NULL)

### mark_notification_read(p_notification_id)
- Marks a notification as read for the calling user
- Inserts into notification_reads (idempotent via ON CONFLICT)
- SECURITY DEFINER to safely upsert

## 3. Security
- user_notifications: SELECT for authenticated (own + broadcast via policy), INSERT/UPDATE/DELETE blocked for clients
- notification_reads: SELECT for authenticated (own only), INSERT for authenticated (own only)
- All admin RPCs check is_admin() and REVOKE from PUBLIC/anon
- service_role granted for edge functions
*/

-- ===== 1. user_notifications table =====
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'personal' CHECK (type IN ('personal', 'broadcast', 'warning', 'gift')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own personal notifications + all broadcasts
DROP POLICY IF EXISTS "Users can read own and broadcast notifications" ON public.user_notifications;
CREATE POLICY "Users can read own and broadcast notifications"
ON public.user_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL OR public.is_admin());

-- No direct client writes
DROP POLICY IF EXISTS "No direct insert notifications" ON public.user_notifications;
CREATE POLICY "No direct insert notifications"
ON public.user_notifications FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update notifications" ON public.user_notifications;
CREATE POLICY "No direct update notifications"
ON public.user_notifications FOR UPDATE
TO authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct delete notifications" ON public.user_notifications;
CREATE POLICY "No direct delete notifications"
ON public.user_notifications FOR DELETE
TO authenticated
USING (false);

GRANT SELECT ON public.user_notifications TO authenticated;
GRANT SELECT, INSERT ON public.user_notifications TO service_role;

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_broadcast ON public.user_notifications (created_at DESC) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON public.user_notifications (type);

-- ===== 2. notification_reads table =====
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.user_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Users can read their own read-status rows
DROP POLICY IF EXISTS "Users can read own notification reads" ON public.notification_reads;
CREATE POLICY "Users can read own notification reads"
ON public.notification_reads FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own read-status (mark as read)
DROP POLICY IF EXISTS "Users can insert own notification reads" ON public.notification_reads;
CREATE POLICY "Users can insert own notification reads"
ON public.notification_reads FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- No updates or deletes by clients
DROP POLICY IF EXISTS "No direct update notification reads" ON public.notification_reads;
CREATE POLICY "No direct update notification reads"
ON public.notification_reads FOR UPDATE
TO authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct delete notification reads" ON public.notification_reads;
CREATE POLICY "No direct delete notification reads"
ON public.notification_reads FOR DELETE
TO authenticated
USING (false);

GRANT SELECT, INSERT ON public.notification_reads TO authenticated;
GRANT SELECT, INSERT ON public.notification_reads TO service_role;

CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads (user_id);

-- ===== 3. admin_send_personal_notification RPC =====
CREATE OR REPLACE FUNCTION public.admin_send_personal_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'personal'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_type NOT IN ('personal', 'warning', 'gift') THEN
    RAISE EXCEPTION 'Invalid notification type for personal message';
  END IF;

  INSERT INTO public.user_notifications (type, user_id, title, message, admin_id)
  VALUES (p_type, p_user_id, p_title, p_message, auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_send_personal_notification(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_personal_notification(uuid, text, text, text) TO authenticated;

-- ===== 4. admin_send_broadcast_notification RPC =====
CREATE OR REPLACE FUNCTION public.admin_send_broadcast_notification(
  p_title text,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.user_notifications (type, user_id, title, message, admin_id)
  VALUES ('broadcast', NULL, p_title, p_message, auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_send_broadcast_notification(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_broadcast_notification(text, text) TO authenticated;

-- ===== 5. get_user_notifications RPC =====
-- Returns notifications for the calling user (personal + broadcast) with is_read flag
CREATE OR REPLACE FUNCTION public.get_user_notifications(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  type text,
  title text,
  message text,
  created_at timestamptz,
  is_read boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.type,
    n.title,
    n.message,
    n.created_at,
    EXISTS (
      SELECT 1 FROM public.notification_reads r
      WHERE r.notification_id = n.id AND r.user_id = auth.uid()
    ) AS is_read
  FROM public.user_notifications n
  WHERE n.user_id = auth.uid() OR n.user_id IS NULL
  ORDER BY n.created_at DESC
  LIMIT LEAST(p_limit, 200);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_notifications(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_notifications(integer) TO authenticated;

-- ===== 6. mark_notification_read RPC =====
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notification_reads (notification_id, user_id)
  VALUES (p_notification_id, auth.uid())
  ON CONFLICT (notification_id, user_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
