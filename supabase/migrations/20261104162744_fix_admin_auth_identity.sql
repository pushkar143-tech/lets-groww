/*
# Fix admin auth identity and rehash password

1. Purpose
- The admin account `letsgroww46@gmail.com` exists in `auth.users` with a valid bcrypt password hash, but sign-in fails because the account has no row in `auth.identities`.
- Supabase Auth (GoTrue) requires an `auth.identities` row for the `email` provider; without it, `signInWithPassword` rejects the request even when the password hash matches.
- This migration creates the missing identity row and rehashes the password with bcrypt cost factor 10 (Supabase Auth default) for maximum compatibility.

2. Changes
- `auth.identities`: insert provider=`email` row for the admin user, keyed on the unique `(provider_id, provider)` constraint. `email` is a generated column and is intentionally omitted.
- `auth.users`: update `encrypted_password` to a fresh bcrypt($2a$10$) hash of `prince143`.
- `public.profiles`: ensure role remains `admin`.

3. Security
- No RLS changes. No new grants. Password is rehashed server-side only.
- Idempotent: safe to re-run.
*/

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'letsgroww46@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Admin auth user not found';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt('prince143', gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'letsgroww46@gmail.com', 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE
  SET identity_data = EXCLUDED.identity_data,
      updated_at = now();

  INSERT INTO public.profiles (id, email, role)
  VALUES (v_user_id, 'letsgroww46@gmail.com', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;
END $$;
