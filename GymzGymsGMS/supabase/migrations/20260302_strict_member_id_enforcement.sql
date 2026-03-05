-- ============================================================================
-- GYMZ STRICT MEMBER ID ENFORCEMENT
-- Date: 2026-03-02
-- Purpose: Absolute database-level enforcement — no user may access feature
--          tables without a valid unique_id (member ID). This is the final
--          layer of defense; even if the app is bypassed via deep links,
--          stale sessions, or direct API calls, the database blocks access.
--
-- SAFETY: Every table operation is wrapped in an existence check so this
--         migration runs cleanly regardless of which tables exist.
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. SECURITY HELPER FUNCTIONS
--    These do not reference any specific table other than `users`.
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
-- 2. FIX ANONYMOUS INSERT VULNERABILITY ON USERS TABLE
--    Old policy: WITH CHECK (auth.uid() = id OR auth.uid() IS NULL)
--    The IS NULL clause allowed anonymous record creation.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "table_users_insert_self" ON public.users;
CREATE POLICY "table_users_insert_self"
ON public.users FOR INSERT
WITH CHECK (auth.uid() = id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. HARDEN ALL FEATURE TABLES
--    Each table section is wrapped in an existence check so that this
--    migration never fails due to a missing table.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 3A. attendance_logs ───────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance_logs') THEN
    ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Members can view their own attendance logs" ON public.attendance_logs';

    EXECUTE 'CREATE POLICY "member_attendance_select"
      ON public.attendance_logs FOR SELECT
      USING (auth.uid() = user_id AND public.has_valid_member_id())';
  ELSE
    RAISE NOTICE 'Table public.attendance_logs does not exist — skipping.';
  END IF;
END $$;


-- ─── 3B. daily_nutrition_logs ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_nutrition_logs') THEN
    ALTER TABLE public.daily_nutrition_logs ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Users can view own nutrition logs" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own nutrition logs" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "table_nutrition_select_owner" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "table_nutrition_insert_owner" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "table_nutrition_update_owner" ON public.daily_nutrition_logs';
    EXECUTE 'DROP POLICY IF EXISTS "table_nutrition_delete_owner" ON public.daily_nutrition_logs';

    EXECUTE 'CREATE POLICY "member_nutrition_logs_select"
      ON public.daily_nutrition_logs FOR SELECT
      USING (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_nutrition_logs_insert"
      ON public.daily_nutrition_logs FOR INSERT
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_nutrition_logs_update"
      ON public.daily_nutrition_logs FOR UPDATE
      USING (auth.uid() = user_id AND public.has_valid_member_id())
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_nutrition_logs_delete"
      ON public.daily_nutrition_logs FOR DELETE
      USING (auth.uid() = user_id AND public.has_valid_member_id())';
  ELSE
    RAISE NOTICE 'Table public.daily_nutrition_logs does not exist — skipping.';
  END IF;
END $$;


-- ─── 3C. meal_scans ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'meal_scans') THEN
    ALTER TABLE public.meal_scans ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own scans" ON public.meal_scans';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own scans" ON public.meal_scans';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own scans" ON public.meal_scans';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own scans" ON public.meal_scans';

    EXECUTE 'CREATE POLICY "member_meal_scans_select"
      ON public.meal_scans FOR SELECT
      USING (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_meal_scans_insert"
      ON public.meal_scans FOR INSERT
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_meal_scans_update"
      ON public.meal_scans FOR UPDATE
      USING (auth.uid() = user_id AND public.has_valid_member_id())
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_meal_scans_delete"
      ON public.meal_scans FOR DELETE
      USING (auth.uid() = user_id AND public.has_valid_member_id())';
  ELSE
    RAISE NOTICE 'Table public.meal_scans does not exist — skipping.';
  END IF;
END $$;


-- ─── 3D. daily_calorie_summary ────────────────────────────────────────────
--    CRITICAL: Also drops the permissive "USING(true)" policy that allowed
--    any authenticated user to read/write ALL summaries.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_calorie_summary') THEN
    ALTER TABLE public.daily_calorie_summary ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Service role can manage summaries" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own calorie summary" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own calorie summary" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own calorie summary" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own summary" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert their own summary" ON public.daily_calorie_summary';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own summary" ON public.daily_calorie_summary';

    EXECUTE 'CREATE POLICY "member_calorie_summary_select"
      ON public.daily_calorie_summary FOR SELECT
      USING (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_calorie_summary_insert"
      ON public.daily_calorie_summary FOR INSERT
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_calorie_summary_update"
      ON public.daily_calorie_summary FOR UPDATE
      USING (auth.uid() = user_id AND public.has_valid_member_id())
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';
  ELSE
    RAISE NOTICE 'Table public.daily_calorie_summary does not exist — skipping.';
  END IF;
END $$;


-- ─── 3E. body_metrics ─────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'body_metrics') THEN
    ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Users can view own body metrics" ON public.body_metrics';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own body metrics" ON public.body_metrics';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own body metrics" ON public.body_metrics';

    EXECUTE 'CREATE POLICY "member_body_metrics_select"
      ON public.body_metrics FOR SELECT
      USING (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_body_metrics_insert"
      ON public.body_metrics FOR INSERT
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_body_metrics_update"
      ON public.body_metrics FOR UPDATE
      USING (auth.uid() = user_id AND public.has_valid_member_id())
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';
  ELSE
    RAISE NOTICE 'Table public.body_metrics does not exist — skipping.';
  END IF;
END $$;


-- ─── 3F. user_fitness_goals ───────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_fitness_goals') THEN
    ALTER TABLE public.user_fitness_goals ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Users can manage own goals" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own goals" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own goals" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own goals" ON public.user_fitness_goals';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own goals" ON public.user_fitness_goals';

    EXECUTE 'CREATE POLICY "member_fitness_goals_select"
      ON public.user_fitness_goals FOR SELECT
      USING (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_fitness_goals_insert"
      ON public.user_fitness_goals FOR INSERT
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_fitness_goals_update"
      ON public.user_fitness_goals FOR UPDATE
      USING (auth.uid() = user_id AND public.has_valid_member_id())
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_fitness_goals_delete"
      ON public.user_fitness_goals FOR DELETE
      USING (auth.uid() = user_id AND public.has_valid_member_id())';
  ELSE
    RAISE NOTICE 'Table public.user_fitness_goals does not exist — skipping.';
  END IF;
END $$;


-- ─── 3G. event_rsvps ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_rsvps') THEN
    ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own RSVPs" ON public.event_rsvps';
    EXECUTE 'DROP POLICY IF EXISTS "Users can RSVP to events" ON public.event_rsvps';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their RSVPs" ON public.event_rsvps';

    EXECUTE 'CREATE POLICY "member_event_rsvps_select"
      ON public.event_rsvps FOR SELECT
      USING (user_id = auth.uid() AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_event_rsvps_insert"
      ON public.event_rsvps FOR INSERT
      WITH CHECK (user_id = auth.uid() AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_event_rsvps_update"
      ON public.event_rsvps FOR UPDATE
      USING (user_id = auth.uid() AND public.has_valid_member_id())
      WITH CHECK (user_id = auth.uid() AND public.has_valid_member_id())';
  ELSE
    RAISE NOTICE 'Table public.event_rsvps does not exist — skipping.';
  END IF;
END $$;


-- ─── 3H. notifications (member-facing only) ───────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Members view own notifications" ON public.notifications';
    EXECUTE 'DROP POLICY IF EXISTS "Members update own notifications" ON public.notifications';

    EXECUTE 'CREATE POLICY "member_notifications_select"
      ON public.notifications FOR SELECT
      USING (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_notifications_update"
      ON public.notifications FOR UPDATE
      USING (auth.uid() = user_id AND public.has_valid_member_id())
      WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id())';
  ELSE
    RAISE NOTICE 'Table public.notifications does not exist — skipping.';
  END IF;
END $$;


-- ─── 3I. payments ─────────────────────────────────────────────────────────
--    Split the combined user+admin policy into separate policies.
--    "Admins Manage All" policy is untouched.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "table_payments_gym_isolation" ON public.payments';
    EXECUTE 'DROP POLICY IF EXISTS "table_payments_insert_member" ON public.payments';
    EXECUTE 'DROP POLICY IF EXISTS "table_payments_select_owner" ON public.payments';

    EXECUTE 'CREATE POLICY "admin_payments_gym_isolation"
      ON public.payments FOR ALL
      USING (public.is_gym_admin(gym_id))
      WITH CHECK (public.is_gym_admin(gym_id))';

    EXECUTE 'CREATE POLICY "member_payments_select"
      ON public.payments FOR SELECT
      USING (auth.uid() = user_id AND public.has_valid_member_id())';

    EXECUTE 'CREATE POLICY "member_payments_insert"
      ON public.payments FOR INSERT
      WITH CHECK (
        (auth.uid() = user_id OR auth.uid() = member_id)
        AND public.has_valid_member_id()
      )';
  ELSE
    RAISE NOTICE 'Table public.payments does not exist — skipping.';
  END IF;
END $$;


-- ─── 3J. subscriptions ────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "table_subscriptions_gym_isolation" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "table_subscriptions_select_owner" ON public.subscriptions';

    EXECUTE 'CREATE POLICY "admin_subscriptions_gym_isolation"
      ON public.subscriptions FOR ALL
      USING (public.is_gym_admin(gym_id))
      WITH CHECK (public.is_gym_admin(gym_id))';

    EXECUTE 'CREATE POLICY "member_subscriptions_select"
      ON public.subscriptions FOR SELECT
      USING (auth.uid() = user_id AND public.has_valid_member_id())';
  ELSE
    RAISE NOTICE 'Table public.subscriptions does not exist — skipping.';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. BACKFILL: Generate IDs for any user who has gym_id but no unique_id
--    Uses the single-parameter version of generate_gym_member_id which is
--    guaranteed to exist from 20260225_harden_gym_isolation.sql.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'generate_gym_member_id'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    UPDATE public.users
    SET unique_id = public.generate_gym_member_id(gym_id)
    WHERE gym_id IS NOT NULL
      AND (unique_id IS NULL OR unique_id = '');
    RAISE NOTICE 'Backfill complete: generated IDs for orphaned users.';
  ELSE
    RAISE NOTICE 'Function generate_gym_member_id does not exist — skipping backfill.';
  END IF;
END $$;


COMMIT;

NOTIFY pgrst, 'reload schema';
