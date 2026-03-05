-- Clean up existing user if any
BEGIN;
DELETE FROM public.users WHERE email = 'lucy@msafiristudios.com';
DELETE FROM auth.users WHERE email = 'lucy@msafiristudios.com';
COMMIT;

-- Ensure pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CREATE NEW ADMIN USER: Lucy
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  new_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_sent_at, confirmed_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', 
    'lucy@msafiristudios.com', crypt('lucy123', gen_salt('bf')), 
    NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Lucy"}', 
    NOW(), NOW(), NOW(), NOW()
  );
  
  INSERT INTO public.users (
    id, email, name, role, status, membership_status, 
    unique_id, created_at, updated_at
  ) VALUES (
    new_user_id, 'lucy@msafiristudios.com', 'Lucy Admin', 'admin', 'Active', 'Active', 
    'LUCYADMIN', NOW(), NOW()
  );
  
  RAISE NOTICE 'Lucy Admin Created: %', new_user_id;
END $$;
