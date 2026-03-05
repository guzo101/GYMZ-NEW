-- ============================================
-- FIX INFINITE RECURSION - January 2026
-- Bypasses recursion by using SECURITY DEFINER
-- ============================================

-- 1. Create a secure function to check admin role
-- SECURITY DEFINER means this runs with the creator's permissions (superuser)
-- NOT the row's permissions, thus bypassing the RLS loop.
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

-- 2. Drop the recursive policies
DROP POLICY IF EXISTS "Admins manage all" ON public.users;
DROP POLICY IF EXISTS "Admins can do everything on users" ON public.users;
DROP POLICY IF EXISTS "Users manage own profile" ON public.users;
DROP POLICY IF EXISTS "Allow Profile Creation" ON public.users;

-- 3. Re-create Clean Policies

-- Policy A: AUTHENTICATED USERS (Self-Managment)
-- No sub-queries here = No recursion
CREATE POLICY "Users manage own profile"
ON public.users
FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy B: ADMINS (Management)
-- Uses the SECURITY DEFINER function to break recursion
CREATE POLICY "Admins manage all"
ON public.users
FOR ALL
USING (public.check_user_is_admin());

-- Policy C: Service Role (The API)
-- Always allow the server to do anything
CREATE POLICY "Service Role"
ON public.users
FOR ALL
USING (auth.role() = 'service_role');

-- 4. Force Schema Reload
NOTIFY pgrst, 'reload schema';
