-- ================================================================================
-- REMEDY STEP 1: Privilege Consolidation (Kill RLS Recursion)
-- ================================================================================

BEGIN;

-- 1. Resolve recursive admin functions
-- Note: We use CREATE OR REPLACE for is_admin() instead of DROP to avoid dependency errors with existing RLS policies.
DROP FUNCTION IF EXISTS public.is_admin_secure() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_secure_v3() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_final(UUID) CASCADE;

-- 2. Create the Non-Recursive is_admin helper
-- Uses JWT claims to avoid querying the public.users table (killing recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if it's the service role
    IF (auth.jwt() ->> 'role' = 'service_role') THEN
        RETURN TRUE;
    END IF;

    -- Check user metadata for the admin role
    RETURN (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') 
        OR (auth.jwt() -> 'user_metadata' ->> 'is_admin' = 'true');
END;
$$ LANGUAGE plpgsql STABLE;

-- Ensure is_admin_final is also available as a compatibility shim
CREATE OR REPLACE FUNCTION public.is_admin_final(target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.is_admin();
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Metadata Sync Logic
-- This function updates auth.users metadata whenever public.users changes
CREATE OR REPLACE FUNCTION public.handle_user_metadata_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- UPDATE auth.users metadata using SECURITY DEFINER
    -- We use a raw SQL update on the auth schema
    UPDATE auth.users
    SET raw_user_meta_data = 
        COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object('role', NEW.role, 'is_admin', (NEW.role = 'admin'))
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the Trigger
DROP TRIGGER IF EXISTS trg_sync_user_metadata ON public.users;
CREATE TRIGGER trg_sync_user_metadata
AFTER INSERT OR UPDATE OF role ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_metadata_sync();

-- 5. PERFORM BACKFILL
-- Sync all existing roles to auth.users metadata
DO $$
DECLARE
    u record;
BEGIN
    FOR u IN SELECT id, role FROM public.users LOOP
        UPDATE auth.users
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', u.role, 'is_admin', (u.role = 'admin'))
        WHERE id = u.id;
    END LOOP;
END $$;

-- 6. Clean up RLS on Users table to use the new non-recursive function
-- This is a preemptive strike before Step 2 (The Great Clear-out)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view all" ON public.users;
CREATE POLICY "Admins view all" 
ON public.users 
FOR ALL 
USING (public.is_admin());

-- 7. Grant access
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin_final(UUID) TO authenticated;

COMMIT;
