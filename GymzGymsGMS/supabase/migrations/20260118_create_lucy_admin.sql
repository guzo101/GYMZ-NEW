-- CREATE NEW ADMIN USER: Lucy
-- Email: lucy@msafiristudios.com
-- Password: lucy123
-- Pre-approved and ready to use

DO $$
DECLARE
  new_user_id UUID;
  hashed_password TEXT;
BEGIN
  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();
  
  -- Create the auth user (with email confirmation)
  -- Note: Password will need to be set via Supabase Dashboard or API
  -- This creates a placeholder that can be activated
  
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_sent_at,
    confirmed_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'lucy@msafiristudios.com',
    crypt('lucy123', gen_salt('bf')), -- Bcrypt hash
    NOW(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"name":"Lucy"}',
    NOW(),
    NOW(),
    NOW(),
    NOW()
  );
  
  -- Create the public.users profile
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    status,
    membership_status,
    unique_id,
    thread_id,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    'lucy@msafiristudios.com',
    'Lucy',
    'admin',
    'active',
    'Active',
    'LUCY' || LPAD(floor(random() * 10000)::TEXT, 4, '0'),
    gen_random_uuid()::TEXT,
    NOW(),
    NOW()
  );
  
  RAISE NOTICE '✅ SUCCESS: Admin user created for lucy@msafiristudios.com';
  RAISE NOTICE '📧 Email: lucy@msafiristudios.com';
  RAISE NOTICE '🔑 Password: lucy123';
  RAISE NOTICE '🆔 User ID: %', new_user_id;
  RAISE NOTICE '✅ Email is pre-verified - user can log in immediately';
  
END $$;

-- Verify the user was created
SELECT 
  '✅ VERIFICATION' as status,
  u.id,
  u.email,
  u.name,
  u.role,
  u.status,
  au.email_confirmed_at as verified
FROM public.users u
JOIN auth.users au ON au.id = u.id
WHERE u.email = 'lucy@msafiristudios.com';
