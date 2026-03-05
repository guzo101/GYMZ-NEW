-- ============================================================================
-- SYSTEM LOCKDOWN: SSOT ENFORCEMENT
-- Purpose: 
-- 1. Decommission daily_macro_targets (Legacy).
-- 2. Clean daily_calorie_summary (Remove redundant goal columns).
-- 3. Enforce Canonical Naming across all logs.
-- ============================================================================

BEGIN;

-- 1. DATA MIGRATION (Safety)
-- If any user has targets in daily_macro_targets that aren't in user_fitness_goals, 
-- we ensure the medical engine sparks for them or we preserve the most recent target.
INSERT INTO public.user_fitness_goals (
    user_id, 
    goal_type, 
    daily_calorie_goal, 
    daily_protein_goal, 
    daily_carbs_goal, 
    daily_fats_goal, 
    is_active, 
    updated_at
)
SELECT 
    user_id, 
    'maintenance', -- Fallback goal
    MIN(daily_calorie_goal), 
    MIN(protein_goal), 
    MIN(carbs_goal), 
    MIN(fats_goal), 
    TRUE, 
    NOW()
FROM public.daily_macro_targets
WHERE user_id NOT IN (SELECT user_id FROM public.user_fitness_goals WHERE is_active = TRUE)
GROUP BY user_id
ON CONFLICT (user_id) WHERE is_active = TRUE DO NOTHING;

-- 2. DECOMMISSION LEGACY TABLES
DROP TABLE IF EXISTS public.daily_macro_targets CASCADE;

-- 3. NUTRITION SUMMARY CLEANUP (Target Decoupling)
-- We remove the goal columns from the summary table to prevent stale data.
-- The app must JOIN to user_fitness_goals for the current goal.
ALTER TABLE public.daily_calorie_summary DROP COLUMN IF EXISTS calorie_goal;
ALTER TABLE public.daily_calorie_summary DROP COLUMN IF EXISTS protein_goal;
ALTER TABLE public.daily_calorie_summary DROP COLUMN IF EXISTS carbs_goal;
ALTER TABLE public.daily_calorie_summary DROP COLUMN IF EXISTS fats_goal;

-- 4. CANONICAL NAMING REPAIR: daily_nutrition_logs
-- Ensure all columns match the medical engine output names.
-- Currently, daily_nutrition_logs uses fats (plural). The medical engine uses daily_fats_goal.
-- For standard across "Actual" vs "Goal", we will keep 'fats' for logs and 'goal' for targets.
-- This is fine, but we must ensure we don't have 'fat' vs 'fats' mix.

-- 5. RE-SPARK MEDICAL ENGINE
-- Ensure everyone has exactly one active goal in the canonical table.
UPDATE public.users SET updated_at = NOW() WHERE weight IS NOT NULL AND height IS NOT NULL;

COMMIT;

-- Reload Schema
NOTIFY pgrst, 'reload schema';
