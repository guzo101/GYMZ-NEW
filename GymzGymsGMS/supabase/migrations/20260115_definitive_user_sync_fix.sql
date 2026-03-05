-- =================================================================
-- DEFINITIVE AUTH SYNC FIX
-- 1. Cleans up any broken triggers/functions
-- 2. Creates a robust sync function that handles metadata
-- 3. Sets up a bulletproof permissions model
-- 4. Backfills any missing "zombie" users immediately
-- =================================================================

-- 1. RESET: Drop existing conflicting objects to ensure clean slate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. FUNCTION: Create the robust sync function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
    user_role TEXT := 'member';
BEGIN
    -- Extract name with fallbacks: metadata -> email prefix -> 'User'
    user_name := COALESCE(
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'full_name',
        split_part(new.email, '@', 1),
        'User'
    );

    -- Insert into public.users with ON CONFLICT DO NOTHING (Idempotent)
    -- We map auth.users.id -> public.users.id
    INSERT INTO public.users (
        id, 
        email, 
        name, 
        role, 
        membership_status,
        created_at,
        metadata
    )
    VALUES (
        new.id, 
        new.email, 
        user_name, 
        user_role, 
        'Pending', -- Default status so they can pay
        new.created_at,
        new.raw_user_meta_data
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name),
        metadata = COALESCE(public.users.metadata, EXCLUDED.metadata);

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER is CRITICAL for permissions

-- 3. TRIGGER: Bind it to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. BACKFILL: Fix any existing "zombie" users right now
INSERT INTO public.users (id, email, name, role, membership_status, created_at, metadata)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    'member',
    'Pending',
    au.created_at,
    au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5. PERMISSIONS: Explicitly grant access to generic roles (fixes potential 403s)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;
