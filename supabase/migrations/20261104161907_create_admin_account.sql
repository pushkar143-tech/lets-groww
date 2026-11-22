/*
# Create the Lets Groww administrator account

1. Purpose
- Creates the admin sign-in account `letsgroww46@gmail.com` with password `prince143` inside Supabase Auth (`auth.users`).
- Confirms the email immediately so the user can sign in without an email round-trip.
- Promotes the auto-created profile row to role `admin` so the account can access `/admin/deposits`.

2. Accounts
- `auth.users` row: `letsgroww46@gmail.com`, email confirmed, authenticated role.
- `public.profiles` row (created by `handle_new_user` trigger): role set to `admin`.

3. Security
- No RLS changes.
- The password is hashed using `pgcrypto.crypt()` with a per-row salt, the same scheme Supabase Auth uses for `encrypted_password`.
- `confirmed_at` is a generated column, so it is intentionally omitted from the INSERT.
- This migration is idempotent: re-running it leaves the existing account and admin role intact.
*/

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'letsgroww46@gmail.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id,
      'authenticated',
      'authenticated',
      'letsgroww46@gmail.com',
      crypt('prince143', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('prince143', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.profiles (id, email, role)
  VALUES (v_user_id, 'letsgroww46@gmail.com', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;
END $$;
