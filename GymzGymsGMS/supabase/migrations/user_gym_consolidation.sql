-- ============================================================================
-- GYMZ PLATFORM: USER & GYM CONSOLIDATION SCRIPT
-- Purpose: 
-- 1. Backfill all auth.users into public.users.
-- 2. Associate all users with "Sweat Factory Gym".
-- 3. Ensure admins have the correct role for event management.
-- ============================================================================

BEGIN;

-- 1. CONFIGURATION
-- Sweat Factory Gym ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
DO $$
DECLARE
    target_gym_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN
    RAISE NOTICE 'Starting consolidation for Gym ID: %', target_gym_id;

    -- 2. BACKFILL PROFILES (AUTH -> PUBLIC)
    -- This ensures every user who can log in exists in the public schema.
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
        metadata,
        gym_id
    )
    SELECT 
        au.id,
        au.email,
        COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1), 'User'),
        COALESCE(au.raw_user_meta_data->>'role', 'member'),
        'active',
        'Active', -- Defaulting to Active for migrated users
        (floor(random() * 9000 + 1000)::text) || (ARRAY['!','@','#','$','%','^','&','*'])[floor(random() * 8 + 1)],
        gen_random_uuid()::text,
        au.created_at,
        au.raw_user_meta_data,
        target_gym_id
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
    ON CONFLICT (id) DO NOTHING;

    -- 3. FORCE ASSOCIATE GYM ID
    -- Any user previously in public.users without a gym_id or with a dead gym_id 
    -- is moved to Sweat Factory.
    UPDATE public.users 
    SET gym_id = target_gym_id 
    WHERE gym_id IS NULL 
       OR NOT EXISTS (SELECT 1 FROM public.gyms g WHERE g.id = users.gym_id);

    -- 4. ENSURE ADMIN ROLE FOR admin@Gymz.com
    -- This is critical for event creation as per public.is_admin() logic.
    UPDATE public.users 
    SET role = 'admin', status = 'active'
    WHERE email = 'admin@Gymz.com';

    -- 5. NOTIFY SUCCESS
    RAISE NOTICE 'User consolidation complete. All users are now associated with Sweat Factory Gym.';

END $$;

COMMIT;

-- Refresh schema for safety
NOTIFY pgrst, 'reload schema';
