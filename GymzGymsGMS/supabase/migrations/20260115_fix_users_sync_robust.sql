-- Migration: Robust User Sync 
-- Ensures all Auth users have a corresponding record in public.users, even if metadata is missing.
-- Fixes the foreign key constraint error in the payments table.

-- 1. Create or replace a more robust sync function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
BEGIN
    -- Fallback for name: full_name -> name -> email prefix -> 'User'
    user_name := COALESCE(
        new.raw_user_meta_data->>'full_name', 
        new.raw_user_meta_data->>'name', 
        split_part(new.email, '@', 1), 
        'User'
    );

    INSERT INTO public.users (id, email, name, role)
    VALUES (new.id, new.email, user_name, 'member')
    ON CONFLICT (id) DO UPDATE 
    SET 
        email = excluded.email,
        name = COALESCE(public.users.name, excluded.name);
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure trigger is bound
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. SYNC EXISTING USERS (The "Zombie" Cleanup)
-- This catches anyone who signed up while the trigger was broken or missing.
INSERT INTO public.users (id, email, name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1), 'User'),
    'member'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. ALIGN EMAILS (In case some users were created in public.users manually with a different ID)
-- This is rare but helps with consistency
INSERT INTO public.users (id, email, name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1), 'User'),
    'member'
FROM auth.users
ON CONFLICT (email) DO UPDATE 
SET id = excluded.id;

NOTIFY pgrst, 'reload schema';
