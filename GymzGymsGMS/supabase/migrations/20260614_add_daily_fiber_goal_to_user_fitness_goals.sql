-- Add per-user daily fiber goal to active nutrition targets.
ALTER TABLE public.user_fitness_goals
ADD COLUMN IF NOT EXISTS daily_fiber_goal NUMERIC DEFAULT 30;

-- Backfill existing rows so UI always has a non-null goal.
UPDATE public.user_fitness_goals
SET daily_fiber_goal = 30
WHERE daily_fiber_goal IS NULL;
