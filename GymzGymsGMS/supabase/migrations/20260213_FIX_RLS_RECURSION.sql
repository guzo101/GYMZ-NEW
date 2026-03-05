-- FIX: Kill RLS Recursion on Users Table
-- This recursion in the WITH CHECK clause was causing infinite loops during profile updates.
-- The 'role' protection is already handled by the 'trg_protect_user_role' trigger.

BEGIN;

DROP POLICY IF EXISTS "table_users_update_self" ON public.users;
CREATE POLICY "table_users_update_self" ON public.users 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Ensure selective access for admins is still fast
DROP POLICY IF EXISTS "Admins view all" ON public.users;
CREATE POLICY "Admins view all" 
ON public.users 
FOR ALL 
USING (public.is_admin());

COMMIT;
