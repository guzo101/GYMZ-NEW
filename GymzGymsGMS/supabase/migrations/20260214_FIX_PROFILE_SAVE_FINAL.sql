-- FINAL RECTIFICATION: Profile Save & RLS Stability
-- Date: 2026-02-14
-- Goal: Permanently fix the "Profile not saving" issue by ensuring no recursion and clean policies.

BEGIN;

-- 1. Ensure Columns exist (Consolidation)
-- We map 'primary_objective' to 'goal' for SSOT.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS primary_objective TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_workout_time TIME;

-- 2. KILL ALL ZOMBIE POLICIES on users table
-- Overlapping policies are the #1 cause of silent failures or recursion.
DROP POLICY IF EXISTS "table_users_update_self" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow self-update" ON public.users;
DROP POLICY IF EXISTS "table_users_select_owner" ON public.users;
DROP POLICY IF EXISTS "Admins view all" ON public.users;
DROP POLICY IF EXISTS "table_users_manage_admin" ON public.users;

-- 3. APPLY CANONICAL NON-RECURSIVE POLICIES
-- We use auth.uid() directly. is_admin() is already non-recursive.

-- SELECT: Users can see themselves, Admins see everyone
CREATE POLICY "table_users_select_canonical" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id OR public.is_admin());

-- UPDATE: Users can update themselves (excluding role changes handled by trigger)
-- We keep this simple to avoid recursion. Role protection is done in the trigger.
CREATE POLICY "table_users_update_canonical" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ALL ACCESS for Admins
CREATE POLICY "table_users_admin_all" 
ON public.users 
FOR ALL 
USING (public.is_admin());

-- 4. RE-VERIFY TRIGGER
-- Ensure role protection trigger is active and robust
CREATE OR REPLACE FUNCTION public.protect_user_role()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Permission Denied: Only administrators can change user roles.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_user_role ON public.users;
CREATE TRIGGER trg_protect_user_role
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_role();

COMMIT;

-- Reload cache
NOTIFY pgrst, 'reload schema';
