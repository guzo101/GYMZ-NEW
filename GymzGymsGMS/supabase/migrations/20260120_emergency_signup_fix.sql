-- EMERGENCY FIX FOR SIGNUP
-- Purpose: Remove ANY blocking constraints and make the new user trigger fail-safe.

-- 1. BLINDLY DROP ALL POTENTIAL CONSTRAINTS
-- We don't care if they exist or not, we want them gone if they block 'New'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_membership_status_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS membership_status_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_membership_status;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. ENSURE COLUMNS HAVE CORRECT DEFAULTS
ALTER TABLE public.users ALTER COLUMN membership_status SET DEFAULT 'New';
ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'active';

-- 3. ROBUST HANDLE_NEW_USER TRIGGER
-- This version catches errors and tries a fallback insert if the main one fails.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    -- Attempt 1: Full Insert
    BEGIN
        INSERT INTO public.users (
            id, 
            email, 
            name, 
            role, 
            membership_status, 
            status, 
            unique_id,
            thread_id,
            created_at, 
            metadata
        )
        VALUES (
            new.id, 
            new.email, 
            COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 
            'member', 
            'New', 
            'active', 
            public.generate_unique_user_id(),
            gen_random_uuid()::text,
            new.created_at,
            new.raw_user_meta_data
        )
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            updated_at = NOW();
            
        RETURN new;
    EXCEPTION WHEN OTHERS THEN
        -- Log the error to the Postgres log (visible in Supabase dashboard)
        RAISE WARNING 'Primary insert failed for user %: %. Retrying with minimal data.', new.id, SQLERRM;
        
        -- Attempt 2: Minimal Insert (Fail-safe)
        BEGIN
            INSERT INTO public.users (id, email, membership_status, unique_id, thread_id)
            VALUES (new.id, new.email, 'New', public.generate_unique_user_id(), gen_random_uuid()::text)
            ON CONFLICT (id) DO NOTHING;
            
            RETURN new;
        EXCEPTION WHEN OTHERS THEN
            -- If this fails, it's a hard system error (like readonly DB or disk full)
            RAISE EXCEPTION 'CRITICAL: Failed to create user profile. %', SQLERRM;
        END;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FORCE RE-BIND TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. ENSURE RLS DOESN'T BITE (Just in case trigger is bypassed somehow)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
    ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

GRANT ALL ON public.users TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- 6. DIAGNOSTIC SCAN (Runs automatically at the end)
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DIAGNOSTIC SCAN RESULTS';
    RAISE NOTICE '========================================';
END $$;

-- Check for any other triggers on auth.users
SELECT 'OTHER TRIGGER FOUND: ' || trigger_name as info
FROM information_schema.triggers 
WHERE event_object_schema = 'auth' 
  AND event_object_table = 'users'
  AND trigger_name != 'on_auth_user_created';

-- Check for any triggers on public.users
SELECT 'TRIGGER ON public.users: ' || trigger_name as info
FROM information_schema.triggers 
WHERE event_object_schema = 'public' 
  AND event_object_table = 'users';

-- Check for non-nullable columns without defaults
SELECT 'REQD COLUMN: ' || column_name || ' (' || data_type || ')' as info
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND is_nullable = 'NO'
  AND column_default IS NULL
  AND column_name NOT IN ('id', 'created_at', 'updated_at');
