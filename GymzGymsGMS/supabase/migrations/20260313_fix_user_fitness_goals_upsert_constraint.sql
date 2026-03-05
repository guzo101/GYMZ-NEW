-- ============================================================================
-- FIX: AI Calibration save fails with "no unique or exclusion constraint
--      matching the ON CONFLICT specifications"
-- ============================================================================
-- ROOT CAUSE: nutritionService.syncNutritionTargets() uses:
--   .upsert(..., { onConflict: 'user_id, is_active' })
-- The table must have a UNIQUE or exclusion constraint on (user_id, is_active).
-- Production may have partial unique index on (user_id) WHERE is_active=TRUE,
-- which does NOT match ON CONFLICT (user_id, is_active).
-- ============================================================================

BEGIN;

-- 1. Remove any partial unique indexes that don't match ON CONFLICT (user_id, is_active)
DROP INDEX IF EXISTS public.idx_user_fitness_goals_user_active_unique;
DROP INDEX IF EXISTS public.idx_user_fitness_goals_user_id_active_unique;

-- 2. Clean duplicates before adding constraint
--    UNIQUE (user_id, is_active) allows at most 2 rows per user: one active, one inactive.
--    Keep the most recently updated row for each (user_id, is_active) pair.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, is_active
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.user_fitness_goals
)
DELETE FROM public.user_fitness_goals
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3. Add the constraint that matches ON CONFLICT (user_id, is_active)
ALTER TABLE public.user_fitness_goals DROP CONSTRAINT IF EXISTS unique_user_active_goal;
ALTER TABLE public.user_fitness_goals ADD CONSTRAINT unique_user_active_goal
  UNIQUE (user_id, is_active);

COMMIT;
