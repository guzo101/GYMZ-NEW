-- EMERGENCY FIX: Login & Account Recovery
-- 1. Backfill any missing public profiles from auth.users (Zombie Fix)
-- 2. Auto-confirm any recent signups to bypass email link issues

-- A. ZOMBIE BACKFILL
INSERT INTO public.users (
    id, email, name, role, status, membership_status, created_at, metadata
)
SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    'member', 
    'active', 
    'Pending', 
    au.created_at, 
    au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- B. AUTO-CONFIRM EMAILS (Last 24 hours)
-- This fixes "Invalid login credentials" caused by unconfirmed emails
UPDATE auth.users
SET email_confirmed_at = NOW(), confirmed_at = NOW()
WHERE created_at > (NOW() - INTERVAL '24 hours')
AND email_confirmed_at IS NULL;

-- C. Ensure RLS doesn't block reading own profile
-- (Already likely done, but reinforcing)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon; -- Needed for login checks sometimes

-- D. Force Membership Default
UPDATE public.users 
SET membership_status = 'Pending' 
WHERE membership_status IS NULL;
