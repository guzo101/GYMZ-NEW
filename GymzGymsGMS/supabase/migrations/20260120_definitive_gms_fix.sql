-- DEFINITIVE GMS RESTORATION & RLS RECURSION FIX (VERSION 2)
-- Using a unique function name to avoid "function not unique" errors.

BEGIN;

-- 1. Create/Update Secure Admin Check Function with a UNIQUE NAME
-- This breaks the loop because it runs as SuperUser (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin_final(target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = target_user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Force Promote Admins
-- Ensures you (the admin) can actually bypass the "member-only" views.
UPDATE public.users 
SET role = 'admin', 
    membership_status = 'Active' 
WHERE email IN (
    'leah@msafiristudios.com', 
    'mex@gmail.com', 
    'admin@Gymz.co.zm', 
    'lucy@msafiristudios.com',
    'admin@Gymz.co'
);

-- 3. Dynamic Backfill: Ensure all auth users are in public.users
INSERT INTO public.users (
    id, 
    email, 
    role, 
    membership_status, 
    created_at, 
    unique_id, 
    thread_id
)
SELECT 
    au.id, 
    au.email, 
    'member', 
    'New', 
    au.created_at,
    public.generate_unique_user_id(),
    gen_random_uuid()
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Re-configure RLS Policies (Clean Reset)
-- This removes any conflicting or circular policies.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for users for own data" ON public.users;
DROP POLICY IF EXISTS "Admins view all" ON public.users;
DROP POLICY IF EXISTS "Service role bypass" ON public.users;
DROP POLICY IF EXISTS "Ultimate Access" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Public profile visibility" ON public.users;
DROP POLICY IF EXISTS "Users view self" ON public.users;
DROP POLICY IF EXISTS "Service bypass everything" ON public.users;
DROP POLICY IF EXISTS "Service Bypass" ON public.users;
DROP POLICY IF EXISTS "System Access" ON public.users;

-- Policy: Users can view their own profile
CREATE POLICY "Users view self" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);

-- Policy: Admins can view ALL profiles (using the NEW non-recursive function)
CREATE POLICY "Admins view all" 
ON public.users 
FOR ALL 
USING (public.is_admin_final(auth.uid()));

-- Policy: Service role can do everything
CREATE POLICY "Service Bypass" 
ON public.users 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 5. Grant Permissions
GRANT EXECUTE ON FUNCTION public.is_admin_final TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_final TO service_role;

COMMIT;

-- Diagnostics
SELECT count(*) as total_users, 
       count(*) filter (where role = 'admin') as admin_count 
FROM public.users;
