-- ============================================================================
-- GYMZ DAILY CALORIE SUMMARY RESTORATION
-- Date: 2026-02-24
-- Purpose: 
-- 1. Restore the daily_calorie_summary table with strict snake_case naming.
-- 2. Add appropriate RLS policies for strict tenant & user isolation.
-- ============================================================================

BEGIN;

-- 1. Create the base table
CREATE TABLE IF NOT EXISTS public.daily_calorie_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_calories NUMERIC DEFAULT 0,
  total_protein NUMERIC DEFAULT 0,
  total_carbs NUMERIC DEFAULT 0,
  total_fats NUMERIC DEFAULT 0,
  total_fiber NUMERIC DEFAULT 0,
  calorie_goal NUMERIC NOT NULL DEFAULT 2000,
  protein_goal NUMERIC DEFAULT 150,
  carbs_goal NUMERIC DEFAULT 200,
  fats_goal NUMERIC DEFAULT 65,
  calories_burned NUMERIC DEFAULT 0, -- from workouts
  net_calories NUMERIC GENERATED ALWAYS AS (total_calories - calories_burned) STORED,
  meal_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.daily_calorie_summary ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_calorie_summary' AND policyname = 'Users can view their own summary'
  ) THEN
    CREATE POLICY "Users can view their own summary" ON public.daily_calorie_summary
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_calorie_summary' AND policyname = 'Users can insert their own summary'
  ) THEN
    CREATE POLICY "Users can insert their own summary" ON public.daily_calorie_summary
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_calorie_summary' AND policyname = 'Users can update their own summary'
  ) THEN
    CREATE POLICY "Users can update their own summary" ON public.daily_calorie_summary
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_calorie_summary' AND policyname = 'Service role can manage summaries'
  ) THEN
    CREATE POLICY "Service role can manage summaries" ON public.daily_calorie_summary
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Create trigger to automatically update the 'updatedAt' column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_dailyCalorieSummary_updatedAt') THEN
        EXECUTE '
        CREATE OR REPLACE FUNCTION public."update_dailyCalorieSummary_updatedAt"()
        RETURNS TRIGGER AS $f$
        BEGIN
            NEW."updatedAt" = NOW();
            RETURN NEW;
        END;
        $f$ LANGUAGE plpgsql;';
    END IF;
END $$;

DROP TRIGGER IF EXISTS "trg_dailyCalorieSummary_updatedAt" ON public."dailyCalorieSummary";
CREATE TRIGGER "trg_dailyCalorieSummary_updatedAt"
    BEFORE UPDATE ON public."dailyCalorieSummary"
    FOR EACH ROW
    EXECUTE FUNCTION public."update_dailyCalorieSummary_updatedAt"();

-- 5. Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
