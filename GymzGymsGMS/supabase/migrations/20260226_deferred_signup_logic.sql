-- ============================================================================
-- GYMZ: SUPER-SAFE DEFERRED SIGNUP & DYNAMIC MEMBER ID GENERATION
-- Date: 2026-02-26
-- Purpose: 
-- 1. Allow signups without a gym.
-- 2. Validate any gym_id before assignment to prevent FK crashes.
-- 3. Dynamically generate IDs when a gym is chosen later.
-- ============================================================================

BEGIN;

-- 1. HARDENED handle_new_user (Validates Gym existence)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
AS $body$
DECLARE
    v_gym_id UUID;
    v_name TEXT;
    v_role TEXT;
    v_final_id TEXT;
    v_gym_exists BOOLEAN;
BEGIN
    -- Resolve gym_id from metadata
    v_gym_id := (NEW.raw_user_meta_data->>'gym_id')::UUID;

    -- Resolve gym_id from OAC invites if metadata missing
    IF v_gym_id IS NULL THEN
        SELECT gc.gym_id INTO v_gym_id
        FROM public.gym_contacts gc
        WHERE gc.email = NEW.email
          AND gc.is_active = true
        LIMIT 1;
    END IF;

    -- CRITICAL SAFETY CHECK: Ensure the gym actually exists in our DB
    IF v_gym_id IS NOT NULL THEN
        SELECT EXISTS (SELECT 1 FROM public.gyms WHERE id = v_gym_id) INTO v_gym_exists;
        IF NOT v_gym_exists THEN
            v_gym_id := NULL; -- Invalidate ghost/stale gym IDs
        END IF;
    END IF;

    -- Resolve name and role
    v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'User');
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');

    -- Generate unique_id ONLY if gym is valid
    IF v_gym_id IS NOT NULL THEN
        v_final_id := public.generate_gym_member_id(v_gym_id);
    ELSE
        v_final_id := NULL;
    END IF;

    -- Insert public user record
    INSERT INTO public.users (
        id, email, name, role, gym_id, unique_id, created_at, status, membership_status
    )
    VALUES (
        NEW.id,
        NEW.email,
        v_name,
        v_role,
        v_gym_id,
        v_final_id,
        NEW.created_at,
        'active',
        'New'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

-- 2. HARDENED ensure_user_unique_id (Conflicting ID Fix)
CREATE OR REPLACE FUNCTION public.ensure_user_unique_id()
RETURNS TRIGGER
SECURITY DEFINER
AS $body$
DECLARE
    v_gym_exists BOOLEAN;
BEGIN
    -- ONLY generate if gym_id is provided AND exists
    IF (NEW.unique_id IS NULL OR NEW.unique_id = '') AND NEW.gym_id IS NOT NULL THEN
        SELECT EXISTS (SELECT 1 FROM public.gyms WHERE id = NEW.gym_id) INTO v_gym_exists;
        IF v_gym_exists THEN
            NEW.unique_id := public.generate_gym_member_id(NEW.gym_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_user_unique_id ON public.users;
CREATE TRIGGER trg_ensure_user_unique_id
    BEFORE INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_user_unique_id();

-- 3. TRIGGER FUNCTION FOR LATE GYM ASSIGNMENT
CREATE OR REPLACE FUNCTION public.sync_member_id_on_gym_assignment()
RETURNS TRIGGER
SECURITY DEFINER
AS $body$
BEGIN
    -- Only generate ID if gym_id is being set for the first time
    IF (OLD.gym_id IS NULL AND NEW.gym_id IS NOT NULL) THEN
        -- Only generate if unique_id is still NULL
        IF NEW.unique_id IS NULL THEN
            NEW.unique_id := public.generate_gym_member_id(NEW.gym_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

-- 4. ATTACH THE UPDATE TRIGGER
DROP TRIGGER IF EXISTS trg_user_gym_assigned ON public.users;
CREATE TRIGGER trg_user_gym_assigned
    BEFORE UPDATE OF gym_id ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_member_id_on_gym_assignment();

COMMIT;

-- Reload Supabase schema cache
NOTIFY pgrst, 'reload schema';
