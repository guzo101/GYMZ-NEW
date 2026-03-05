-- Migration: Neutralize handle_new_user trigger to prevent automatic gym assignment
-- Date: 2026-03-05
-- Purpose: 
-- 1. Ensure new users are NOT automatically assigned to any gym.
-- 2. Allow user to choose their gym during onboarding in the app.

BEGIN;

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
        -- A. RESOLVE GYM_ID (Strictly from metadata or invitation)
        -- No default 'The Sweat Factory' here.
        BEGIN
            v_gym_id := (NEW.raw_user_meta_data->>'gym_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_gym_id := NULL; 
        END;

        -- Fallback to OAC invitations (specific gym ownership/access)
        IF v_gym_id IS NULL THEN
            SELECT gc.gym_id INTO v_gym_id
            FROM public.gym_contacts gc
            WHERE gc.email = NEW.email
              AND gc.is_active = true
            LIMIT 1;
        END IF;

        -- Verify gym exists if provided
        IF v_gym_id IS NOT NULL THEN
            SELECT EXISTS (SELECT 1 FROM public.gyms WHERE id = v_gym_id) INTO v_gym_exists;
            IF NOT v_gym_exists THEN 
                v_gym_id := NULL; 
            END IF;
        END IF;

        -- B. RESOLVE IDENTITY
        v_name := COALESCE(
            NEW.raw_user_meta_data->>'name', 
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1), 
            'User'
        );

        v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');

        -- C. GENERATE UNIQUE ID (Only if gym is assigned)
        IF v_gym_id IS NOT NULL THEN
            BEGIN
                v_final_id := public.generate_gym_member_id(v_gym_id);
            EXCEPTION WHEN OTHERS THEN
                v_final_id := NULL;
            END;
        ELSE
            v_final_id := NULL;
        END IF;

        -- D. UPSERT PUBLIC PROFILE
        -- If v_gym_id is NULL, the user remains 'unassigned' and AppNavigator will show GymSelection
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
            gym_id = COALESCE(public.users.gym_id, EXCLUDED.gym_id),
            unique_id = COALESCE(public.users.unique_id, EXCLUDED.unique_id),
            membership_status = COALESCE(public.users.membership_status, EXCLUDED.membership_status),
            updated_at = NOW();

    EXCEPTION WHEN OTHERS THEN
        -- FAILS SAFE: Bare minimum entry
        BEGIN
            INSERT INTO public.users (id, email, role, status, membership_status)
            VALUES (NEW.id, NEW.email, 'member', 'active', 'unassigned')
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END;

    RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

COMMIT;

NOTIFY pgrst, 'reload schema';
