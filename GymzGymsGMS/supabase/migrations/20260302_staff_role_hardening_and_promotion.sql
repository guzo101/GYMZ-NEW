-- ============================================================================
-- GYMZ: STAFF ROLE HARDENING + ADMIN-ONLY STAFF PROMOTION
-- Date: 2026-03-02
-- Purpose:
-- 1) Prevent self/escalated role tampering on public.users
-- 2) Enforce max 3 gym admins per gym
-- 3) Provide secure RPC for admin -> staff promotion/demotion
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Trigger guard: block unsafe role changes + cap admins per gym
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_user_role_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_actor_gym UUID;
    v_admin_count INTEGER;
BEGIN
    -- Trusted execution contexts (migrations/service operations).
    IF current_user = 'postgres' OR auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated role mutation is not allowed';
    END IF;

    SELECT role, gym_id
    INTO v_actor_role, v_actor_gym
    FROM public.users
    WHERE id = v_actor_id;

    -- Safety fallback if actor profile is missing.
    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Unable to resolve actor profile for role mutation';
    END IF;

    -- Prevent unsafe role edits.
    IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
        -- Super/platform admins can manage roles globally.
        IF v_actor_role IN ('platform_admin', 'super_admin') THEN
            NULL;
        -- Gym admins can only manage member<->staff in their own gym.
        ELSIF v_actor_role = 'admin'
            AND v_actor_gym IS NOT NULL
            AND v_actor_gym = OLD.gym_id
            AND OLD.role IN ('member', 'staff')
            AND NEW.role IN ('member', 'staff')
            AND v_actor_id <> OLD.id THEN
            NULL;
        ELSE
            RAISE EXCEPTION 'Role update is not permitted for this actor';
        END IF;
    END IF;

    -- Hard cap: maximum 3 admins per gym.
    IF NEW.role = 'admin' AND NEW.gym_id IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_admin_count
        FROM public.users u
        WHERE u.gym_id = NEW.gym_id
          AND u.role = 'admin'
          AND (TG_OP = 'INSERT' OR u.id <> NEW.id);

        IF v_admin_count >= 3 THEN
            RAISE EXCEPTION 'Admin limit reached: max 3 admins per gym';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_role_security ON public.users;
CREATE TRIGGER trg_enforce_user_role_security
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_role_security();


-- ---------------------------------------------------------------------------
-- 2) Secure RPC: promote member -> staff (admin-only, same gym)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_member_to_staff(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_actor_gym UUID;
    v_target_role TEXT;
    v_target_gym UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT role, gym_id
    INTO v_actor_role, v_actor_gym
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

    -- Gym admins can promote only members from their own gym.
    IF v_actor_role = 'admin' THEN
        IF v_actor_gym IS NULL OR v_target_gym IS NULL OR v_actor_gym <> v_target_gym THEN
            RAISE EXCEPTION 'Cross-gym staff promotion is not allowed';
        END IF;
        IF v_target_role <> 'member' THEN
            RAISE EXCEPTION 'Only members can be promoted to staff';
        END IF;
    ELSE
        RAISE EXCEPTION 'Only authorized admins can promote staff';
    END IF;

    UPDATE public.users
    SET role = 'staff',
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_member_to_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_member_to_staff(UUID) TO authenticated;


-- ---------------------------------------------------------------------------
-- 3) Secure RPC: demote staff -> member (admin-only, same gym)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demote_staff_to_member(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_actor_gym UUID;
    v_target_role TEXT;
    v_target_gym UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT role, gym_id
    INTO v_actor_role, v_actor_gym
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
    ELSE
        RAISE EXCEPTION 'Only authorized admins can demote staff';
    END IF;

    UPDATE public.users
    SET role = 'member',
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.demote_staff_to_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.demote_staff_to_member(UUID) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
