-- ============================================
-- FIX MY ADMIN - EMERGENCY RESYNC
-- ============================================

-- 1. BACKFILL: Find the Admin in Auth and put them in Public
INSERT INTO public.users (id, email, name, role, status, membership_status, unique_id, thread_id, created_at, metadata)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    'admin', -- Force role to admin immediately
    'active',
    'Pending',
    -- Generate ID
    (floor(random() * 9000 + 1000)::text) || (ARRAY['!','@','#','$','%','^','&','*'])[floor(random() * 8 + 1)],
    gen_random_uuid()::text,
    au.created_at,
    au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. PROMOTE: Ensure everyone (which is just you) is an Admin
UPDATE public.users 
SET role = 'admin', status = 'active';

-- 3. RELOAD
NOTIFY pgrst, 'reload schema';
