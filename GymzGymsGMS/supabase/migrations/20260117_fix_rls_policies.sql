-- ============================================
-- FIX RLS POLICIES FOR SIGNUP - January 2026
-- Ensures new users can create and read their own profiles
-- ============================================

-- 1. Enable RLS (just in case)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Clean slate for policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;

-- 3. Create permissive policies for the User (Authenticated)

-- ALLOW INSERT: Critical for the fallback logic in SignupScreen
CREATE POLICY "Users can insert own profile"
ON public.users FOR INSERT
WITH CHECK (auth.uid() = id);

-- ALLOW SELECT: Critical for the verification loop in SignupScreen
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

-- ALLOW UPDATE: For updating profile details later
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
USING (auth.uid() = id);

-- 4. Grant explicit table permissions
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;
GRANT SELECT ON TABLE public.users TO anon;

-- 5. Force a schema cache refresh (notify PostgREST)
NOTIFY pgrst, 'reload schema';
