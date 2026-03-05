-- ============================================
-- SYSTEM RESET: WIPE ALL USERS & RESTORE ADMIN
-- ============================================

-- 1. Wipe Everything (Cascade to linked tables like attendance, calories, etc.)
TRUNCATE TABLE public.users CASCADE;

-- 2. Restore Admin Profile (So you don't get locked out)
-- We use a DO block to find the Admin User ID from Auth (if possible)
-- or just Insert based on email.

DO $$
DECLARE
    admin_auth_id uuid;
BEGIN
    -- Try to find the existing Auth User for admin@Gymz.com
    SELECT id INTO admin_auth_id FROM auth.users WHERE email = 'admin@Gymz.com';

    IF admin_auth_id IS NOT NULL THEN
        -- Insert Admin Profile
        INSERT INTO public.users (
            id, email, name, role, status, membership_status, unique_id, thread_id
        ) VALUES (
            admin_auth_id,
            'admin@Gymz.com',
            'System Administrator',
            'admin',
            'active',
            'Pending',
            'ADMIN123@',
            gen_random_uuid()::text
        );
        RAISE NOTICE 'Admin Identity Restored for ID: %', admin_auth_id;
    ELSE
        RAISE WARNING 'Admin Auth User NOT FOUND. You must Create Auth User admin@Gymz.com manually!';
    END IF;
END $$;

-- 3. Reload
NOTIFY pgrst, 'reload schema';
