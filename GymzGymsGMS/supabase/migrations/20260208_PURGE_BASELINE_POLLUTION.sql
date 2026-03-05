-- ============================================================================
-- PURGE BASELINE POLLUTION
-- Purpose: 
-- 1. Identify users who received the hardcoded baseline (70kg, 170cm, 30yr)
-- 2. Reset their health metrics to NULL to force a regrouping
-- 3. Delete their inaccurate fitness goals
-- ============================================================================

BEGIN;

-- 1. Identify and reset users who have exactly the 'fake' baseline
-- We only reset them if they match all three exactly, to minimize false positives 
-- for anyone who might actually be 70kg, 170cm, and 30yrs old.
-- However, given the context of the recent 'spark', these are likely the targets.
UPDATE public.users
SET weight = NULL,
    height = NULL,
    age = NULL,
    updated_at = NOW()
WHERE weight::TEXT = '70' 
  AND height::TEXT = '170' 
  AND age::TEXT = '30';

-- 2. Clear out goals generated from incomplete/fake data
-- This forces the Dashboard to show "Set Goals" instead of a 2000 kcal placeholder
DELETE FROM public.user_fitness_goals
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE weight IS NULL OR height IS NULL OR age IS NULL
);

COMMIT;

-- Ensure schema cache is cleared
NOTIFY pgrst, 'reload schema';
