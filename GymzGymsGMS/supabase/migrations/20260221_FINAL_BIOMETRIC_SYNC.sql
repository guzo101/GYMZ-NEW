-- ============================================================
-- FINAL BIOMETRIC PROJECTION SYNC
-- Purpose: Ensure 'goal' and 'primary_objective' are aligned
-- and trigger the Neural Engine for BMI/BMR recalculation.
-- ============================================================

BEGIN;

-- 1. Sync goal columns from metadata for legacy users
-- This ensures the App (using 'goal') and GMS (using 'primary_objective') are both happy.
UPDATE public.users
SET 
  goal = COALESCE(goal, metadata->>'goal', metadata->>'fitnessGoal'),
  primary_objective = COALESCE(primary_objective, metadata->>'goal', metadata->>'fitnessGoal'),
  height = COALESCE(height, (metadata->>'height')::NUMERIC),
  weight = COALESCE(weight, NULLIF(metadata->>'weight', '')::NUMERIC),
  age = COALESCE(age, (metadata->>'age')::INTEGER),
  gender = COALESCE(gender, metadata->>'gender'),
  -- Ensure updated_at is touched to fire the fn_recalculate_user_nutrition trigger
  updated_at = NOW()
WHERE 
  metadata IS NOT NULL 
  AND (goal IS NULL OR primary_objective IS NULL OR height IS NULL OR weight IS NULL OR age IS NULL);

-- 2. Cross-pollinate if one is set but not the other
UPDATE public.users
SET 
  goal = COALESCE(goal, primary_objective),
  primary_objective = COALESCE(primary_objective, goal),
  updated_at = NOW()
WHERE 
  (goal IS NOT NULL AND primary_objective IS NULL) OR 
  (primary_objective IS NOT NULL AND goal IS NULL);

COMMIT;

-- Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';
