-- ============================================================================
-- Sync steps into daily_calorie_summary.calories_burned
-- Date: 2026-04-08
-- Purpose:
--   1) Keep step counter untouched.
--   2) Ensure step logs automatically update calories_burned for the same day.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_daily_steps_to_calories_burned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gym_id uuid;
  v_calories_burned numeric;
BEGIN
  -- Lightweight baseline conversion:
  -- ~0.04 kcal per step (e.g., 10,000 steps ~= 400 kcal)
  v_calories_burned := GREATEST(COALESCE(NEW.steps, 0), 0) * 0.04;

  SELECT u.gym_id
    INTO v_gym_id
  FROM public.users u
  WHERE u.id = NEW.user_id
  LIMIT 1;

  INSERT INTO public.daily_calorie_summary (
    user_id,
    gym_id,
    date,
    calories_burned
  )
  VALUES (
    NEW.user_id,
    v_gym_id,
    NEW.date,
    v_calories_burned
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    calories_burned = EXCLUDED.calories_burned,
    gym_id = COALESCE(public.daily_calorie_summary.gym_id, EXCLUDED.gym_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_daily_steps_to_calories_burned ON public.daily_health_logs;
CREATE TRIGGER trg_sync_daily_steps_to_calories_burned
AFTER INSERT OR UPDATE OF steps ON public.daily_health_logs
FOR EACH ROW
EXECUTE FUNCTION public.sync_daily_steps_to_calories_burned();

-- Backfill existing health logs so current users get corrected calories_burned.
INSERT INTO public.daily_calorie_summary (user_id, gym_id, date, calories_burned)
SELECT
  dhl.user_id,
  u.gym_id,
  dhl.date,
  GREATEST(COALESCE(dhl.steps, 0), 0) * 0.04 AS calories_burned
FROM public.daily_health_logs dhl
LEFT JOIN public.users u ON u.id = dhl.user_id
ON CONFLICT (user_id, date)
DO UPDATE SET
  calories_burned = EXCLUDED.calories_burned,
  gym_id = COALESCE(public.daily_calorie_summary.gym_id, EXCLUDED.gym_id),
  updated_at = NOW();

COMMIT;
