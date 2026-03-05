-- ============================================================================
-- DATA CLEANSING: PURGE CORRUPTED GOAL KEYWORDS
-- Purpose: 
-- 1. Identify "goal" values that contain descriptive text (corrupted by Health Assessment)
-- 2. Move that descriptive text to "secondary_objective" where it's safe
-- 3. Restore the "goal" to a valid scientific keyword if possible, else NULL
-- ============================================================================

BEGIN;

-- 1. Move descriptive assessment text to secondary_objective if goal is corrupted
-- Corruption check: If goal contains ':' or is longer than 20 chars (standard keywords are short)
UPDATE public.users
SET secondary_objective = goal,
    updated_at = NOW()
WHERE (goal LIKE '%:%' OR LENGTH(goal) > 20)
  AND (secondary_objective IS NULL OR secondary_objective = '');

-- 2. Repair goal column for these users
-- We try to restore a valid keyword based on what was in the description
-- or simply set to NULL so the trigger can pick up maintenance during the next update
UPDATE public.users
SET goal = CASE 
        WHEN goal ILIKE '%Muscle%' THEN 'build_muscle'
        WHEN goal ILIKE '%Weight%' AND goal ILIKE '%Loss%' THEN 'lose_weight'
        WHEN goal ILIKE '%Endurance%' THEN 'endurance'
        ELSE NULL -- If we can't tell, we set to NULL to stop the corruption
    END
WHERE goal LIKE '%:%' OR LENGTH(goal) > 20;

-- 3. Trigger recalculation for repaired profiles
UPDATE public.users
SET updated_at = NOW()
WHERE weight IS NOT NULL 
  AND height IS NOT NULL 
  AND age IS NOT NULL;

COMMIT;

-- Reload cache
NOTIFY pgrst, 'reload schema';
