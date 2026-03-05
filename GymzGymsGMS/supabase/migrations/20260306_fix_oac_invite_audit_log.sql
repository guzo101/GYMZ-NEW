-- Fix: admin_audit_logs for oac_invite_gym_admin
-- Run this to fix the oac_invite_gym_admin audit insert

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
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated. You must be logged in to invite gym admins.';
    END IF;
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Only platform administrators can invite gym admins.';
    END IF;

    SELECT name INTO v_gym_name FROM public.gyms WHERE id = p_gym_id;
    IF v_gym_name IS NULL THEN
        RAISE EXCEPTION 'Gym not found.';
    END IF;

    p_email := lower(trim(p_email));
    IF p_email = '' OR p_name IS NULL OR trim(p_name) = '' THEN
        RAISE EXCEPTION 'Email and name are required.';
    END IF;

    UPDATE public.gym_contacts
    SET is_active = false, updated_at = NOW()
    WHERE gym_id = p_gym_id AND lower(trim(email)) = p_email;

    INSERT INTO public.gym_contacts (
        gym_id, contact_type, name, role, email, phone, is_active
    ) VALUES (
        p_gym_id, 'primary', trim(p_name), 'admin', p_email, 'PND', true
    );

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

    -- Audit log: admin_id and target_user_id are NOT NULL; use actor as target when invitee not yet a user
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
