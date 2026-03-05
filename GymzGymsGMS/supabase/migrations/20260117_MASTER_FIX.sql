-- ============================================
-- MASTER FIX - RECURSION, BACKFILL & ID SYSTEM
-- ============================================

-- 1. FIX INFINITE RECURSION (Critical for GMS)
-- Create a secure function that bypasses RLS to check admin status
CREATE OR REPLACE FUNCTION public.check_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER -- <--- This breaks the loop
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
$$;

-- 2. WIPE & RESET POLICIES (Clean Slate)
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

-- 3. INSTALL CLEAN POLICIES

-- Policy A: AUTHENTICATED USERS (Self-Managment)
CREATE POLICY "Users manage own profile"
ON public.users
FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy B: ADMINS (Management - Non-Recursive)
CREATE POLICY "Admins manage all"
ON public.users
FOR ALL
USING (public.check_user_is_admin());

-- Policy C: SERVICE ROLE (API Bypass)
CREATE POLICY "Service Role"
ON public.users
FOR ALL
USING (auth.role() = 'service_role');


-- 4. UPDATE TRIGGER FOR UNIQUE IDs
-- Create ID generator function
CREATE OR REPLACE FUNCTION public.generate_unique_user_id()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT (floor(random() * 9000 + 1000)::text) || (ARRAY['!','@','#','$','%','^','&','*'])[floor(random() * 8 + 1)];
$$;

-- Update the main trigger function
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
        public.generate_unique_user_id(), -- Auto-generate ID
        new.created_at, new.raw_user_meta_data
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name),
        unique_id = COALESCE(public.users.unique_id, EXCLUDED.unique_id),
        updated_at = NOW();

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. "NO USER LEFT BEHIND" BACKFILL
-- Inserts any Authenticated user who is missing from public.users
INSERT INTO public.users (id, email, name, role, membership_status, status, unique_id, created_at, metadata)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    'member',
    'Pending',
    'active',
    public.generate_unique_user_id(),
    au.created_at,
    au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 6. FINAL CLEANUP
-- Ensure everyone has a unique_id
UPDATE public.users SET unique_id = public.generate_unique_user_id() WHERE unique_id IS NULL;
-- Ensure everyone has a thread_id
UPDATE public.users SET thread_id = gen_random_uuid()::text WHERE thread_id IS NULL;
-- Force active status
UPDATE public.users SET status = 'active' WHERE status IS NULL;

-- 7. REFRESH SCHEMA
NOTIFY pgrst, 'reload schema';
