-- Migration: HARDEN USER SECURITY
-- Date: 2026-02-11
-- Purpose: Prevent users from self-promoting to admin by locking the 'role' column.

BEGIN;

-- 1. Create protection function
CREATE OR REPLACE FUNCTION public.protect_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- If role is being changed
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
        -- Only allow if the requester is an admin or service_role
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Permission Denied: You cannot change user roles. This requires administrator privileges.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply trigger
DROP TRIGGER IF EXISTS trg_protect_user_role ON public.users;
CREATE TRIGGER trg_protect_user_role
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_role();

-- 3. Harden the Update Policy (Defensive)
-- We only allow updates if the role remains the same OR if the user is an admin
DROP POLICY IF EXISTS "table_users_update_self" ON public.users;
CREATE POLICY "table_users_update_self" ON public.users 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id 
    AND (
        (role IS NOT DISTINCT FROM (SELECT role FROM public.users WHERE id = auth.uid()))
        OR public.is_admin()
    )
);

COMMIT;

NOTIFY pgrst, 'reload schema';
