-- ============================================================================
-- FIX: user_fitness_goals_goal_type_check violates when app sends lose_weight/build_muscle
-- ============================================================================
-- ROOT CAUSE: HealthMetricsScreen uses lose_weight, build_muscle, recomp.
-- Production constraint may only allow weight_loss, muscle_gain (legacy names).
-- ============================================================================

ALTER TABLE public.user_fitness_goals DROP CONSTRAINT IF EXISTS user_fitness_goals_goal_type_check;

ALTER TABLE public.user_fitness_goals ADD CONSTRAINT user_fitness_goals_goal_type_check
CHECK (goal_type IN (
    'lose_weight',    -- App UI (HealthMetricsScreen)
    'build_muscle',   -- App UI (HealthMetricsScreen)
    'recomp',         -- App UI (HealthMetricsScreen)
    'weight_loss',    -- Legacy
    'weight_gain',    -- Legacy
    'muscle_gain',    -- Legacy
    'maintenance',
    'endurance',
    'strength'
));
