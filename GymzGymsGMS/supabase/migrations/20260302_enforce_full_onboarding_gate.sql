-- ============================================================================
-- GYMZ: ENFORCE FULL ONBOARDING GATE (Path + Calibration)
-- Date: 2026-03-02
-- Purpose: Upgrade RLS from has_valid_member_id() to is_fully_onboarded()
--          on ALL feature tables. This is the database-level enforcement that
--          ensures:
--          1. No user can access app features without selecting a Gym Path
--          2. No user can access app features without completing Calibration
--          3. Calibration data (height, weight, age, gender, goal) must exist
--
-- FLOW ENFORCED: Path Selection -> Calibration -> App Access
--
-- IDEMPOTENT: Every CREATE is preceded by a DROP IF EXISTS for the same name,
--             so this migration can be re-run safely without errors.
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. ENSURE HELPER FUNCTIONS EXIST (idempotent via CREATE OR REPLACE)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.has_valid_member_id()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND unique_id IS NOT NULL
    AND unique_id != ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_fully_onboarded()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND unique_id IS NOT NULL AND unique_id != ''
    AND gym_id IS NOT NULL
    AND access_mode IS NOT NULL
    AND height IS NOT NULL AND height > 0
    AND weight IS NOT NULL AND weight > 0
    AND age IS NOT NULL AND age > 0
    AND gender IS NOT NULL
    AND (goal IS NOT NULL OR primary_objective IS NOT NULL)
  );
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. FEATURE TABLES: FULL is_fully_onboarded() ENFORCEMENT
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 2A. attendance_logs ─────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_logs') THEN
    ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "member_attendance_select" ON public.attendance_logs';
    EXECUTE 'DROP POLICY IF EXISTS "Members can view their own attendance logs" ON public.attendance_logs';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_attendance_select" ON public.attendance_logs';

    EXECUTE 'CREATE POLICY "onboarded_attendance_select"
      ON public.attendance_logs FOR SELECT
      USING (auth.uid() = user_id AND public.is_fully_onboarded())';
  END IF;
END $$;

-- ─── 2B. daily_nutrition_logs ────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_nutrition_logs') THEN
    ALTER TABLE public.daily_nutrition_logs ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "member_nutrition_logs_select" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "member_nutrition_logs_insert" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "member_nutrition_logs_update" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "member_nutrition_logs_delete" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_nutrition_logs_select" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_nutrition_logs_insert" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_nutrition_logs_update" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_nutrition_logs_delete" ON public.daily_nutrition_logs';

    EXECUTE 'CREATE POLICY "onboarded_nutrition_logs_select"
      ON public.daily_nutrition_logs FOR SELECT
      USING (auth.uid() = user_id AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "onboarded_nutrition_logs_insert"
      ON public.daily_nutrition_logs FOR INSERT
      WITH CHECK (auth.uid() = user_id AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "onboarded_nutrition_logs_update"
      ON public.daily_nutrition_logs FOR UPDATE
      USING (auth.uid() = user_id AND public.is_fully_onboarded())
      WITH CHECK (auth.uid() = user_id AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "onboarded_nutrition_logs_delete"
      ON public.daily_nutrition_logs FOR DELETE
      USING (auth.uid() = user_id AND public.is_fully_onboarded())';
  END IF;
END $$;

-- ─── 2C. meal_scans ─────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'meal_scans') THEN
    ALTER TABLE public.meal_scans ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "member_meal_scans_select" ON public.meal_scans';
    EXECUTE 'DROP POLICY IF EXISTS "member_meal_scans_insert" ON public.meal_scans';
    EXECUTE 'DROP POLICY IF EXISTS "member_meal_scans_update" ON public.meal_scans';
    EXECUTE 'DROP POLICY IF EXISTS "member_meal_scans_delete" ON public.meal_scans';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_meal_scans_select" ON public.meal_scans';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_meal_scans_insert" ON public.meal_scans';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_meal_scans_update" ON public.meal_scans';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_meal_scans_delete" ON public.meal_scans';

    EXECUTE 'CREATE POLICY "onboarded_meal_scans_select"
      ON public.meal_scans FOR SELECT
      USING (auth.uid() = user_id AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "onboarded_meal_scans_insert"
      ON public.meal_scans FOR INSERT
      WITH CHECK (auth.uid() = user_id AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "onboarded_meal_scans_update"
      ON public.meal_scans FOR UPDATE
      USING (auth.uid() = user_id AND public.is_fully_onboarded())
      WITH CHECK (auth.uid() = user_id AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "onboarded_meal_scans_delete"
      ON public.meal_scans FOR DELETE
      USING (auth.uid() = user_id AND public.is_fully_onboarded())';
  END IF;
END $$;

-- ─── 2D. event_rsvps ────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_rsvps') THEN
    ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "member_event_rsvps_select" ON public.event_rsvps';
    EXECUTE 'DROP POLICY IF EXISTS "member_event_rsvps_insert" ON public.event_rsvps';
    EXECUTE 'DROP POLICY IF EXISTS "member_event_rsvps_update" ON public.event_rsvps';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_event_rsvps_select" ON public.event_rsvps';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_event_rsvps_insert" ON public.event_rsvps';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_event_rsvps_update" ON public.event_rsvps';

    EXECUTE 'CREATE POLICY "onboarded_event_rsvps_select"
      ON public.event_rsvps FOR SELECT
      USING (user_id = auth.uid() AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "onboarded_event_rsvps_insert"
      ON public.event_rsvps FOR INSERT
      WITH CHECK (user_id = auth.uid() AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "onboarded_event_rsvps_update"
      ON public.event_rsvps FOR UPDATE
      USING (user_id = auth.uid() AND public.is_fully_onboarded())
      WITH CHECK (user_id = auth.uid() AND public.is_fully_onboarded())';
  END IF;
END $$;

-- ─── 2E. notifications ──────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "member_notifications_select" ON public.notifications';
    EXECUTE 'DROP POLICY IF EXISTS "member_notifications_update" ON public.notifications';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_notifications_select" ON public.notifications';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_notifications_update" ON public.notifications';

    EXECUTE 'CREATE POLICY "onboarded_notifications_select"
      ON public.notifications FOR SELECT
      USING (auth.uid() = user_id AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "onboarded_notifications_update"
      ON public.notifications FOR UPDATE
      USING (auth.uid() = user_id AND public.is_fully_onboarded())
      WITH CHECK (auth.uid() = user_id AND public.is_fully_onboarded())';
  END IF;
END $$;

-- ─── 2F. payments ────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "member_payments_select" ON public.payments';
    EXECUTE 'DROP POLICY IF EXISTS "member_payments_insert" ON public.payments';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_payments_select" ON public.payments';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_payments_insert" ON public.payments';

    EXECUTE 'CREATE POLICY "onboarded_payments_select"
      ON public.payments FOR SELECT
      USING (auth.uid() = user_id AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "onboarded_payments_insert"
      ON public.payments FOR INSERT
      WITH CHECK (
        (auth.uid() = user_id OR auth.uid() = member_id)
        AND public.is_fully_onboarded()
      )';
  END IF;
END $$;

-- ─── 2G. subscriptions ──────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "member_subscriptions_select" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_subscriptions_select" ON public.subscriptions';

    EXECUTE 'CREATE POLICY "onboarded_subscriptions_select"
      ON public.subscriptions FOR SELECT
      USING (auth.uid() = user_id AND public.is_fully_onboarded())';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CALIBRATION TABLES: HYBRID ENFORCEMENT
--    Written to DURING calibration, so INSERT/UPDATE must allow users who
--    have a member ID (but may not yet be fully calibrated).
--    SELECT is gated by is_fully_onboarded() to prevent reading app data
--    before calibration is complete.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 3A. body_metrics ────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'body_metrics') THEN
    ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "member_body_metrics_select" ON public.body_metrics';
    EXECUTE 'DROP POLICY IF EXISTS "member_body_metrics_insert" ON public.body_metrics';
    EXECUTE 'DROP POLICY IF EXISTS "member_body_metrics_update" ON public.body_metrics';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own body metrics" ON public.body_metrics';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own body metrics" ON public.body_metrics';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own body metrics" ON public.body_metrics';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_body_metrics_select" ON public.body_metrics';
    EXECUTE 'DROP POLICY IF EXISTS "calibration_body_metrics_insert" ON public.body_metrics';
    EXECUTE 'DROP POLICY IF EXISTS "calibration_body_metrics_update" ON public.body_metrics';

    EXECUTE 'CREATE POLICY "onboarded_body_metrics_select"
      ON public.body_metrics FOR SELECT
      USING (auth.uid() = user_id AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "calibration_body_metrics_insert"
      ON public.body_metrics FOR INSERT
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "calibration_body_metrics_update"
      ON public.body_metrics FOR UPDATE
      USING (auth.uid() = user_id AND public.has_valid_member_id())
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';
  END IF;
END $$;

-- ─── 3B. user_fitness_goals ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_fitness_goals') THEN
    ALTER TABLE public.user_fitness_goals ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "member_fitness_goals_select" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "member_fitness_goals_insert" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "member_fitness_goals_update" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "member_fitness_goals_delete" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own goals" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own goals" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own goals" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_fitness_goals_select" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "calibration_fitness_goals_insert" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "calibration_fitness_goals_update" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "calibration_fitness_goals_delete" ON public.user_fitness_goals';

    EXECUTE 'CREATE POLICY "onboarded_fitness_goals_select"
      ON public.user_fitness_goals FOR SELECT
      USING (auth.uid() = user_id AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "calibration_fitness_goals_insert"
      ON public.user_fitness_goals FOR INSERT
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "calibration_fitness_goals_update"
      ON public.user_fitness_goals FOR UPDATE
      USING (auth.uid() = user_id AND public.has_valid_member_id())
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "calibration_fitness_goals_delete"
      ON public.user_fitness_goals FOR DELETE
      USING (auth.uid() = user_id AND public.has_valid_member_id())';
  END IF;
END $$;

-- ─── 3C. daily_calorie_summary ───────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_calorie_summary') THEN
    ALTER TABLE public.daily_calorie_summary ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "member_calorie_summary_select" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "member_calorie_summary_insert" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "member_calorie_summary_update" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own calorie summary" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own calorie summary" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own calorie summary" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "onboarded_calorie_summary_select" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "calibration_calorie_summary_insert" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "calibration_calorie_summary_update" ON public.daily_calorie_summary';

    EXECUTE 'CREATE POLICY "onboarded_calorie_summary_select"
      ON public.daily_calorie_summary FOR SELECT
      USING (auth.uid() = user_id AND public.is_fully_onboarded())';

    EXECUTE 'CREATE POLICY "calibration_calorie_summary_insert"
      ON public.daily_calorie_summary FOR INSERT
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "calibration_calorie_summary_update"
      ON public.daily_calorie_summary FOR UPDATE
      USING (auth.uid() = user_id AND public.has_valid_member_id())
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';
  END IF;
END $$;


COMMIT;

NOTIFY pgrst, 'reload schema';
