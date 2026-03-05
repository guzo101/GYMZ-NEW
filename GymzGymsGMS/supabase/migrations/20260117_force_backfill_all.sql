-- ============================================
-- DEFINITIVE BACKFILL - NO USER LEFT BEHIND
-- ============================================

-- 1. Insert MISSING users from auth.users into public.users
-- This ignores 'email_confirmed_at' completely. If they exist in Auth, they get a profile.
INSERT INTO public.users (
    id, 
    email, 
    name, 
    role, 
    membership_status, 
    status, 
    unique_id, 
    created_at, 
    metadata
)
SELECT 
    au.id,
    au.email,
    -- Best guess for name
    COALESCE(
        au.raw_user_meta_data->>'name', 
        au.raw_user_meta_data->>'full_name', 
        split_part(au.email, '@', 1)
    ),
    -- Default role
    'member',
    -- Default status
    'Pending',
    'active',
    -- Generate unique_id if missing (using our function)
    public.generate_unique_user_id(),
    au.created_at,
    -- Copy metadata
    au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure every existing user has a unique_id
UPDATE public.users 
SET unique_id = public.generate_unique_user_id()
WHERE unique_id IS NULL;

-- 3. Ensure every existing user has a thread_id (for AI)
-- We can't use the TS function here, so we generate a basic one
UPDATE public.users 
SET thread_id = gen_random_uuid()::text
WHERE thread_id IS NULL;

-- 4. Force status to active for anyone who might be stuck
UPDATE public.users
SET status = 'active'
WHERE status IS NULL;

-- 5. Force schema reload to be safe
NOTIFY pgrst, 'reload schema';
