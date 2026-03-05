-- ============================================================================
-- GLOBAL ACTIVATION: THE SELF-HEALING BRAIN (V2)
-- Purpose: 
-- 1. Create missing tables (metrics & goals)
-- 2. Implement the "Neural Network" (Triggers & Functions)
-- 3. Backfill all existing users with scientific targets
-- ============================================================================

BEGIN;

-- 1. TABLES: Ensure core intelligence storage exists
CREATE TABLE IF NOT EXISTS public.body_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    weight NUMERIC NOT NULL,
    body_fat_percentage NUMERIC,
    muscle_mass NUMERIC,
    waist_circumference NUMERIC,
    chest_circumference NUMERIC,
    arm_circumference NUMERIC,
    hip_circumference NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.user_fitness_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    goal_type TEXT CHECK (goal_type IN ('weight_loss', 'weight_gain', 'muscle_gain', 'maintenance', 'endurance', 'strength', 'lose_weight', 'recomp')) NOT NULL,
    target_weight NUMERIC,
    target_body_fat NUMERIC,
    target_date DATE,
    starting_weight NUMERIC,
    starting_body_fat NUMERIC,
    starting_date DATE DEFAULT CURRENT_DATE,
    weekly_workout_goal INTEGER DEFAULT 3,
    daily_calorie_goal NUMERIC DEFAULT 2000,
    daily_protein_goal NUMERIC DEFAULT 150,
    daily_carbs_goal NUMERIC DEFAULT 200,
    daily_fats_goal NUMERIC DEFAULT 65,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure unique active goal for ON CONFLICT to work
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_fitness_goals_user_active_unique ON public.user_fitness_goals (user_id) WHERE is_active = TRUE;

-- 2. FUNCTION: propagate_body_metrics_to_profile
CREATE OR REPLACE FUNCTION public.fn_propagate_body_metrics_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users SET weight = NEW.weight, updated_at = NOW() WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. TRIGGER: Weight Propagation
DROP TRIGGER IF EXISTS trg_body_metrics_to_profile ON public.body_metrics;
CREATE TRIGGER trg_body_metrics_to_profile
AFTER INSERT OR UPDATE OF weight ON public.body_metrics
FOR EACH ROW EXECUTE FUNCTION public.fn_propagate_body_metrics_to_profile();

-- 4. FUNCTION: recalculate_nutrition_targets (The Core Intelligence)
CREATE OR REPLACE FUNCTION public.fn_recalculate_user_nutrition()
RETURNS TRIGGER AS $$
DECLARE
    v_bmr NUMERIC;
    v_tdee NUMERIC;
    v_activity_mult NUMERIC;
    v_cal_goal NUMERIC;
    v_pro_g NUMERIC; v_carb_g NUMERIC; v_fat_g NUMERIC;
    v_goal TEXT;
BEGIN
    IF NEW.weight IS NULL OR NEW.height IS NULL OR NEW.age IS NULL THEN
        RETURN NEW;
    END IF;

    -- BMR (Mifflin-St Jeor)
    v_bmr := (10 * NEW.weight) + (6.25 * NEW.height) - (5 * NEW.age);
    IF NEW.gender = 'male' THEN v_bmr := v_bmr + 5; ELSE v_bmr := v_bmr - 161; END IF;

    -- Activity Multiplier
    v_activity_mult := CASE 
        WHEN NEW.workout_intensity = 'low' THEN 1.375
        WHEN NEW.workout_intensity = 'high' THEN 1.725
        WHEN NEW.workout_intensity = 'extreme' THEN 1.9
        ELSE 1.55 -- moderate
    END;

    v_tdee := v_bmr * v_activity_mult;
    v_goal := COALESCE(NEW.goal, NEW.primary_objective, 'maintenance');

    -- Adjust Goal
    v_cal_goal := v_tdee;
    IF v_goal = 'lose_weight' OR v_goal = 'weight_loss' THEN v_cal_goal := v_cal_goal - 500; END IF;
    IF v_goal = 'build_muscle' OR v_goal = 'muscle_gain' THEN v_cal_goal := v_cal_goal + 300; END IF;
    v_cal_goal := GREATEST(v_cal_goal, 1200);

    -- Macro Splits
    IF v_goal = 'lose_weight' OR v_goal = 'weight_loss' THEN
        v_pro_g := (v_cal_goal * 0.40) / 4; v_carb_g := (v_cal_goal * 0.35) / 4; v_fat_g := (v_cal_goal * 0.25) / 9;
    ELSIF v_goal = 'build_muscle' OR v_goal = 'muscle_gain' THEN
        v_pro_g := (v_cal_goal * 0.35) / 4; v_carb_g := (v_cal_goal * 0.45) / 4; v_fat_g := (v_cal_goal * 0.20) / 9;
    ELSE
        v_pro_g := (v_cal_goal * 0.30) / 4; v_carb_g := (v_cal_goal * 0.45) / 4; v_fat_g := (v_cal_goal * 0.25) / 9;
    END IF;

    -- Update user_fitness_goals (Self-Healing INSERT)
    INSERT INTO public.user_fitness_goals (
        user_id, goal_type, daily_calorie_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal, is_active, updated_at
    )
    VALUES (
        NEW.id, v_goal, ROUND(v_cal_goal), ROUND(v_pro_g), ROUND(v_carb_g), ROUND(v_fat_g), TRUE, NOW()
    )
    ON CONFLICT (user_id) WHERE is_active = TRUE 
    DO UPDATE SET
        goal_type = EXCLUDED.goal_type,
        daily_calorie_goal = EXCLUDED.daily_calorie_goal,
        daily_protein_goal = EXCLUDED.daily_protein_goal,
        daily_carbs_goal = EXCLUDED.daily_carbs_goal,
        daily_fats_goal = EXCLUDED.daily_fats_goal,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. TRIGGER: Auto-Recalculate
DROP TRIGGER IF EXISTS trg_users_recalculate_nutrition ON public.users;
CREATE TRIGGER trg_users_recalculate_nutrition
AFTER UPDATE OF weight, height, age, goal, primary_objective, workout_intensity ON public.users
FOR EACH ROW EXECUTE FUNCTION public.fn_recalculate_user_nutrition();

-- 6. BACKFILL: Wake up the system for existing users
-- This fires the trigger and populates user_fitness_goals
UPDATE public.users 
SET updated_at = NOW() 
WHERE weight IS NOT NULL AND height IS NOT NULL AND age IS NOT NULL;

COMMIT;

-- Enable RLS for safety
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_fitness_goals ENABLE ROW LEVEL SECURITY;

-- 7. RELOAD
NOTIFY pgrst, 'reload schema';
