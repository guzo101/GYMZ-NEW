-- ============================================================================
-- WORLD-CLASS NUTRITION ENGINE (MEDICAL GRADE)
-- Purpose: 
-- 1. Add clinical transparency columns (BMI, BMR, TDEE, Weight Basis).
-- 2. Implement the Adjusted Body Weight (ABW) clinical standard for accuracy.
-- 3. Implement high-precision percentage-based targets (Zero Guesswork).
-- ============================================================================

BEGIN;

-- 1. SCHEMA EXPANSION: CLINICAL TRANSPARENCY
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS calculated_bmi DECIMAL(5,2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS calculated_bmr DECIMAL(8,2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS calculated_tdee DECIMAL(8,2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS scientific_weight_basis TEXT; -- 'Actual' or 'Adjusted (ABW)'

-- 2. FUNCTION: The Medical Intelligence Engine
CREATE OR REPLACE FUNCTION public.fn_recalculate_user_nutrition()
RETURNS TRIGGER AS $$
DECLARE
    v_actual_weight NUMERIC;
    v_height_cm NUMERIC;
    v_age NUMERIC;
    v_bmi NUMERIC;
    v_ibw NUMERIC; -- Ideal Body Weight (BMI 22.5)
    v_abw NUMERIC; -- Adjusted Body Weight
    v_weight_used NUMERIC;
    v_weight_basis TEXT;
    
    v_bmr NUMERIC;
    v_tdee NUMERIC;
    v_pal NUMERIC; -- Physical Activity Level
    v_cal_goal NUMERIC;
    
    v_pro_g NUMERIC; v_carb_g NUMERIC; v_fat_g NUMERIC;
    v_goal TEXT;
BEGIN
    -- A. Data Sanitization
    v_actual_weight := NULLIF(NEW.weight::TEXT, '')::NUMERIC;
    v_height_cm     := NULLIF(NEW.height::TEXT, '')::NUMERIC;
    v_age           := NULLIF(NEW.age::TEXT, '')::NUMERIC;

    IF v_actual_weight IS NULL OR v_height_cm IS NULL OR v_age IS NULL THEN
        RETURN NEW;
    END IF;

    -- B. Body Composition Intelligence (BMI & ABW)
    v_bmi := v_actual_weight / ((v_height_cm / 100.0) ^ 2);
    
    -- Clinical Correction for obesity (BMI > 30)
    -- We use Adjusted Body Weight to prevent energy over-calculation.
    IF v_bmi > 30 THEN
        v_ibw := 22.5 * ((v_height_cm / 100.0) ^ 2);
        v_abw := v_ibw + 0.4 * (v_actual_weight - v_ibw);
        v_weight_used := v_abw;
        v_weight_basis := 'Adjusted (ABW)';
    ELSE
        v_weight_used := v_actual_weight;
        v_weight_basis := 'Actual';
    END IF;

    -- C. BMR Calculation (Mifflin-St Jeor) - Professional Standard
    v_bmr := (10 * v_weight_used) + (6.25 * v_height_cm) - (5 * v_age);
    IF NEW.gender = 'male' THEN v_bmr := v_bmr + 5; ELSE v_bmr := v_bmr - 161; END IF;

    -- D. Activity Level Mapping (PAL)
    v_pal := CASE 
        WHEN NEW.workout_intensity = 'low' THEN 1.375
        WHEN NEW.workout_intensity = 'high' THEN 1.725
        WHEN NEW.workout_intensity = 'extreme' THEN 1.9
        ELSE 1.55 -- Clinical Moderate Baseline
    END;

    v_tdee := v_bmr * v_pal;

    -- E. Adaptive Target Mapping (Strict Percentages)
    v_goal := COALESCE(NEW.goal, NEW.primary_objective, 'maintenance');
    
    -- Keyword mapping (Standardizing inputs)
    v_goal := CASE 
        WHEN v_goal IN ('weight_loss', 'lose_weight') THEN 'lose_weight'
        WHEN v_goal IN ('weight_gain', 'build_muscle', 'muscle_gain') THEN 'muscle_gain'
        ELSE 'maintenance' -- Non-negotiable scientific fallback
    END;

    v_cal_goal := v_tdee;
    IF v_goal = 'lose_weight' THEN 
        v_cal_goal := v_tdee * 0.80; -- 20% deficit (Health standard)
        -- Safety check: Avoid starvation levels
        IF NEW.gender = 'male' AND v_cal_goal < 1500 THEN v_cal_goal := 1500; END IF;
        IF NEW.gender != 'male' AND v_cal_goal < 1200 THEN v_cal_goal := 1200; END IF;
    ELSIF v_goal = 'muscle_gain' THEN 
        v_cal_goal := v_tdee * 1.10; -- 10% surplus (Lean bulk standard)
    END IF;

    -- F. Performance Macros (Protein Priority)
    -- Protein: 1.8g per kg of Actual Weight (Ensures muscle sparing during fat loss)
    v_pro_g := v_actual_weight * 1.8;
    v_fat_g := (v_cal_goal * 0.30) / 9; -- 30% Healthy Fats
    v_carb_g := (v_cal_goal - (v_pro_g * 4) - (v_fat_g * 9)) / 4; -- Remainder

    -- G. Profile Sync (Transparency)
    NEW.calculated_bmi := ROUND(v_bmi, 1);
    NEW.calculated_bmr := ROUND(v_bmr);
    NEW.calculated_tdee := ROUND(v_tdee);
    NEW.scientific_weight_basis := v_weight_basis;

    -- H. Secure Result Storage
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
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Medical engine error for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. TRIGGER RE-ACTIVATION
DROP TRIGGER IF EXISTS trg_users_recalculate_nutrition ON public.users;
CREATE TRIGGER trg_users_recalculate_nutrition
BEFORE UPDATE ON public.users -- Changed to BEFORE so we can set the NEW profile columns
FOR EACH ROW EXECUTE FUNCTION public.fn_recalculate_user_nutrition();

-- 4. GLOBAL ACTIVATION (The Spark)
UPDATE public.users SET updated_at = NOW() WHERE weight IS NOT NULL;

COMMIT;

-- Reload Schema
NOTIFY pgrst, 'reload schema';
