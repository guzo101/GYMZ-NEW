-- DATA CONSISTENCY & MEMBER VISIBILITY FIX
BEGIN;

-- 0. Update is_admin_final to include super_admin
CREATE OR REPLACE FUNCTION public.is_admin_final(target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = target_user_id AND (role = 'admin' OR role = 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1. Backfill missing names from emails
UPDATE public.users
SET name = COALESCE(name, split_part(email, '@', 1))
WHERE name IS NULL OR name = '';

-- 2. Ensure all auth users have a profile (Robust Backfill)
INSERT INTO public.users (
    id, 
    email, 
    name,
    role, 
    status,
    membership_status, 
    created_at, 
    unique_id, 
    thread_id
)
SELECT 
    au.id, 
    au.email, 
    split_part(au.email, '@', 1),
    'member', 
    'Active',
    'Pending', 
    au.created_at,
    public.generate_unique_user_id(),
    gen_random_uuid()
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    name = COALESCE(public.users.name, EXCLUDED.name),
    role = COALESCE(public.users.role, 'member'),
    status = COALESCE(public.users.status, 'Active'),
    membership_status = COALESCE(public.users.membership_status, 'Pending');

-- 3. Standardize membership_status and status
UPDATE public.users
SET status = 'Active'
WHERE status IS NULL OR status = '';

UPDATE public.users
SET membership_status = 'Pending'
WHERE membership_status IS NULL OR membership_status = '';

-- 4. Fix potential NULL roles
UPDATE public.users
SET role = 'member'
WHERE role IS NULL OR role = '';

COMMIT;
