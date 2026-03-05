-- ==========================================
-- Gymz NUTRITION SYSTEM - SAFETY MIGRATION
-- This script is idempotent: Safe to run multiple times.
-- ==========================================

-- 1. Ensure daily_nutrition_logs exists (The main log table)
CREATE TABLE IF NOT EXISTS public.daily_nutrition_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    food_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    calories NUMERIC NOT NULL DEFAULT 0,
    protein NUMERIC DEFAULT 0,
    carbs NUMERIC DEFAULT 0,
    fats NUMERIC DEFAULT 0,
    fiber NUMERIC DEFAULT 0,
    meal_type TEXT CHECK (meal_type IN ('breakfast','lunch','dinner','snack')) DEFAULT 'breakfast',
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    barcode_scanned BOOLEAN DEFAULT false,
    image_url TEXT
);

-- 2. Ensure meal_scans exists (The AI scanning cache)
CREATE TABLE IF NOT EXISTS public.meal_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT,
    food_name TEXT NOT NULL,
    calories INTEGER DEFAULT 0,
    protein NUMERIC DEFAULT 0,
    carbs NUMERIC DEFAULT 0,
    fat NUMERIC DEFAULT 0,
    fiber NUMERIC DEFAULT 0,
    sugar NUMERIC DEFAULT 0,
    portion_size TEXT,
    confidence_score NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Safety: Ensure image_url exists in both tables
ALTER TABLE public.daily_nutrition_logs ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.meal_scans ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 4. Enable RLS
ALTER TABLE public.daily_nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_scans ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Drop if exists to avoid "policy already exists" errors)
DO $$ 
BEGIN
    -- Daily Nutrition Logs Policies
    DROP POLICY IF EXISTS "Users can view own nutrition logs" ON public.daily_nutrition_logs;
    CREATE POLICY "Users can view own nutrition logs" ON public.daily_nutrition_logs FOR SELECT USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert own nutrition logs" ON public.daily_nutrition_logs;
    CREATE POLICY "Users can insert own nutrition logs" ON public.daily_nutrition_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Meal Scans Policies
    DROP POLICY IF EXISTS "Users can view own scans" ON public.meal_scans;
    CREATE POLICY "Users can view own scans" ON public.meal_scans FOR SELECT USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert own scans" ON public.meal_scans;
    CREATE POLICY "Users can insert own scans" ON public.meal_scans FOR INSERT WITH CHECK (auth.uid() = user_id);
END $$;
