-- One-time backfill: align existing daily_fiber_goal with calorie-based formula
-- Formula: 14g per 1000 kcal, clamped to [25g, 45g]
UPDATE public.user_fitness_goals
SET daily_fiber_goal = LEAST(
  45,
  GREATEST(
    25,
    ROUND((COALESCE(daily_calorie_goal, 1800) / 1000.0) * 14)
  )
)
WHERE daily_fiber_goal IS NOT NULL;
