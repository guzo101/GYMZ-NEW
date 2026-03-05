-- ============================================================================
-- GYMZ: REFINED DURABLE ID LIFECYCLE
-- Date: 2026-02-26
-- Purpose: Implements EV- prefix for Event/Pending users & Professional ID upgrades.
-- ============================================================================

BEGIN;

-- 1. Enhance the ID Generator to support EV- prefix
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
    
    -- C. Atomically increment sequence for the gym
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

-- 2. Enhanced Trigger Function for Durable ID Lifecycle
CREATE OR REPLACE FUNCTION public.ensure_member_unique_id()
RETURNS TRIGGER AS $$
DECLARE
    v_is_event BOOLEAN;
    v_current_is_ev BOOLEAN;
BEGIN
    -- Determine if the user should have an EV prefix
    -- Logic: Prefix if (Event Access) OR (Not Active)
    v_is_event := (NEW.access_mode = 'event_access') OR (NEW.membership_status IS NULL OR NEW.membership_status <> 'Active');
    
    -- Check if current ID has EV prefix
    v_current_is_ev := (NEW.unique_id LIKE 'EV-%');

    -- SCENARIO A: Gym Switching (Always regenerate)
    IF NEW.gym_id IS NOT NULL AND (OLD.gym_id IS NULL OR NEW.gym_id <> OLD.gym_id) THEN
        RAISE NOTICE 'GYM SWITCH detected for user %. Regenerating ID.', NEW.id;
        NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, v_is_event);
        RETURN NEW;
    END IF;

    -- SCENARIO B: Initial Assignment (No ID yet)
    IF NEW.gym_id IS NOT NULL AND (NEW.unique_id IS NULL OR NEW.unique_id = '') THEN
        RAISE NOTICE 'INITIAL ASSIGNMENT for user %. Generating ID.', NEW.id;
        NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, v_is_event);
        RETURN NEW;
    END IF;

    -- SCENARIO C: UPGRADE (Event/Pending -> Active Gym Member)
    -- If they WERE v_is_event=true (had EV-) and ARE NOW v_is_event=false (Active Gym)
    IF NEW.unique_id IS NOT NULL AND v_current_is_ev AND NOT v_is_event THEN
        RAISE NOTICE 'UPGRADE detected for user %. Stripping EV prefix.', NEW.id;
        -- Strip 'EV-' and keep the rest (Professional ID)
        NEW.unique_id := SUBSTRING(NEW.unique_id FROM 4);
        RETURN NEW;
    END IF;

    -- SCENARIO D: Stability Check
    -- If they have no ID but have a gym (safety fallback)
    IF NEW.gym_id IS NOT NULL AND (NEW.unique_id IS NULL OR NEW.unique_id = '') THEN
         NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, v_is_event);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Trigger Attachment
-- We now need to watch gym_id, access_mode, AND membership_status
DROP TRIGGER IF EXISTS trigger_ensure_member_unique_id ON public.users;
CREATE TRIGGER trigger_ensure_member_unique_id
BEFORE UPDATE OF gym_id, access_mode, membership_status ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_member_unique_id();

-- 4. Correct existing IDs (Durable Backfill)
-- Prepend EV- to those who aren't Active gym members
UPDATE public.users 
SET unique_id = 'EV-' || unique_id
WHERE unique_id IS NOT NULL 
  AND NOT (unique_id LIKE 'EV-%')
  AND (access_mode = 'event_access' OR membership_status <> 'Active');

-- Strip EV- from those who are now Active gym members
UPDATE public.users 
SET unique_id = SUBSTRING(unique_id FROM 4)
WHERE unique_id LIKE 'EV-%'
  AND access_mode = 'gym_access' 
  AND membership_status = 'Active';

COMMIT;

NOTIFY pgrst, 'reload schema';
