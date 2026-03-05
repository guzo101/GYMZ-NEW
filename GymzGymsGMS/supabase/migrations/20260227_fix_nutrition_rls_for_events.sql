-- ============================================================================
-- FIX: NUTRITION & MEAL SCANNING RLS POLICIES
-- Purpose: 
-- 1. Restore missing owner policies for meal_scans (was lost in nuclear clear-out).
-- 2. Ensure both Event and Gym members can scan, log, and delete their own data.
-- 3. Add missing DELETE policy for daily_nutrition_logs.
-- ============================================================================

BEGIN;

-- ─── 1. MEAL SCANS POLICIES ──────────────────────────────────────────────────
-- Ensure members can insert and manage their own scanning history.

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'meal_scans') THEN
        -- Drop potentially missing/broken policies
        DROP POLICY IF EXISTS "Users can insert own scans" ON public.meal_scans;
        DROP POLICY IF EXISTS "Users can view own scans" ON public.meal_scans;
        DROP POLICY IF EXISTS "Users can update own scans" ON public.meal_scans;
        DROP POLICY IF EXISTS "Users can delete own scans" ON public.meal_scans;

        -- Re-apply owner-based policies
        CREATE POLICY "Users can insert own scans" 
        ON public.meal_scans FOR INSERT 
        WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can view own scans" 
        ON public.meal_scans FOR SELECT 
        USING (auth.uid() = user_id);

        CREATE POLICY "Users can update own scans" 
        ON public.meal_scans FOR UPDATE 
        USING (auth.uid() = user_id);

        CREATE POLICY "Users can delete own scans" 
        ON public.meal_scans FOR DELETE 
        USING (auth.uid() = user_id);

        RAISE NOTICE 'Restored RLS policies for meal_scans';
    END IF;
END $$;

-- ─── 2. DAILY NUTRITION LOGS (CLEANUP) ───────────────────────────────────────
-- Add missing DELETE policy which was omitted in canonical RLS step.

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'daily_nutrition_logs') THEN
        DROP POLICY IF EXISTS "table_nutrition_delete_owner" ON public.daily_nutrition_logs;
        CREATE POLICY "table_nutrition_delete_owner" 
        ON public.daily_nutrition_logs FOR DELETE 
        USING (auth.uid() = user_id);

        RAISE NOTICE 'Added DELETE policy for daily_nutrition_logs';
    END IF;
END $$;

-- ─── 3. USER FITNESS GOALS (REINFORCEMENT) ───────────────────────────────────
-- Ensure event members can also record/update their goals during calibration.

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_fitness_goals') THEN
        DROP POLICY IF EXISTS "Users can manage own goals" ON public.user_fitness_goals;
        CREATE POLICY "Users can manage own goals" 
        ON public.user_fitness_goals FOR ALL 
        USING (auth.uid() = user_id);

        RAISE NOTICE 'Reinforced RLS policies for user_fitness_goals';
    END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
