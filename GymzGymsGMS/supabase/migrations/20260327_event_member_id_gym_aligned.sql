-- ============================================================================
-- GYMZ: EVENT MEMBER ID — GYM-ALIGNED FORMAT (SF-E60045)
-- Date: 2026-03-27
-- Purpose:
--   Event members get IDs like SF-E60045 (gym prefix + E for event + sequence).
--   Gym members get SF-60045 (gym prefix + sequence).
--   Easy to identify, troubleshoot, and maintain security.
-- ============================================================================

BEGIN;

-- Ensure Sweat Factory has short_code SF (user preference for SF-E60045 style)
UPDATE public.gyms SET short_code = 'SF' WHERE name ILIKE '%Sweat Factory%' AND (short_code IS NULL OR short_code = '');

-- ─── 1. UPDATE generate_gym_member_id: New format ─────────────────────────────
-- Gym path:   {PREFIX}-{SEQ}     e.g. SF-60045
-- Event path: {PREFIX}-E{SEQ}    e.g. SF-E60045  (E = Event path)

CREATE OR REPLACE FUNCTION public.generate_gym_member_id(
    p_gym_id UUID,
    p_is_event BOOLEAN DEFAULT false
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_prefix TEXT;
    v_new_seq INTEGER;
    v_final_id TEXT;
BEGIN
    v_prefix := public.get_gym_prefix(p_gym_id);
    INSERT INTO public.gym_id_sequences (gym_id, last_sequence_number)
    VALUES (p_gym_id, 1)
    ON CONFLICT (gym_id) DO UPDATE
    SET last_sequence_number = gym_id_sequences.last_sequence_number + 1,
        updated_at = NOW()
    RETURNING last_sequence_number INTO v_new_seq;

    IF p_is_event THEN
        v_final_id := v_prefix || '-E' || LPAD(v_new_seq::text, 5, '0');
    ELSE
        v_final_id := v_prefix || '-' || LPAD(v_new_seq::text, 5, '0');
    END IF;

    RETURN v_final_id;
END;
$$;

-- ─── 2. UPDATE ensure_member_unique_id trigger ──────────────────────────────
-- Detect new format: *-E* = event, *-* (no E) = gym

CREATE OR REPLACE FUNCTION public.ensure_member_unique_id()
RETURNS TRIGGER AS $$
DECLARE
    v_is_event BOOLEAN;
    v_current_is_event BOOLEAN;
    v_prefix TEXT;
    v_seq TEXT;
BEGIN
    v_is_event := (NEW.access_mode = 'event_access');

    -- New format: PREFIX-E12345 = event, PREFIX-12345 = gym
    -- Legacy: EV-* = event, GY-* = gym
    v_current_is_event := (NEW.unique_id LIKE 'EV-%')
        OR (NEW.unique_id ~ '^[A-Z0-9]+-E[0-9]+$');

    IF NEW.gym_id IS NOT NULL AND (OLD.gym_id IS NULL OR NEW.gym_id <> OLD.gym_id) THEN
        NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, v_is_event);
        RETURN NEW;
    END IF;

    IF NEW.gym_id IS NOT NULL AND (NEW.unique_id IS NULL OR NEW.unique_id = '') THEN
        NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, v_is_event);
        RETURN NEW;
    END IF;

    -- Upgrade: event → gym (SF-E60045 → SF-60045, or EV-xxx → regenerate)
    IF NEW.unique_id IS NOT NULL AND v_current_is_event AND NOT v_is_event THEN
        IF NEW.unique_id ~ '^[A-Z0-9]+-E[0-9]+$' THEN
            v_prefix := (regexp_match(NEW.unique_id, '^([A-Z0-9]+)-E[0-9]+$'))[1];
            v_seq := (regexp_match(NEW.unique_id, '^[A-Z0-9]+-E([0-9]+)$'))[1];
            NEW.unique_id := v_prefix || '-' || v_seq;
        ELSE
            NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, false);
        END IF;
        RETURN NEW;
    END IF;

    -- Downgrade: gym → event (SF-60045 → SF-E60045, or GY-xxx → regenerate)
    IF NEW.unique_id IS NOT NULL AND NOT v_current_is_event AND v_is_event THEN
        IF NEW.unique_id ~ '^[A-Z0-9]+-[0-9]+$' AND NEW.unique_id NOT LIKE '%-E%' THEN
            v_prefix := (regexp_match(NEW.unique_id, '^([A-Z0-9]+)-[0-9]+$'))[1];
            v_seq := (regexp_match(NEW.unique_id, '^[A-Z0-9]+-([0-9]+)$'))[1];
            NEW.unique_id := v_prefix || '-E' || v_seq;
        ELSE
            NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, true);
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 3. UPDATE ensure_member_unique_id_for_user RPC ────────────────────────

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

    -- Regenerate if: missing, empty, legacy format (EV-/GY-/GYM-), or wrong path
    IF v_user.unique_id IS NULL OR v_user.unique_id = ''
       OR v_user.unique_id LIKE 'GYM-%'
       OR v_user.unique_id LIKE 'EV-%'
       OR v_user.unique_id LIKE 'GY-%'
       OR (v_is_event AND NOT (v_user.unique_id ~ '^[A-Z0-9]+-E[0-9]+$'))
       OR (NOT v_is_event AND (v_user.unique_id ~ '^[A-Z0-9]+-E[0-9]+$' OR v_user.unique_id NOT ~ '^[A-Z0-9]+-[0-9]+$')) THEN
        v_new_id := public.generate_gym_member_id(v_user.gym_id, v_is_event);
        UPDATE public.users SET unique_id = v_new_id, updated_at = NOW() WHERE id = p_user_id;
        RETURN jsonb_build_object('success', true, 'unique_id', v_new_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'unique_id', v_user.unique_id);
END;
$$;

-- ─── 4. Backfill: Convert legacy EV-/GY- to new format ──────────────────────

DO $$
DECLARE
    r RECORD;
    v_new_id TEXT;
    v_is_event BOOLEAN;
BEGIN
    FOR r IN
        SELECT id, gym_id, unique_id, access_mode
        FROM public.users
        WHERE gym_id IS NOT NULL
          AND unique_id IS NOT NULL
          AND unique_id <> ''
          AND (unique_id LIKE 'EV-%' OR unique_id LIKE 'GY-%')
    LOOP
        v_is_event := (r.access_mode = 'event_access');
        v_new_id := public.generate_gym_member_id(r.gym_id, v_is_event);
        UPDATE public.users SET unique_id = v_new_id, updated_at = NOW() WHERE id = r.id;
        RAISE NOTICE 'Backfilled user %: % -> %', r.id, r.unique_id, v_new_id;
    END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
DO $$ BEGIN RAISE NOTICE 'Event member ID format migration complete. New format: SF-E60045 (event), SF-60045 (gym).'; END $$;
