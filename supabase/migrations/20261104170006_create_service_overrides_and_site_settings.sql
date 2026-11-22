/*
# Create service_overrides and site_settings tables

1. New Tables
- `service_overrides`
  - `service_id` (integer, primary key — matches the id in services.ts)
  - `rate_override` (numeric, nullable — when set, replaces the default ratePer1000)
  - `discount_percent` (numeric, default 0 — percentage discount 0-100 applied on top of rate)
  - `is_visible` (boolean, default true — when false, service is hidden from the services page)
  - `updated_at` (timestamptz, default now())
- `site_settings` (single-row table)
  - `id` (integer, primary key, always 1)
  - `banner_text` (text, nullable — announcement text shown on homepage)
  - `banner_visible` (boolean, default false)
  - `updated_at` (timestamptz, default now())

2. Security — RLS + Grants
- Both tables: RLS enabled.
- `authenticated` can SELECT both tables (needed so the services page and homepage can read overrides).
- Only admin can INSERT/UPDATE/DELETE via SECURITY DEFINER RPCs.
- Direct UPDATE/DELETE denied to authenticated; all mutations go through RPCs.
- `service_role` granted full CRUD.

3. RPC Functions (SECURITY DEFINER)
- `upsert_service_override(p_service_id int, p_rate numeric, p_discount numeric, p_visible boolean)` — admin-only upsert.
- `update_site_banner(p_text text, p_visible boolean)` — admin-only update of the single settings row.
- Both REVOKE from PUBLIC/anon, GRANT to authenticated.

4. Important Notes
- service_overrides.service_id corresponds to the static IDs in services.ts (1000-1024).
- The frontend merges overrides on top of the static service list.
- A seed row for site_settings (id=1) is inserted so UPDATE always works.
- Idempotent: safe to re-run.
*/

CREATE TABLE IF NOT EXISTS public.service_overrides (
  service_id integer PRIMARY KEY,
  rate_override numeric(12,2),
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_overrides FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.service_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_overrides TO service_role;

DROP POLICY IF EXISTS "Anyone authenticated can read service overrides" ON public.service_overrides;
CREATE POLICY "Anyone authenticated can read service overrides"
  ON public.service_overrides FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "No direct insert to service overrides" ON public.service_overrides;
CREATE POLICY "No direct insert to service overrides"
  ON public.service_overrides FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update to service overrides" ON public.service_overrides;
CREATE POLICY "No direct update to service overrides"
  ON public.service_overrides FOR UPDATE
  TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct delete from service overrides" ON public.service_overrides;
CREATE POLICY "No direct delete from service overrides"
  ON public.service_overrides FOR DELETE
  TO authenticated
  USING (false);

CREATE TABLE IF NOT EXISTS public.site_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  banner_text text,
  banner_visible boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.site_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO service_role;

DROP POLICY IF EXISTS "Anyone authenticated can read site settings" ON public.site_settings;
CREATE POLICY "Anyone authenticated can read site settings"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "No direct insert to site settings" ON public.site_settings;
CREATE POLICY "No direct insert to site settings"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update to site settings" ON public.site_settings;
CREATE POLICY "No direct update to site settings"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct delete from site settings" ON public.site_settings;
CREATE POLICY "No direct delete from site settings"
  ON public.site_settings FOR DELETE
  TO authenticated
  USING (false);

INSERT INTO public.site_settings (id, banner_text, banner_visible)
VALUES (1, NULL, false)
ON CONFLICT (id) DO NOTHING;

-- Upsert service override (admin only)
CREATE OR REPLACE FUNCTION public.upsert_service_override(
  p_service_id integer,
  p_rate numeric,
  p_discount numeric,
  p_visible boolean
)
RETURNS public.service_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_overrides;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.service_overrides (service_id, rate_override, discount_percent, is_visible, updated_at)
  VALUES (p_service_id, p_rate, p_discount, p_visible, now())
  ON CONFLICT (service_id) DO UPDATE
  SET rate_override = EXCLUDED.rate_override,
      discount_percent = EXCLUDED.discount_percent,
      is_visible = EXCLUDED.is_visible,
      updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Update site banner (admin only)
CREATE OR REPLACE FUNCTION public.update_site_banner(
  p_text text,
  p_visible boolean
)
RETURNS public.site_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.site_settings;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.site_settings (id, banner_text, banner_visible, updated_at)
  VALUES (1, p_text, p_visible, now())
  ON CONFLICT (id) DO UPDATE
  SET banner_text = EXCLUDED.banner_text,
      banner_visible = EXCLUDED.banner_visible,
      updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_service_override(integer, numeric, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_service_override(integer, numeric, numeric, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_site_banner(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_site_banner(text, boolean) TO authenticated;
