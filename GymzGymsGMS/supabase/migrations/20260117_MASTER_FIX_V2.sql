-- ============================================
-- MASTER FIX V2 - RECURSION, BACKFILL & ID SYSTEM
-- ============================================

-- 0. Ensure Extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CREATE FUNCTIONS FIRST (to avoid "does not exist" errors)

-- Function: Generate ID (e.g., 1234@)
CREATE OR REPLACE FUNCTION public.generate_unique_user_id()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT (floor(random() * 9000 + 1000)::text) || (ARRAY['!','@','#','$','%','^','&','*'])[floor(random() * 8 + 1)];
$$;

-- Function: Admin Check (SECURITY DEFINER to break recursion)
CREATE OR REPLACE FUNCTION public.check_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER 
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
$$;

-- 2. REFRESH POLICIES (Clean Slate)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage all" ON public.users;
DROP POLICY IF EXISTS "Admins can do everything on users" ON public.users;
DROP POLICY IF EXISTS "Users manage own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Allow Profile Creation" ON public.users;
DROP POLICY IF EXISTS "Service role can do anything" ON public.users;
DROP POLICY IF EXISTS "Service Role" ON public.users;

-- Policy: Authenticated self-management
CREATE POLICY "Users manage own profile" ON public.users FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Policy: Admin management (using the safe function)
CREATE POLICY "Admins manage all" ON public.users FOR ALL USING (public.check_user_is_admin());

-- Policy: Service Role bypass
CREATE POLICY "Service Role" ON public.users FOR ALL USING (auth.role() = 'service_role');

-- 3. UPDATE NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
BEGIN
    user_name := COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User');

    INSERT INTO public.users (
        id, email, name, role, membership_status, status, unique_id, created_at, metadata
    )
    VALUES (
        new.id, new.email, user_name, 'member', 'Pending', 'active',
        public.generate_unique_user_id(),
        new.created_at, new.raw_user_meta_data
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name),
        unique_id = COALESCE(public.users.unique_id, EXCLUDED.unique_id),
        updated_at = NOW();

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. PERFORM BACKFILL (Missing Profiles)
INSERT INTO public.users (id, email, name, role, membership_status, status, unique_id, created_at, metadata)
SELECT 
    au.id, au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    'member', 'Pending', 'active',
    public.generate_unique_user_id(),
    au.created_at, au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5. FINAL UPDATES
-- Ensure everyone has a unique_id
UPDATE public.users SET unique_id = public.generate_unique_user_id() WHERE unique_id IS NULL;
-- Ensure everyone has a thread_id
UPDATE public.users SET thread_id = COALESCE(thread_id, gen_random_uuid()::text);
-- Force active status
UPDATE public.users SET status = 'active' WHERE status IS NULL;

-- 6. REFRESH CACHE
NOTIFY pgrst, 'reload schema';
