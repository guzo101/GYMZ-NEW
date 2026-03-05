-- ============================================================================
-- GYMZ: Sustainable OAC Admin Invitation Flow
-- Purpose: Platform admin can invite gym admins by email. Invited users sign up
--          with their own password (secure - no credentials to "plug in").
-- Security: Only platform_admin or super_admin can invite gym admins.
-- ============================================================================

BEGIN;

-- ─── 1. RPC: Invite gym admin (platform admin only) ─────────────────────────
CREATE OR REPLACE FUNCTION public.oac_invite_gym_admin(
    p_gym_id UUID,
    p_email TEXT,
    p_name TEXT
) RETURNS JSONB AS $$
DECLARE
    v_gym_name TEXT;
    v_existing_user_id UUID;
    v_actor_id UUID;
BEGIN
    -- Must be authenticated and platform admin
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated. You must be logged in to invite gym admins.';
    END IF;
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Only platform administrators can invite gym admins.';
    END IF;

    -- Validate gym exists
    SELECT name INTO v_gym_name FROM public.gyms WHERE id = p_gym_id;
    IF v_gym_name IS NULL THEN
        RAISE EXCEPTION 'Gym not found.';
    END IF;

    -- Normalize email
    p_email := lower(trim(p_email));
    IF p_email = '' OR p_name IS NULL OR trim(p_name) = '' THEN
        RAISE EXCEPTION 'Email and name are required.';
    END IF;

    -- Deactivate any prior invite for this email at this gym
    UPDATE public.gym_contacts
    SET is_active = false, updated_at = NOW()
    WHERE gym_id = p_gym_id AND lower(trim(email)) = p_email;

    -- Insert new invite (invited person will get gym_id + role when they sign up)
    INSERT INTO public.gym_contacts (
        gym_id, contact_type, name, role, email, phone, is_active
    ) VALUES (
        p_gym_id, 'primary', trim(p_name), 'admin', p_email, 'PND', true
    );

    -- If user already exists, link them immediately (no need to wait for signup)
    SELECT id INTO v_existing_user_id FROM auth.users WHERE email = p_email;
    IF v_existing_user_id IS NOT NULL THEN
        INSERT INTO public.users (id, email, name, role, gym_id, status, membership_status, unique_id, updated_at)
        VALUES (
            v_existing_user_id,
            p_email,
            trim(p_name),
            'admin',
            p_gym_id,
            'active',
            'Active',
            public.generate_gym_member_id(p_gym_id),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            gym_id = p_gym_id,
            role = 'admin',
            name = trim(p_name),
            status = 'active',
            membership_status = 'Active',
            unique_id = public.generate_gym_member_id(p_gym_id),
            updated_at = NOW();
    END IF;

    -- Audit log (admin_id and target_user_id are NOT NULL in schema; use actor as placeholder when invitee not yet a user)
    v_actor_id := auth.uid();
    INSERT INTO public.admin_audit_logs (
        admin_id,
        target_user_id,
        action_type,
        actor_id,
        action,
        entity_type,
        entity_id,
        gym_id,
        new_value,
        created_at
    )
    VALUES (
        v_actor_id,
        COALESCE(v_existing_user_id, v_actor_id),
        'oac_invite_gym_admin',
        v_actor_id,
        'oac_invite_gym_admin',
        'gym_contact',
        p_gym_id,
        p_gym_id,
        jsonb_build_object('email', p_email, 'name', trim(p_name), 'gym_name', v_gym_name, 'existing_user', (v_existing_user_id IS NOT NULL)),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'gym_id', p_gym_id,
        'gym_name', v_gym_name,
        'email', p_email,
        'existing_user', (v_existing_user_id IS NOT NULL),
        'message', CASE
            WHEN v_existing_user_id IS NOT NULL THEN 'Admin linked immediately. They can log in now.'
            ELSE 'Invitation created. They must sign up at the app to set their password and access the dashboard.'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.oac_invite_gym_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.oac_invite_gym_admin TO service_role;

-- ─── 2. Update handle_new_user to use role from gym_contacts ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
AS $body$
DECLARE
    v_gym_id UUID;
    v_assigned_role TEXT;
    v_name TEXT;
    v_role TEXT;
    v_final_id TEXT;
    v_gym_exists BOOLEAN;
BEGIN
    BEGIN
        -- A. RESOLVE GYM_ID and ROLE from invitation (gym_contacts)
        BEGIN
            v_gym_id := (NEW.raw_user_meta_data->>'gym_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_gym_id := NULL;
        END;

        IF v_gym_id IS NULL THEN
            SELECT gc.gym_id, gc.role INTO v_gym_id, v_assigned_role
            FROM public.gym_contacts gc
            WHERE lower(gc.email) = lower(NEW.email)
              AND gc.is_active = true
            LIMIT 1;
        END IF;

        -- Verify gym exists
        IF v_gym_id IS NOT NULL THEN
            SELECT EXISTS (SELECT 1 FROM public.gyms WHERE id = v_gym_id) INTO v_gym_exists;
            IF NOT v_gym_exists THEN
                v_gym_id := NULL;
                v_assigned_role := NULL;
            END IF;
        END IF;

        -- B. RESOLVE IDENTITY
        v_name := COALESCE(
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1),
            'User'
        );

        -- Use role from gym_contacts invite when present, else metadata, else member
        v_role := COALESCE(v_assigned_role, NEW.raw_user_meta_data->>'role', 'member');

        -- C. GENERATE UNIQUE ID (only if gym assigned)
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
        INSERT INTO public.users (
            id, email, name, first_name, last_name, role, gym_id, unique_id,
            status, membership_status, marketing_consent, marketing_consent_date, created_at
        )
        VALUES (
            NEW.id, NEW.email, v_name,
            NEW.raw_user_meta_data->>'first_name',
            NEW.raw_user_meta_data->>'last_name',
            v_role, v_gym_id, v_final_id,
            'active',
            CASE WHEN v_gym_id IS NULL THEN 'unassigned' ELSE 'New' END,
            COALESCE((NEW.raw_user_meta_data->>'marketing_consent')::BOOLEAN, false),
            (NEW.raw_user_meta_data->>'marketing_consent_date')::TIMESTAMPTZ,
            NEW.created_at
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = COALESCE(public.users.name, EXCLUDED.name),
            role = COALESCE(EXCLUDED.role, public.users.role),
            gym_id = COALESCE(public.users.gym_id, EXCLUDED.gym_id),
            unique_id = COALESCE(public.users.unique_id, EXCLUDED.unique_id),
            membership_status = COALESCE(public.users.membership_status, EXCLUDED.membership_status),
            updated_at = NOW();

    EXCEPTION WHEN OTHERS THEN
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
