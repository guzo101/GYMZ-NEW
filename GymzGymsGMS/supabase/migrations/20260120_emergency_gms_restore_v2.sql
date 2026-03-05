-- EMERGENCY GMS RESTORE & ADMIN PROMOTION
-- Purpose: Fix the "Disappearing Members" by ensuring Admin roles are correct and syncing all users.

-- 1. FORCE PROMOTE ADMINS
-- If the person logged into GMS is now a 'member', they won't see anything.
-- We promote common admin emails just in case.
UPDATE public.users 
SET role = 'admin', membership_status = 'Active', status = 'active'
WHERE email IN (
    'mex@gmail.com', 
    'leah@msafiristudios.com', 
    'lucy@msafiristudios.com',
    'admin@Gymz.co.zm'
);

-- 2. RE-SYNC ALL USERS (Backfill)
-- Ensure every Auth user has a corresponding Public user row.
INSERT INTO public.users (
    id, 
    email, 
    name, 
    role, 
    membership_status, 
    status, 
    unique_id, 
    thread_id, 
    created_at
)
SELECT 
    au.id, 
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1), 'User'),
    COALESCE(au.raw_user_meta_data->>'role', 'member'),
    'Pending',
    'active',
    public.generate_unique_user_id_v2(), -- Uses the v2 function from previous fix
    gen_random_uuid()::text,
    au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. FIX RECURSION (Absolute Version)
-- We use a highly efficient check that doesn't touch the users table directly in the policy.
CREATE OR REPLACE FUNCTION public.is_admin_secure_v3()
RETURNS BOOLEAN AS $$
BEGIN
  -- We query the table directly using SECURITY DEFINER to bypass RLS.
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. APPLY CLEAN POLICIES
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view all" ON public.users;
DROP POLICY IF EXISTS "Users view self" ON public.users;
DROP POLICY IF EXISTS "Ultimate Access" ON public.users;
DROP POLICY IF EXISTS "Service bypass everything" ON public.users;
DROP POLICY IF EXISTS "System Access" ON public.users;

-- A. Users see themselves
CREATE POLICY "Users view self" ON public.users 
FOR SELECT TO authenticated USING (auth.uid() = id);

-- B. Admins see everyone (using recursion-free function)
CREATE POLICY "Admins view all" ON public.users 
FOR ALL TO authenticated USING (public.is_admin_secure_v3());

-- C. System bypass
CREATE POLICY "Service Bypass" ON public.users 
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. REFRESH
NOTIFY pgrst, 'reload schema';
