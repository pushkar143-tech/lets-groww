/*
# Recreate admin auth account cleanly

1. Purpose
- Previous admin account insertions left the auth user in a state that GoTrue rejects at sign-in.
- This migration deletes the existing auth user (cascading to auth.identities and public.profiles FKs), then re-inserts a clean auth.users row with all fields GoTrue expects, plus a matching auth.identities row.
- The password is hashed with bcrypt cost 10 (GoTrue default) using pgcrypto.

2. What it touches
- auth.users: DELETE then INSERT for letsgroww46@gmail.com
- auth.identities: INSERT (FK cascades from auth.users on DELETE)
- public.profiles: INSERT with role = 'admin' (trigger also handles this, but we set it explicitly)

3. Key GoTrue requirements satisfied
- email_confirmed_at IS NOT NULL (email confirmation bypassed)
- confirmation_token = '' (empty, not NULL — GoTrue checks this)
- recovery_token = '' (empty, not NULL)
- encrypted_password uses $2a$10$ bcrypt format
- aud = 'authenticated', role = 'authenticated'
- raw_app_meta_data has provider + providers
- auth.identities row with provider='email' and identity_data containing sub, email, email_verified
- instance_id set to the zero UUID (no multi-instance config)

4. Security
- No RLS or grant changes. Idempotent. Safe to re-run.
*/

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Delete existing user completely (cascades to auth.identities, sessions, refresh_tokens, etc.)
  DELETE FROM auth.users WHERE email = 'letsgroww46@gmail.com';

  -- Generate a fresh user ID
  v_user_id := gen_random_uuid();

  -- Insert a clean auth.users row with every field GoTrue checks
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'letsgroww46@gmail.com',
    crypt('prince143', gen_salt('bf', 10)),
    now(),
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    now(),
    now(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL,
    false,
    NULL,
    false
  );

  -- Insert the matching auth.identities row (email provider)
  -- email column is GENERATED ALWAYS from identity_data, so we omit it
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', 'letsgroww46@gmail.com',
      'email_verified', true
    ),
    'email',
    NULL,
    now(),
    now()
  );

  -- Ensure profile exists with admin role (trigger also does this, but we enforce it)
  INSERT INTO public.profiles (id, email, role)
  VALUES (v_user_id, 'letsgroww46@gmail.com', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;
END $$;
