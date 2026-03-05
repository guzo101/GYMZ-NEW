-- ============================================
-- ZOMBIE USERS - DIAGNOSTIC & FIX SCRIPT
-- ============================================
-- Run this in Supabase SQL Editor to diagnose and fix zombie user issues

-- ============================================
-- STEP 1: CHECK IF TRIGGER EXISTS
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 1: Checking for user sync trigger...';
    RAISE NOTICE '========================================';
END $$;

SELECT 
    trigger_name, 
    event_manipulation, 
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
  AND event_object_table = 'users'
  AND event_object_schema = 'auth';

-- ============================================
-- STEP 2: CHECK IF FUNCTION EXISTS
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 2: Checking for handle_new_user function...';
    RAISE NOTICE '========================================';
END $$;

SELECT 
    routine_name, 
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- ============================================
-- STEP 3: COUNT USERS IN BOTH TABLES
-- ============================================
DO $$
DECLARE
    auth_count INTEGER;
    public_count INTEGER;
    zombie_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 3: Counting users...';
    RAISE NOTICE '========================================';
    
    SELECT COUNT(*) INTO auth_count FROM auth.users;
    SELECT COUNT(*) INTO public_count FROM public.users;
    
    SELECT COUNT(*) INTO zombie_count
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL;
    
    RAISE NOTICE 'Auth users: %', auth_count;
    RAISE NOTICE 'Public users: %', public_count;
    RAISE NOTICE 'Zombie users (in auth, not in public): %', zombie_count;
END $$;

-- ============================================
-- STEP 4: LIST ZOMBIE USERS (if any)
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 4: Listing zombie users...';
    RAISE NOTICE '========================================';
END $$;

SELECT 
    au.id,
    au.email,
    au.created_at,
    au.raw_user_meta_data->>'full_name' as metadata_name,
    au.raw_user_meta_data->>'gender' as metadata_gender,
    au.raw_user_meta_data->>'age' as metadata_age
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;

-- ============================================
-- STEP 5: FIX - CREATE OR REPLACE TRIGGER FUNCTION
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 5: Creating/Updating trigger function...';
    RAISE NOTICE '========================================';
END $$;

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
        email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name);
    
    RAISE NOTICE 'User synced to public.users: % (%)', new.email, new.id;
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 6: FIX - ENSURE TRIGGER IS BOUND
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 6: Binding trigger to auth.users...';
    RAISE NOTICE '========================================';
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================
-- STEP 7: FIX - SYNC ALL ZOMBIE USERS
-- ============================================
DO $$
DECLARE
    synced_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 7: Syncing zombie users to public.users...';
    RAISE NOTICE '========================================';
    
    WITH inserted AS (
        INSERT INTO public.users (id, email, name, role, membership_status)
        SELECT 
            id, 
            email, 
            COALESCE(
                raw_user_meta_data->>'full_name', 
                raw_user_meta_data->>'name', 
                split_part(email, '@', 1), 
                'User'
            ),
            'member',
            'Pending'
        FROM auth.users
        ON CONFLICT (id) DO NOTHING
        RETURNING *
    )
    SELECT COUNT(*) INTO synced_count FROM inserted;
    
    RAISE NOTICE 'Synced % zombie users', synced_count;
END $$;

-- ============================================
-- STEP 8: VERIFICATION - RECOUNT
-- ============================================
DO $$
DECLARE
    auth_count INTEGER;
    public_count INTEGER;
    zombie_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 8: Final verification...';
    RAISE NOTICE '========================================';
    
    SELECT COUNT(*) INTO auth_count FROM auth.users;
    SELECT COUNT(*) INTO public_count FROM public.users;
    
    SELECT COUNT(*) INTO zombie_count
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL;
    
    RAISE NOTICE 'Auth users: %', auth_count;
    RAISE NOTICE 'Public users: %', public_count;
    RAISE NOTICE 'Remaining zombies: %', zombie_count;
    
    IF zombie_count = 0 THEN
        RAISE NOTICE '✅ SUCCESS: All users synced!';
    ELSE
        RAISE WARNING '⚠️  WARNING: % zombie users still remain', zombie_count;
    END IF;
END $$;

-- ============================================
-- DONE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Zombie user fix complete!';
    RAISE NOTICE '========================================';
END $$;
