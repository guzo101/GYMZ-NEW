-- =================================================================
-- FIX PAYMENTS RLS RECURSION
-- Root Cause: The previous "final" fix (20260120) used a direct subquery 
-- to check admin status, which causes infinite recursion with RLS on users table.
-- Fix: Use the SECURITY DEFINER function `check_user_is_admin()` to bypass RLS.
-- =================================================================

-- 1. ENSURE THE HELPER FUNCTION EXISTS
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

-- 2. DROP THE PROBLEMATIC POLICY
DROP POLICY IF EXISTS "Admins Manage All" ON public.payments;
DROP POLICY IF EXISTS "Admins manage all payments" ON public.payments; -- Drop alternate name just in case

-- 3. RE-CREATE THE POLICY USING THE SECURE FUNCTION
CREATE POLICY "Admins Manage All"
ON public.payments FOR ALL
TO authenticated
USING (
  public.check_user_is_admin()
  OR auth.jwt() ->> 'role' = 'service_role'
);

-- 4. FORCE SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
