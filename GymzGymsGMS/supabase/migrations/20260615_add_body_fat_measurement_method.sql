-- ============================================================================
-- BODY METRICS: TRACK BODY-FAT MEASUREMENT METHOD
-- Date: 2026-06-15
-- Purpose:
-- 1) Add explicit measurement provenance for body-fat percentage entries.
-- 2) Keep reports factual by labeling measured source (BIA/caliper/etc).
-- ============================================================================

BEGIN;

ALTER TABLE public.body_metrics
ADD COLUMN IF NOT EXISTS measurement_method TEXT;

COMMENT ON COLUMN public.body_metrics.measurement_method IS
  'Body-fat measurement method, e.g. BIA, caliper, DEXA, InBody.';

COMMIT;

NOTIFY pgrst, 'reload schema';
