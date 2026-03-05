-- ============================================================================
-- GYMZ: USER SYNC REPAIR PACK
-- Date: 2026-02-26
-- Purpose: Fixes users with missing IDs due to NULL gym_id and repairs
--          specific cases reported by user.
-- ============================================================================

BEGIN;

-- 1. Constants
DO $$
DECLARE
    v_default_gym_id UUID := '66874288-028a-495b-b98a-ceddf94876b6'; -- The Sweat Factory
BEGIN
    -- 2. REPAIR: Assign default gym to anyone with activity but no gym_id
    -- This ensures IDs can be generated for nutrition-path users.
    UPDATE public.users 
    SET gym_id = v_default_gym_id
    WHERE gym_id IS NULL 
      AND (access_mode = 'gym_access' OR id IN (SELECT user_id FROM public.payments));

    -- 3. SPECIFIC REPAIR: outreach@msafiristudios.com
    -- Ensure he is Active and has a gym assigned
    UPDATE public.users
    SET gym_id = v_default_gym_id,
        membership_status = 'Active',
        access_mode = 'gym_access',
        payment_status = 'completed'
    WHERE email = 'outreach@msafiristudios.com';

    -- 4. SECURITY FIX: Ensure users can see their own sensitive columns (unique_id, gym_id)
    -- This unblocks the "Missing Gym Mapping" issue in the mobile app.
    DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
    CREATE POLICY "Users can view their own profile" 
    ON public.users FOR SELECT 
    USING (auth.uid() = id);

    -- 5. TRIGGER UPDATE: Ensure new payments automatically assign a gym if missing
    -- We enhance the existing handle_new_payment_status
    CREATE OR REPLACE FUNCTION public.handle_new_payment_status()
    RETURNS TRIGGER AS $func$
    BEGIN
        IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
            UPDATE public.users 
            SET membership_status = 'Pending',
                payment_status = 'pending',
                access_mode = 'gym_access',
                gym_id = COALESCE(gym_id, '66874288-028a-495b-b98a-ceddf94876b6'), -- Default gym if none
                updated_at = NOW()
            WHERE id = NEW.user_id;
        END IF;
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 5. RUN BACKFILL REPAIR (Since triggers might not caught the gym_id change)
    -- This will generate the unique_id for outreach and others we just fixed
    UPDATE public.users u
    SET unique_id = public.generate_gym_member_id(u.gym_id, false)
    WHERE email = 'outreach@msafiristudios.com' OR (unique_id IS NULL AND gym_id IS NOT NULL);

END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
DO $$ BEGIN RAISE NOTICE 'User Sync Repair Pack completed.'; END; $$;
