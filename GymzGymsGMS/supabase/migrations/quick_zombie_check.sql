-- Quick check for zombie users
-- Run this in Supabase SQL Editor

-- Show zombie users
SELECT 
    'ZOMBIE USER' as status,
    au.email,
    au.id,
    au.created_at,
    au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;

-- Show user counts
SELECT 
    (SELECT COUNT(*) FROM auth.users) as auth_users,
    (SELECT COUNT(*) FROM public.users) as public_users,
    (SELECT COUNT(*) 
     FROM auth.users au 
     LEFT JOIN public.users pu ON au.id = pu.id 
     WHERE pu.id IS NULL) as zombie_users;
