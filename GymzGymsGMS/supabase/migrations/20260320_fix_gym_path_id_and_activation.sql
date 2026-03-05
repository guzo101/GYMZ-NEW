-- ============================================================================
-- GYMZ: FIX GYM PATH ID (EV->GY) + ACTIVATION SYNC
-- Date: 2026-03-20
-- Purpose: 
--   1. Gym path users must get GY- prefix (not EV-) regardless of membership_status
--   2. Fix gym_access users who wrongly have EV- prefix
--   3. Sync users with approved payments to Active when status stuck as unassigned
-- ============================================================================

BEGIN;

-- ─── 1. FIX TRIGGER: Use access_mode ONLY for event vs gym (not membership_status) ───

CREATE OR REPLACE FUNCTION public.ensure_member_unique_id()
RETURNS TRIGGER AS $$
DECLARE
    v_is_event BOOLEAN;
    v_current_is_ev BOOLEAN;
    v_core_id TEXT;
BEGIN
    -- Path is determined by access_mode only. Gym path = GY-, Event path = EV-
    v_is_event := (NEW.access_mode = 'event_access');
    v_current_is_ev := (NEW.unique_id LIKE 'EV-%');

    IF NEW.gym_id IS NOT NULL AND (OLD.gym_id IS NULL OR NEW.gym_id <> OLD.gym_id) THEN
        NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, v_is_event);
        RETURN NEW;
    END IF;

    IF NEW.gym_id IS NOT NULL AND (NEW.unique_id IS NULL OR NEW.unique_id = '') THEN
        NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, v_is_event);
        RETURN NEW;
    END IF;

    -- Upgrade: event → gym (EV-xxx → GY-xxx)
    IF NEW.unique_id IS NOT NULL AND v_current_is_ev AND NOT v_is_event THEN
        v_core_id := SUBSTRING(NEW.unique_id FROM 4);
        NEW.unique_id := 'GY-' || v_core_id;
        RETURN NEW;
    END IF;

    -- Downgrade: gym → event (GY-xxx or legacy naked → EV-xxx)
    IF NEW.unique_id IS NOT NULL AND NOT v_current_is_ev AND v_is_event THEN
        v_core_id := TRIM(REPLACE(REPLACE(NEW.unique_id, 'EV-', ''), 'GY-', ''));
        IF v_core_id = '' THEN v_core_id := NEW.unique_id; END IF;
        NEW.unique_id := 'EV-' || v_core_id;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 2. FIX RPC: Use access_mode only ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_member_unique_id_for_user(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user RECORD;
    v_new_id TEXT;
    v_is_event BOOLEAN;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        IF NOT public.is_gym_admin((SELECT gym_id FROM public.users WHERE id = p_user_id)) 
           AND NOT public.is_platform_admin() THEN
            RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
        END IF;
    END IF;
    
    SELECT id, gym_id, unique_id, access_mode, membership_status
    INTO v_user FROM public.users WHERE id = p_user_id;
    
    IF v_user.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
    END IF;
    
    IF v_user.gym_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'no_gym');
    END IF;
    
    v_is_event := (v_user.access_mode = 'event_access');
    
    -- Regenerate if: missing, empty, wrong format, or gym_access with EV- prefix
    IF v_user.unique_id IS NULL OR v_user.unique_id = '' 
       OR v_user.unique_id LIKE 'GYM-%'
       OR (v_user.unique_id NOT LIKE 'EV-%' AND v_user.unique_id NOT LIKE 'GY-%')
       OR (NOT v_is_event AND v_user.unique_id LIKE 'EV-%') THEN
        v_new_id := public.generate_gym_member_id(v_user.gym_id, v_is_event);
        UPDATE public.users SET unique_id = v_new_id, updated_at = NOW() WHERE id = p_user_id;
        RETURN jsonb_build_object('success', true, 'unique_id', v_new_id);
    END IF;
    
    RETURN jsonb_build_object('success', true, 'unique_id', v_user.unique_id);
END;
$$;

-- ─── 3. Backfill: gym_access users with EV- prefix → GY- ────────────────────────

DO $$
DECLARE
    r RECORD;
    v_core_id TEXT;
BEGIN
    FOR r IN 
        SELECT id, gym_id, unique_id, access_mode 
        FROM public.users 
        WHERE gym_id IS NOT NULL 
          AND (access_mode = 'gym_access' OR access_mode IS NULL)
          AND unique_id IS NOT NULL 
          AND unique_id <> ''
          AND unique_id LIKE 'EV-%'
    LOOP
        v_core_id := SUBSTRING(r.unique_id FROM 4);
        UPDATE public.users SET unique_id = 'GY-' || v_core_id, updated_at = NOW() WHERE id = r.id;
        RAISE NOTICE 'Fixed gym user %: EV-% -> GY-%', r.id, v_core_id, v_core_id;
    END LOOP;
END $$;

-- ─── 4. Sync: Users with approved/completed payment but status unassigned → Active ───

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT DISTINCT u.id, u.email, u.membership_status
        FROM public.users u
        JOIN public.payments p ON (p.user_id = u.id OR p.member_id = u.id)
        WHERE p.status IN ('completed', 'approved', 'paid', 'success')
          AND (u.membership_status IS NULL OR LOWER(TRIM(u.membership_status)) IN ('unassigned', 'pending', 'new'))
    LOOP
        UPDATE public.users 
        SET membership_status = 'Active', payment_status = 'completed', updated_at = NOW() 
        WHERE id = r.id;
        RAISE NOTICE 'Synced user % (%) to Active (had approved payment)', r.email, r.id;
    END LOOP;
END $$;

COMMIT;
