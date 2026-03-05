-- ============================================================================
-- GYMZ PLATFORM: LEGACY DATA CONSOLIDATION (ROBUST VERSION)
-- Purpose: Consolidate ALL orphaned users, their metrics, and records.
-- ============================================================================

-- STEP 1: FIX SCHEMA TYPES
-- We convert these columns to numbers first using explicit casting.
-- This part is outside the block to ensure schema is committed first.
ALTER TABLE public.users ALTER COLUMN height TYPE NUMERIC USING (NULLIF(height, '')::NUMERIC);
ALTER TABLE public.users ALTER COLUMN weight TYPE NUMERIC USING (NULLIF(weight, '')::NUMERIC);

-- STEP 2: CONSOLIDATE DATA
DO $MIGRATE$
DECLARE
    v_gym_id UUID;
BEGIN
    -- 1. IDENTIFY TARGET GYM
    SELECT id INTO v_gym_id FROM public.gyms WHERE slug = 'sweat-factory' LIMIT 1;
    IF v_gym_id IS NULL THEN
        RAISE EXCEPTION 'Target Gym (sweat-factory) not found! Please check your gyms table.';
    END IF;

    -- 2. MOVE ORPHANED USERS TO SWEAT FACTORY
    -- This automatically makes their payments and records visible in GMS for this gym.
    UPDATE public.users 
    SET gym_id = v_gym_id 
    WHERE gym_id IS NULL                      -- Users with no gym
       OR NOT EXISTS (SELECT 1 FROM public.gyms g WHERE g.id = users.gym_id); -- Users with deleted/invalid gyms

    -- 3. RECOVER BIOMETRIC DATA FROM METADATA
    -- Now that columns are numeric, we safely migrate trapped data.
    UPDATE public.users
    SET 
        height = COALESCE(height, (NULLIF(metadata->>'height', ''))::NUMERIC),
        weight = COALESCE(weight, (NULLIF(metadata->>'weight', ''))::NUMERIC),
        age = COALESCE(age, (NULLIF(metadata->>'age', ''))::INTEGER),
        gender = COALESCE(gender, NULLIF(metadata->>'gender', '')),
        goal = COALESCE(goal, NULLIF(metadata->>'fitnessGoal', '')),
        target_weight = COALESCE(target_weight, (NULLIF(metadata->>'target_weight', ''))::NUMERIC)
    WHERE metadata IS NOT NULL 
      AND (height IS NULL OR weight IS NULL OR age IS NULL);

    -- 4. RESTORE MEMBERSHIP STATUS
    -- Force "Active" if they have successfully paid or have an active subscription.
    UPDATE public.users u
    SET membership_status = 'Active'
    WHERE (membership_status IS NULL OR membership_status != 'Active')
      AND (
          EXISTS (SELECT 1 FROM public.payments p WHERE p.user_id = u.id AND p.status IN ('Approved', 'completed'))
          OR 
          EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id AND s.status = 'active')
      );

    -- 5. CLEAN UP POLLUTION (Fix accidental fallbacks)
    UPDATE public.users
    SET 
      height = (NULLIF(metadata->>'height', ''))::NUMERIC,
      weight = (NULLIF(NULLIF(metadata->>'weight', ''), '0'))::NUMERIC
    WHERE height = 170 AND weight = 70 AND metadata->>'height' IS NOT NULL;

END $MIGRATE$;

-- STEP 3: REFRESH SYSTEM
NOTIFY pgrst, 'reload schema';
