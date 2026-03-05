-- ==========================================
-- MASTER RESET & PERMISSIONS FIX
-- ==========================================

-- 1. FIX ROOM DELETE/UPDATE RLS
-- Allow Admins and Owners to update/delete rooms
-- (Previously might have been restricted to just owners)

DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
CREATE POLICY "Authenticated users can create rooms" ON public.rooms 
FOR INSERT WITH CHECK (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins or owners can update rooms" ON public.rooms;
CREATE POLICY "Admins or owners can update rooms" ON public.rooms 
FOR UPDATE USING (
    auth.uid() = admin_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins or owners can delete rooms" ON public.rooms;
CREATE POLICY "Admins or owners can delete rooms" ON public.rooms 
FOR DELETE USING (
    auth.uid() = admin_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 2. RESET USERS (KEEP ADMINS)
-- Delete all users who are NOT admins.
-- This relies on CASACADE deletes to clear their posts, logs, etc.
-- If no cascade is set up, this might fail, but standard Supabase setup usually has cascades.

DELETE FROM public.users 
WHERE role IS DISTINCT FROM 'admin';

-- 3. NOTIFY
NOTIFY pgrst, 'reload schema';
