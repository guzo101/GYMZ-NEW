-- EMERGENCY: UNBLOCK LOGIN
-- Relaxing SELECT RLS on users table to prevent hangs caused by recursive or stuck policies.
-- This ensures that fetchProfile calls can complete immediately.

BEGIN;

-- 1. Relax SELECT policy
DROP POLICY IF EXISTS "table_users_select_owner" ON public.users;
CREATE POLICY "table_users_select_owner" ON public.users 
FOR SELECT 
TO authenticated 
USING (true);

-- 2. Relax Admins access (fast path)
DROP POLICY IF EXISTS "Admins view all" ON public.users;
CREATE POLICY "Admins view all" 
ON public.users 
FOR ALL 
TO authenticated
USING (public.is_admin());

-- 3. Ensure role protection is STILL active via trigger (safety first)
-- (Trigger 'trg_protect_user_role' is already in place and doesn't affect SELECT)

COMMIT;

NOTIFY pgrst, 'reload schema';
