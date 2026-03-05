-- Gymz Neural Engine: Database Synchronization Migration
-- Purpose: Harmonize database constraints with the app's internal fitness goals and enable robust upsert logic.

-- 1. Harmonize Goal Type Constraints
ALTER TABLE public.user_fitness_goals DROP CONSTRAINT IF EXISTS user_fitness_goals_goal_type_check;
ALTER TABLE public.user_fitness_goals ADD CHECK (goal_type IN (
    'lose_weight',    -- App internal: lose_weight
    'build_muscle',   -- App internal: build_muscle
    'recomp',         -- App internal: recomp
    'endurance',      -- App internal: endurance
    'weight_loss',    -- Legacy/Redundant
    'muscle_gain',    -- Legacy/Redundant
    'maintenance'     -- Legacy/Redundant
));

-- 2. Ensure goal_type has a default or allow null if it's strictly for calorie/macro tracking
ALTER TABLE public.user_fitness_goals ALTER COLUMN goal_type SET DEFAULT 'recomp';

-- 3. Enable Robust Upsert Logic
-- The nutritionService uses upsert with 'onConflict: user_id, is_active'.
-- This requires a unique constraint.
ALTER TABLE public.user_fitness_goals DROP CONSTRAINT IF EXISTS unique_user_active_goal;
ALTER TABLE public.user_fitness_goals ADD CONSTRAINT unique_user_active_goal UNIQUE (user_id, is_active);

-- 4. Enable Realtime for Goal Synchronization
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_fitness_goals;

-- 5. Trigger: Automated Nutrition Recalculation Baseline
-- This ensures that when a user's health metrics are updated in the 'users' table, 
-- we maintain a baseline goal record if one doesn't exist.
CREATE OR REPLACE FUNCTION fn_initialize_user_goals()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_fitness_goals (user_id, goal_type, is_active)
    VALUES (NEW.id, COALESCE(NEW.primary_objective, 'recomp'), TRUE)
    ON CONFLICT (user_id, is_active) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_init_goals ON public.users;
CREATE TRIGGER trg_init_goals
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION fn_initialize_user_goals();
