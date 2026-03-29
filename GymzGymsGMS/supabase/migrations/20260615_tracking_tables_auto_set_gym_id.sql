-- ============================================================================
-- TRACKING TABLES: AUTO-SET gym_id FOR NEW ROWS
-- Date: 2026-06-15
-- Purpose:
-- 1) Ensure new rows in body_metrics/user_fitness_goals/daily_calorie_summary
--    inherit gym_id from users when app payload omits gym_id.
-- 2) Backfill existing NULL gym_id rows so gym-scoped admin RLS can read them.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.tracking_tables_set_gym_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.gym_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT u.gym_id
      INTO NEW.gym_id
    FROM public.users u
    WHERE u.id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_body_metrics_set_gym_id ON public.body_metrics;
CREATE TRIGGER trg_body_metrics_set_gym_id
  BEFORE INSERT ON public.body_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.tracking_tables_set_gym_id();

DROP TRIGGER IF EXISTS trg_user_fitness_goals_set_gym_id ON public.user_fitness_goals;
CREATE TRIGGER trg_user_fitness_goals_set_gym_id
  BEFORE INSERT ON public.user_fitness_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.tracking_tables_set_gym_id();

DROP TRIGGER IF EXISTS trg_daily_calorie_summary_set_gym_id ON public.daily_calorie_summary;
CREATE TRIGGER trg_daily_calorie_summary_set_gym_id
  BEFORE INSERT ON public.daily_calorie_summary
  FOR EACH ROW
  EXECUTE FUNCTION public.tracking_tables_set_gym_id();

UPDATE public.body_metrics bm
SET gym_id = u.gym_id
FROM public.users u
WHERE bm.user_id = u.id
  AND bm.gym_id IS NULL
  AND u.gym_id IS NOT NULL;

UPDATE public.user_fitness_goals ufg
SET gym_id = u.gym_id
FROM public.users u
WHERE ufg.user_id = u.id
  AND ufg.gym_id IS NULL
  AND u.gym_id IS NOT NULL;

UPDATE public.daily_calorie_summary dcs
SET gym_id = u.gym_id
FROM public.users u
WHERE dcs.user_id = u.id
  AND dcs.gym_id IS NULL
  AND u.gym_id IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
