-- ============================================================================
-- GYMZ: ID FORMAT EV-SW26007 / GY-SW23006 + ENSURE RPC
-- Date: 2026-03-19
-- Purpose: 
--   1. Event path: EV-{GYM_INITIALS}{YY}{SEQ} (e.g. EV-SW26007)
--   2. Gym path:   GY-{GYM_INITIALS}{YY}{SEQ} (e.g. GY-SW23006)
--   3. RPC for app to ensure proper ID when approved (no client-side GYM-XXXXX)
-- ============================================================================

BEGIN;

-- Ensure Sweat Factory (and similar) have short_code for EV-SW / GY-SW format
UPDATE public.gyms SET short_code = 'SW' WHERE name ILIKE '%Sweat Factory%' AND (short_code IS NULL OR short_code = '');

-- ─── 1. UPDATE generate_gym_member_id: GY- prefix for gym path ───────────────

CREATE OR REPLACE FUNCTION public.generate_gym_member_id(
    p_gym_id UUID,
    p_is_event BOOLEAN DEFAULT false
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_prefix TEXT;
    v_year TEXT;
    v_new_seq INTEGER;
    v_final_id TEXT;
BEGIN
    v_prefix := public.get_gym_prefix(p_gym_id);
    v_year := to_char(CURRENT_DATE, 'YY');
    INSERT INTO public.gym_id_sequences (gym_id, last_sequence_number)
    VALUES (p_gym_id, 1)
    ON CONFLICT (gym_id) DO UPDATE 
    SET last_sequence_number = gym_id_sequences.last_sequence_number + 1,
        updated_at = NOW()
    RETURNING last_sequence_number INTO v_new_seq;
    
    v_final_id := v_prefix || v_year || LPAD(v_new_seq::text, 4, '0');
    
    IF p_is_event THEN
        RETURN 'EV-' || v_final_id;
    END IF;
    RETURN 'GY-' || v_final_id;
END;
$$;

-- ─── 2. UPDATE ensure_member_unique_id trigger for EV-/GY- format ─────────────

CREATE OR REPLACE FUNCTION public.ensure_member_unique_id()
RETURNS TRIGGER AS $$
DECLARE
    v_is_event BOOLEAN;
    v_current_is_ev BOOLEAN;
    v_core_id TEXT;
BEGIN
    v_is_event := (NEW.access_mode = 'event_access') 
                  OR (NEW.membership_status IS NULL OR NEW.membership_status <> 'Active');
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

-- ─── 3. RPC: ensure_member_unique_id_for_user ───────────────────────────────
-- Call from app when user is approved but has no/wrong ID (e.g. GYM-OWRQD).
-- Regenerates proper EV-SW26007 or GY-SW23006 format.

CREATE OR REPLACE FUNCTION public.ensure_member_unique_id_for_user(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user RECORD;
    v_new_id TEXT;
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
    
    -- Regenerate if: missing, empty, or wrong format (GYM-*, or doesn't match EV-/GY-{PREFIX})
    IF v_user.unique_id IS NULL OR v_user.unique_id = '' 
       OR v_user.unique_id LIKE 'GYM-%'
       OR (v_user.unique_id NOT LIKE 'EV-%' AND v_user.unique_id NOT LIKE 'GY-%') THEN
        v_new_id := public.generate_gym_member_id(
            v_user.gym_id,
            (v_user.access_mode = 'event_access') 
            OR (v_user.membership_status IS NULL OR v_user.membership_status <> 'Active')
        );
        UPDATE public.users SET unique_id = v_new_id, updated_at = NOW() WHERE id = p_user_id;
        RETURN jsonb_build_object('success', true, 'unique_id', v_new_id);
    END IF;
    
    RETURN jsonb_build_object('success', true, 'unique_id', v_user.unique_id);
END;
$$;

-- ─── 4. Backfill: Fix existing GYM-* and naked IDs to proper EV-/GY- format ───

DO $$
DECLARE
    r RECORD;
    v_new_id TEXT;
    v_is_event BOOLEAN;
BEGIN
    -- GYM-* or NULL/empty: regenerate via DB
    FOR r IN 
        SELECT id, gym_id, unique_id, access_mode, membership_status 
        FROM public.users 
        WHERE gym_id IS NOT NULL 
          AND (unique_id LIKE 'GYM-%' OR unique_id IS NULL OR unique_id = '')
    LOOP
        v_is_event := (r.access_mode = 'event_access') 
                      OR (r.membership_status IS NULL OR r.membership_status <> 'Active');
        v_new_id := public.generate_gym_member_id(r.gym_id, v_is_event);
        UPDATE public.users SET unique_id = v_new_id, updated_at = NOW() WHERE id = r.id;
        RAISE NOTICE 'Backfilled user %: % -> %', r.id, r.unique_id, v_new_id;
    END LOOP;
    -- Naked format (SW26007): add GY- prefix; event path add EV-
    FOR r IN 
        SELECT id, gym_id, unique_id, access_mode, membership_status 
        FROM public.users 
        WHERE gym_id IS NOT NULL 
          AND unique_id IS NOT NULL AND unique_id <> ''
          AND unique_id NOT LIKE 'EV-%' AND unique_id NOT LIKE 'GY-%'
    LOOP
        v_is_event := (r.access_mode = 'event_access') 
                      OR (r.membership_status IS NULL OR r.membership_status <> 'Active');
        IF v_is_event THEN
            UPDATE public.users SET unique_id = 'EV-' || r.unique_id, updated_at = NOW() WHERE id = r.id;
        ELSE
            UPDATE public.users SET unique_id = 'GY-' || r.unique_id, updated_at = NOW() WHERE id = r.id;
        END IF;
        RAISE NOTICE 'Prefixed user %: %', r.id, r.unique_id;
    END LOOP;
END $$;

COMMIT;
