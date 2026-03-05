-- ============================================
-- FIX ADMIN RLS POLICIES - January 2026
-- Allow Admins to manage ALL users
-- ============================================

-- 1. Create a secure function to check if current user is admin
-- (Using a function avoids infinite recursion in policies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add policies for Admins to do everything
CREATE POLICY "Admins can do everything on users"
  ON public.users
  FOR ALL
  USING (public.is_admin());

-- 3. Ensure Service Role (API) always has Bypass
-- (This should already exist but we reinforce it)
DROP POLICY IF EXISTS "Service role can do anything" ON public.users;
CREATE POLICY "Service role can do anything"
  ON public.users
  USING (auth.role() = 'service_role');

-- 4. Verify existing "Self" policies are still there (don't break normal users)
-- "Users can insert own profile" (Already verified from previous step)
-- "Users can view own profile"   (Already verified from previous step)
-- "Users can update own profile" (Already verified from previous step)

-- 5. Force schema reload
NOTIFY pgrst, 'reload schema';
