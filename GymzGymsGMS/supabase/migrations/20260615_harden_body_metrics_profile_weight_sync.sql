-- ============================================================================
-- HARDEN body_metrics -> users.weight SYNC
-- Date: 2026-06-15
-- Purpose:
-- 1) Prevent historical/backdated body_metrics inserts from overwriting current
--    users.weight.
-- 2) Only propagate NEW.weight when NEW.date is the latest metric date
--    for that user (or tied for latest date).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_propagate_body_metrics_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_metric_date DATE;
BEGIN
  SELECT MAX(bm.date)
    INTO v_max_metric_date
  FROM public.body_metrics bm
  WHERE bm.user_id = NEW.user_id;

  IF v_max_metric_date IS NOT NULL AND NEW.date < v_max_metric_date THEN
    RETURN NEW;
  END IF;

  UPDATE public.users
  SET
    weight = NEW.weight,
    updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_body_metrics_to_profile ON public.body_metrics;
CREATE TRIGGER trg_body_metrics_to_profile
AFTER INSERT OR UPDATE OF weight, date ON public.body_metrics
FOR EACH ROW
EXECUTE FUNCTION public.fn_propagate_body_metrics_to_profile();

COMMIT;

NOTIFY pgrst, 'reload schema';
