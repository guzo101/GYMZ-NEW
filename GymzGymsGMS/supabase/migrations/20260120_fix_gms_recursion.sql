-- FIX INFINITE RECURSION IN RLS POLICIES
-- Purpose: Safely check admin status without triggering infinite policy loops.

-- 1. Create a SECURITY DEFINER function to check for admin status
-- This bypasses RLS on the subquery, breaking the recursion.
CREATE OR REPLACE FUNCTION public.is_admin_secure()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RESET POLICIES ON USERS TABLE
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view all" ON public.users;
DROP POLICY IF EXISTS "Users view self" ON public.users;
DROP POLICY IF EXISTS "Service bypass everything" ON public.users;

-- Policy 1: Users can see their own profile
CREATE POLICY "Users view self" 
ON public.users 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Policy 2: Admins can see ALL profiles
-- Using the secure function to prevent recursion
CREATE POLICY "Admins view all" 
ON public.users 
FOR SELECT 
TO authenticated 
USING (
  public.is_admin_secure() 
  OR (auth.jwt()->>'role' = 'service_role')
);

-- Policy 3: Service role remains God-mode
CREATE POLICY "Service bypass everything" 
ON public.users 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 3. RELOAD
NOTIFY pgrst, 'reload schema';
