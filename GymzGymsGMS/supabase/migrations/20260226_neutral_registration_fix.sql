-- ============================================================================
-- GYMZ: NEUTRAL REGISTRATION & DYNAMIC ID GENERATION
-- Date: 2026-02-26
-- Purpose: 
-- 1. FAILS SAFE SIGNUP: Allow users to register without a gymId (Neutral).
-- 2. DYNAMIC ID: Generate professional ID only when a gym is assigned.
-- 3. UPDATABLE ID: Allow triggers to fire on gym_id updates.
-- ============================================================================

BEGIN;

-- 1. REFINED handle_new_user (The Universal Gate)
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
    -- Wrap everything in a top-level BEGIN/EXCEPTION to ensure Auth never blocks
    BEGIN
        -- A. SAFE GYM RESOLUTION
        BEGIN
            v_gym_id := (NEW.raw_user_meta_data->>'gym_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_gym_id := NULL; -- Silence cast errors
        END;

        -- Fallback to OAC invitations
        IF v_gym_id IS NULL THEN
            SELECT gc.gym_id INTO v_gym_id
            FROM public.gym_contacts gc
            WHERE gc.email = NEW.email
              AND gc.is_active = true
            LIMIT 1;
        END IF;

        -- Verify gym exists to prevent FK violation in ID generator
        IF v_gym_id IS NOT NULL THEN
            SELECT EXISTS (SELECT 1 FROM public.gyms WHERE id = v_gym_id) INTO v_gym_exists;
            IF NOT v_gym_exists THEN 
                v_gym_id := NULL; 
            END IF;
        END IF;

        -- B. METADATA RESOLUTION
        v_name := COALESCE(
            NEW.raw_user_meta_data->>'name', 
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1), 
            'User'
        );
        v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');

        -- C. PROFESSIONAL ID GENERATION (Only if gym is valid)
        IF v_gym_id IS NOT NULL THEN
            BEGIN
                v_final_id := public.generate_gym_member_id(v_gym_id);
            EXCEPTION WHEN OTHERS THEN
                v_final_id := NULL; -- Prevent ID generator crash from blocking signup
            END;
        ELSE
            v_final_id := NULL;
        END IF;

        -- D. ATOMIC UPSERT (Sync everything)
        INSERT INTO public.users (
            id, 
            email, 
            name, 
            first_name, 
            last_name, 
            role, 
            gym_id, 
            unique_id, 
            status, 
            membership_status,
            marketing_consent,
            marketing_consent_date,
            created_at
        )
        VALUES (
            NEW.id,
            NEW.email,
            v_name,
            NEW.raw_user_meta_data->>'first_name',
            NEW.raw_user_meta_data->>'last_name',
            v_role,
            v_gym_id,
            v_final_id,
            'active',
            CASE WHEN v_gym_id IS NULL THEN 'unassigned' ELSE 'New' END,
            COALESCE((NEW.raw_user_meta_data->>'marketing_consent')::BOOLEAN, false),
            (NEW.raw_user_meta_data->>'marketing_consent_date')::TIMESTAMPTZ,
            NEW.created_at
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = COALESCE(public.users.name, EXCLUDED.name),
            first_name = COALESCE(public.users.first_name, EXCLUDED.first_name),
            last_name = COALESCE(public.users.last_name, EXCLUDED.last_name),
            updated_at = NOW();

    EXCEPTION WHEN OTHERS THEN
        -- CRITICAL FALLBACK: If sync failed, do the bare minimum to let user log in
        BEGIN
            INSERT INTO public.users (id, email, role, status, membership_status)
            VALUES (NEW.id, NEW.email, 'member', 'active', 'unassigned')
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Absolute silence to guarantee Auth success
        END;
    END;

    RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

-- 2. HARDENED ensure_user_unique_id (Fire on gym_id assignment)
CREATE OR REPLACE FUNCTION public.ensure_user_unique_id()
RETURNS TRIGGER
SECURITY DEFINER
AS $body$
BEGIN
    BEGIN
        -- ONLY generate if unique_id is missing and gym_id is newly provided or inserted
        -- TG_OP check ensures it runs on both insert and update
        IF (NEW.unique_id IS NULL OR NEW.unique_id = '') AND NEW.gym_id IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM public.gyms WHERE id = NEW.gym_id) THEN
                NEW.unique_id := public.generate_gym_member_id(NEW.gym_id);
                -- If we just assigned a gym and ID, ensure status is no longer 'unassigned'
                IF NEW.membership_status = 'unassigned' THEN
                    NEW.membership_status := 'New';
                END IF;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Failsafe
    END;
    RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

-- 3. ENSURE TRIGGER FIRES ON UPDATE OF gym_id
DROP TRIGGER IF EXISTS trg_ensure_user_unique_id ON public.users;
CREATE TRIGGER trg_ensure_user_unique_id
BEFORE INSERT OR UPDATE OF gym_id ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_user_unique_id();

COMMIT;

-- Reload Supabase schema cache
NOTIFY pgrst, 'reload schema';
