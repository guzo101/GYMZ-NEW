-- ============================================================================
-- Fix: admin_audit_logs for staff promotion/demotion
-- admin_id and target_user_id are NOT NULL; log_role_change_audit was omitting them
-- Also re-add audit logging to promote/demote RPCs
-- ============================================================================

BEGIN;

-- 1) Fix log_role_change_audit to include admin_id and target_user_id
CREATE OR REPLACE FUNCTION public.log_role_change_audit(
    p_actor_id UUID,
    p_actor_email TEXT,
    p_target_user_id UUID,
    p_target_gym UUID,
    p_old_role TEXT,
    p_new_role TEXT,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'admin_audit_logs'
    ) THEN
        INSERT INTO public.admin_audit_logs (
            admin_id,
            target_user_id,
            action_type,
            actor_id,
            action,
            entity_type,
            entity_id,
            gym_id,
            old_value,
            new_value,
            reason
        )
        VALUES (
            p_actor_id,
            p_target_user_id,
            'role_change',
            p_actor_id,
            'role_change',
            'users',
            p_target_user_id,
            p_target_gym,
            jsonb_build_object('role', p_old_role),
            jsonb_build_object('role', p_new_role),
            p_reason
        );
    END IF;
END;
$$;

-- 2) Re-add audit logging to promote_member_to_staff
CREATE OR REPLACE FUNCTION public.promote_member_to_staff(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_actor_gym UUID;
    v_actor_email TEXT;
    v_target_role TEXT;
    v_target_gym UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT role, gym_id, email
    INTO v_actor_role, v_actor_gym, v_actor_email
    FROM public.users
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Actor profile not found';
    END IF;

    SELECT role, gym_id
    INTO v_target_role, v_target_gym
    FROM public.users
    WHERE id = p_user_id;

    IF v_target_role IS NULL THEN
        RAISE EXCEPTION 'Target user not found';
    END IF;

    IF v_actor_role = 'admin' THEN
        IF v_actor_gym IS NULL OR v_target_gym IS NULL OR v_actor_gym <> v_target_gym THEN
            RAISE EXCEPTION 'Cross-gym staff promotion is not allowed';
        END IF;
        IF v_target_role <> 'member' THEN
            RAISE EXCEPTION 'Only members can be promoted to staff';
        END IF;
    ELSIF v_actor_role IN ('platform_admin', 'super_admin') THEN
        IF v_target_role <> 'member' THEN
            RAISE EXCEPTION 'Only members can be promoted to staff';
        END IF;
    ELSE
        RAISE EXCEPTION 'Only authorized admins can promote staff';
    END IF;

    PERFORM public.log_role_change_audit(
        v_actor_id,
        COALESCE(v_actor_email, ''),
        p_user_id,
        v_target_gym,
        v_target_role,
        'staff',
        'Admin promoted member to staff'
    );

    UPDATE public.users
    SET role = 'staff',
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$;

-- 3) Re-add audit logging to demote_staff_to_member
CREATE OR REPLACE FUNCTION public.demote_staff_to_member(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_actor_gym UUID;
    v_actor_email TEXT;
    v_target_role TEXT;
    v_target_gym UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT role, gym_id, email
    INTO v_actor_role, v_actor_gym, v_actor_email
    FROM public.users
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Actor profile not found';
    END IF;

    SELECT role, gym_id
    INTO v_target_role, v_target_gym
    FROM public.users
    WHERE id = p_user_id;

    IF v_target_role IS NULL THEN
        RAISE EXCEPTION 'Target user not found';
    END IF;

    IF v_actor_role = 'admin' THEN
        IF v_actor_gym IS NULL OR v_target_gym IS NULL OR v_actor_gym <> v_target_gym THEN
            RAISE EXCEPTION 'Cross-gym staff demotion is not allowed';
        END IF;
        IF v_target_role <> 'staff' THEN
            RAISE EXCEPTION 'Only staff can be demoted';
        END IF;
    ELSIF v_actor_role IN ('platform_admin', 'super_admin') THEN
        IF v_target_role <> 'staff' THEN
            RAISE EXCEPTION 'Only staff can be demoted';
        END IF;
    ELSE
        RAISE EXCEPTION 'Only authorized admins can demote staff';
    END IF;

    PERFORM public.log_role_change_audit(
        v_actor_id,
        COALESCE(v_actor_email, ''),
        p_user_id,
        v_target_gym,
        v_target_role,
        'member',
        'Admin demoted staff to member'
    );

    UPDATE public.users
    SET role = 'member',
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
