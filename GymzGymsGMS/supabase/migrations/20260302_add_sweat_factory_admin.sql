-- ============================================================================
-- GYMZ: Add Sweat Factory Admin User
-- Email: adminsf@gmail.com
-- Password: Admin@123
-- Associated with: Sweat Factory (looked up by gym name)
-- ============================================================================

-- Ensure pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  new_user_id UUID;
  sweat_factory_gym_id UUID;
BEGIN
  -- Look up gym ID by name "Sweat Factory" (matches "Sweat Factory" or "The Sweat Factory")
  SELECT id INTO sweat_factory_gym_id
  FROM public.gyms
  WHERE name ILIKE '%Sweat Factory%'
  ORDER BY CASE WHEN name ILIKE 'Sweat Factory' THEN 0 ELSE 1 END
  LIMIT 1;

  IF sweat_factory_gym_id IS NULL THEN
    RAISE EXCEPTION 'Gym "Sweat Factory" not found in public.gyms. Create the gym first.';
  END IF;
  -- Skip if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'adminsf@gmail.com') THEN
    RAISE NOTICE 'User adminsf@gmail.com already exists. Skipping creation.';
    RETURN;
  END IF;

  new_user_id := gen_random_uuid();

  -- Create the auth user (pre-verified, ready to log in)
  -- Note: confirmed_at and confirmation_sent_at are generated columns in Supabase auth
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'adminsf@gmail.com',
    crypt('Admin@123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Sweat Factory Admin"}',
    NOW(),
    NOW()
  );

  -- Create the public.users profile, associated with Sweat Factory
  INSERT INTO public.users (
    id, email, name, role, status, membership_status,
    gym_id, unique_id, thread_id, created_at, updated_at
  ) VALUES (
    new_user_id,
    'adminsf@gmail.com',
    'Sweat Factory Admin',
    'admin',
    'active',
    'Active',
    sweat_factory_gym_id,
    'SFADMIN' || LPAD(floor(random() * 10000)::TEXT, 4, '0'),
    gen_random_uuid()::TEXT,
    NOW(),
    NOW()
  );

  RAISE NOTICE '✅ SUCCESS: Sweat Factory admin created';
  RAISE NOTICE '📧 Email: adminsf@gmail.com';
  RAISE NOTICE '🔑 Password: Admin@123';
  RAISE NOTICE '🏋️ Gym: Sweat Factory (%)', sweat_factory_gym_id;
  RAISE NOTICE '🆔 User ID: %', new_user_id;
END $$;

-- Verify the user was created
SELECT
  '✅ VERIFICATION' AS status,
  u.id,
  u.email,
  u.name,
  u.role,
  u.gym_id,
  g.name AS gym_name
FROM public.users u
LEFT JOIN public.gyms g ON g.id = u.gym_id
WHERE u.email = 'adminsf@gmail.com';
