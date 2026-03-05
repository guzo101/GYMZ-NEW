-- ============================================================================
-- GYMZ: UNIFIED ID EXECUTION PACK (SUPER-MIGRATION)
-- Date: 2026-02-26
-- Purpose: Self-contained, robust script to install Durable ID logic 
--          and backfill all historical identifiers.
-- ============================================================================

BEGIN;

-- ─── 1. CORE DEPENDENCIES & HELPERS ──────────────────────────────────────────

-- Ensure short_code column exists for prefixes
ALTER TABLE public.gyms ADD COLUMN IF NOT EXISTS short_code TEXT;

-- Hardened prefix lookup
CREATE OR REPLACE FUNCTION public.get_gym_prefix(p_gym_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_code TEXT;
BEGIN
    SELECT short_code INTO v_code FROM public.gyms WHERE id = p_gym_id;
    IF v_code IS NULL OR v_code = '' THEN
        SELECT UPPER(SUBSTRING(name, 1, 2)) INTO v_code FROM public.gyms WHERE id = p_gym_id;
    END IF;
    RETURN COALESCE(v_code, 'GY');
END;
$$;

-- Ensure sequence table exists
CREATE TABLE IF NOT EXISTS public.gym_id_sequences (
    gym_id UUID PRIMARY KEY REFERENCES public.gyms(id) ON DELETE CASCADE,
    last_sequence_number INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. CORE ID GENERATOR (DURABLE VERSION) ──────────────────────────────────

-- Drop existing to avoid signature conflicts (uuid vs uuid, boolean)
DROP FUNCTION IF EXISTS public.generate_gym_member_id(UUID);

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
    -- A. Get Gym Prefix
    v_prefix := public.get_gym_prefix(p_gym_id);
    
    -- B. Get Year (YY format)
    v_year := to_char(CURRENT_DATE, 'YY');
    
    -- C. Atomically increment sequence
    INSERT INTO public.gym_id_sequences (gym_id, last_sequence_number)
    VALUES (p_gym_id, 1)
    ON CONFLICT (gym_id) DO UPDATE 
    SET last_sequence_number = gym_id_sequences.last_sequence_number + 1,
        updated_at = NOW()
    RETURNING last_sequence_number INTO v_new_seq;
    
    -- D. Format: SG260001
    v_final_id := v_prefix || v_year || LPAD(v_new_seq::text, 4, '0');
    
    -- E. Add Event prefix if applicable
    IF p_is_event THEN
        RETURN 'EV-' || v_final_id;
    END IF;
    
    RETURN v_final_id;
END;
$$;

-- ─── 3. TRIGGER ENGINE (DURABLE LIFECYCLE) ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_member_unique_id()
RETURNS TRIGGER AS $$
DECLARE
    v_is_event BOOLEAN;
    v_current_is_ev BOOLEAN;
BEGIN
    -- 1. Determine intended state
    v_is_event := (NEW.access_mode = 'event_access') 
                  OR (NEW.membership_status IS NULL OR NEW.membership_status <> 'Active');
    
    v_current_is_ev := (NEW.unique_id LIKE 'EV-%');

    -- 2. Scenario 1: Gym Switch
    IF NEW.gym_id IS NOT NULL AND (OLD.gym_id IS NULL OR NEW.gym_id <> OLD.gym_id) THEN
        NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, v_is_event);
        RETURN NEW;
    END IF;

    -- 3. Scenario 2: Missing ID
    IF NEW.gym_id IS NOT NULL AND (NEW.unique_id IS NULL OR NEW.unique_id = '') THEN
        NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, v_is_event);
        RETURN NEW;
    END IF;

    -- 4. Scenario 3: Upgrade Transformation (Strip EV-)
    IF NEW.unique_id IS NOT NULL AND v_current_is_ev AND NOT v_is_event THEN
        NEW.unique_id := SUBSTRING(NEW.unique_id FROM 4);
        RETURN NEW;
    END IF;

    -- 5. Scenario 4: Downgrade/Pending (Add EV- if missing)
    IF NEW.unique_id IS NOT NULL AND NOT v_current_is_ev AND v_is_event THEN
        NEW.unique_id := 'EV-' || NEW.unique_id;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attachment
DROP TRIGGER IF EXISTS trigger_ensure_member_unique_id ON public.users;
CREATE TRIGGER trigger_ensure_member_unique_id
BEFORE UPDATE OF gym_id, access_mode, membership_status ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_member_unique_id();

-- ─── 4. DEEP-CLEAN BACKFILL (HISTORICAL DATA) ────────────────────────────────

DO $$ BEGIN RAISE NOTICE 'Starting historical ID backfill...'; END; $$;

-- A. Clean prefixes for existing IDs
UPDATE public.users 
SET unique_id = 'EV-' || unique_id
WHERE unique_id IS NOT NULL 
  AND NOT (unique_id LIKE 'EV-%')
  AND ((access_mode = 'event_access') OR (membership_status IS NULL OR membership_status <> 'Active'));

UPDATE public.users 
SET unique_id = SUBSTRING(unique_id FROM 4)
WHERE unique_id LIKE 'EV-%'
  AND (access_mode = 'gym_access' OR access_mode IS NULL)
  AND membership_status = 'Active';

-- B. Assign IDs to those with NONE
WITH targets AS (
    SELECT 
        id, 
        gym_id,
        ((access_mode = 'event_access') OR (membership_status IS NULL OR membership_status <> 'Active')) as is_ev
    FROM public.users
    WHERE (unique_id IS NULL OR unique_id = '') 
      AND gym_id IS NOT NULL
)
UPDATE public.users u
SET unique_id = public.generate_gym_member_id(t.gym_id, t.is_ev)
FROM targets t
WHERE u.id = t.id;

-- C. Repair gym-prefix mismatches
DO $$
DECLARE
    r RECORD;
    v_pref TEXT;
    v_ev BOOLEAN;
BEGIN
    FOR r IN SELECT id, gym_id, unique_id, access_mode, membership_status FROM public.users WHERE gym_id IS NOT NULL AND unique_id IS NOT NULL LOOP
        v_pref := public.get_gym_prefix(r.gym_id);
        v_ev := (r.access_mode = 'event_access') OR (r.membership_status IS NULL OR r.membership_status <> 'Active');
        
        -- If current ID doesn't match the gym's code, regenerate
        IF NOT (REPLACE(r.unique_id, 'EV-', '') LIKE v_pref || '%') THEN
            UPDATE public.users SET unique_id = public.generate_gym_member_id(r.gym_id, v_ev) WHERE id = r.id;
        END IF;
    END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
DO $$ BEGIN RAISE NOTICE 'ID Migration Pack completed successfully.'; END; $$;
