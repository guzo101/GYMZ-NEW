-- ============================================================================
-- GYMZ: HISTORICAL MEMBER ID BACKFILL
-- Date: 2026-02-26
-- Purpose: Ensures every user with a gym assigned has a valid, correctly
--          prefixed ID based on the new Durable ID Lifecycle.
-- ============================================================================

BEGIN;

-- 1. Correct Mis-prefixed Existing IDs
-- Ensure Event/Guest/Pending users HAVE the EV- prefix
UPDATE public.users 
SET unique_id = 'EV-' || unique_id
WHERE unique_id IS NOT NULL 
  AND NOT (unique_id LIKE 'EV-%')
  AND (access_mode = 'event_access' OR membership_status IS NULL OR membership_status <> 'Active');

-- Ensure Active Gym Members DON'T HAVE the EV- prefix
UPDATE public.users 
SET unique_id = SUBSTRING(unique_id FROM 4)
WHERE unique_id LIKE 'EV-%'
  AND (access_mode = 'gym_access' OR access_mode IS NULL)
  AND membership_status = 'Active';


-- 2. Backfill Missing IDs for Users with Gyms
-- Logic: For any user with a gym_id but NO unique_id, generate one.
-- Using a DO block to safely iterate if needed, but we can use a direct call if we are confident.
-- The function uses sequences so it's safe to call in bulk.

WITH targets AS (
    SELECT 
        id, 
        gym_id,
        ((access_mode = 'event_access') OR (membership_status IS NULL OR membership_status <> 'Active')) as should_be_event
    FROM public.users
    WHERE (unique_id IS NULL OR unique_id = '') 
      AND gym_id IS NOT NULL
)
UPDATE public.users u
SET unique_id = public.generate_gym_member_id(t.gym_id, t.should_be_event)
FROM targets t
WHERE u.id = t.id;

-- 3. Safety Check: Verify Gym Prefix Match
-- This is a 'soft repair' - if the ID prefix doesn't match the current gym's intended prefix,
-- we regenerate it. This handles historical gym switches that weren't captured by triggers.

DO $$
DECLARE
    r RECORD;
    v_target_prefix TEXT;
    v_is_event BOOLEAN;
BEGIN
    FOR r IN 
        SELECT u.id, u.gym_id, u.unique_id, u.access_mode, u.membership_status
        FROM public.users u
        WHERE u.gym_id IS NOT NULL AND u.unique_id IS NOT NULL
    LOOP
        -- Get expected prefix for this gym
        v_target_prefix := public.get_gym_prefix(r.gym_id);
        v_is_event := (r.access_mode = 'event_access') OR (r.membership_status IS NULL OR r.membership_status <> 'Active');

        -- If the ID (stripped of EV-) doesn't start with the gym's code, it's a mismatch
        IF NOT (REPLACE(r.unique_id, 'EV-', '') LIKE v_target_prefix || '%') THEN
            RAISE NOTICE 'Repairing ID mismatch for user % (Gym ID: %, ID: %). Regenerating...', r.id, r.gym_id, r.unique_id;
            UPDATE public.users 
            SET unique_id = public.generate_gym_member_id(r.gym_id, v_is_event)
            WHERE id = r.id;
        END IF;
    END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
