-- ============================================================================
-- GYMZ: TOTAL ID ALIGNMENT PACK (FINAL REPAIR)
-- Date: 2026-02-26
-- Purpose: Force-aligns every single user record to have a gym_id and unique_id.
--          Covers Nutrition path, Event path, and platform-level users.
-- ============================================================================

BEGIN;

-- 1. Constants
DO $$
DECLARE
    v_default_gym_id UUID := '66874288-028a-495b-b98a-ceddf94876b6'; -- The Sweat Factory
    v_legacy_gym_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN
    -- 2. FORCE GYM ASSIGNMENT
    -- Any user without a gym_id is assigned to the canonical gym.
    -- This is required because ID generation depends on get_gym_prefix().
    UPDATE public.users 
    SET gym_id = v_default_gym_id
    WHERE gym_id IS NULL OR gym_id = v_legacy_gym_id;

    -- 3. SPECIFIC USER REPAIRS (Wildcard match for "icusu" and "outreach")
    -- This ensures any account matching the user's report is explicitly professionalized.
    UPDATE public.users
    SET membership_status = 'Active',
        access_mode = 'gym_access',
        payment_status = 'completed'
    WHERE (email ILIKE '%icusu%' OR email ILIKE '%outreach%' OR name ILIKE '%icusu%')
      AND (membership_status IS NULL OR membership_status = 'Pending' OR membership_status = 'Inactive');

    -- 4. TOTAL ID BACKFILL
    -- Generate IDs for ANYONE who is still missing one, now that everyone has a gym_id.
    -- We use a loop to avoid sequence collision during bulk update.
    DECLARE
        r RECORD;
        v_is_ev BOOLEAN;
    BEGIN
        FOR r IN 
            SELECT id, gym_id, access_mode, membership_status 
            FROM public.users 
            WHERE unique_id IS NULL OR unique_id = ''
        LOOP
            v_is_ev := (r.access_mode = 'event_access') 
                       OR (r.membership_status IS NULL OR r.membership_status <> 'Active');
            
            UPDATE public.users 
            SET unique_id = public.generate_gym_member_id(r.gym_id, v_is_ev)
            WHERE id = r.id;
        END LOOP;
    END;

    -- 5. FINAL AUDIT: Repair any mismatches between ID prefix and current gym
    DECLARE
        r RECORD;
        v_pref TEXT;
    BEGIN
        FOR r IN 
            SELECT id, gym_id, unique_id, access_mode, membership_status 
            FROM public.users 
            WHERE gym_id IS NOT NULL AND unique_id IS NOT NULL
        LOOP
            v_pref := public.get_gym_prefix(r.gym_id);
            
            -- If the professional part of the ID doesn't match the gym prefix, regenerate.
            -- Using REPLACE to handle both EV- and non-EV- formats.
            IF NOT (REPLACE(r.unique_id, 'EV-', '') LIKE v_pref || '%') THEN
                UPDATE public.users 
                SET unique_id = public.generate_gym_member_id(r.gym_id, (r.unique_id LIKE 'EV-%'))
                WHERE id = r.id;
            END IF;
        END LOOP;
    END;

END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
DO $$ BEGIN RAISE NOTICE 'Total ID Alignment completed successfully.'; END; $$;
