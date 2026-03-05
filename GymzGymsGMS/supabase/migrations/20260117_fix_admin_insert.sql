-- ============================================
-- FIX ADMIN INSERT PERMISSIONS
-- ============================================

-- 1. Drop the potentially restrictive Admin policy
DROP POLICY IF EXISTS "Admins manage all" ON public.users;

-- 2. Re-create it with explicit WITH CHECK clause
-- This ensures Admins can INSERT rows where id != their own auth.uid()
CREATE POLICY "Admins manage all"
ON public.users
FOR ALL
USING (public.check_user_is_admin())
WITH CHECK (public.check_user_is_admin());

-- 3. Also, ensure the "Service Role" can insert freely
DROP POLICY IF EXISTS "Service Role" ON public.users;
CREATE POLICY "Service Role"
ON public.users
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 4. Reload schema
NOTIFY pgrst, 'reload schema';
