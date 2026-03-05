-- ============================================================================
-- CALCULATION RESILIENCY & HEIGHT GUARD (ZERO CRASH POLICY)
-- Purpose: 
-- 1. Broaden precision to prevent numeric overflows on "wild" data.
-- 2. Implement a 'Height Guard' to handle meters vs cm (e.g. 1.75 vs 175).
-- 3. Add safety caps to prevent database-level crashes.
-- ============================================================================

BEGIN;

-- 1. SCHEMA BROADENING: Massive Safety Buffer
-- Upgrading from DECIMAL(5,2) to DECIMAL(12,2) to prevent any future overflow crashes.
ALTER TABLE public.users ALTER COLUMN calculated_bmi TYPE DECIMAL(12,2);
ALTER TABLE public.users ALTER COLUMN calculated_bmr TYPE DECIMAL(12,2);
ALTER TABLE public.users ALTER COLUMN calculated_tdee TYPE DECIMAL(12,2);
ALTER TABLE public.users ALTER COLUMN weight TYPE TEXT; -- Ensure legacy weight is consistently text to prevent cast errors
ALTER TABLE public.users ALTER COLUMN height TYPE TEXT; -- Ensure legacy height is consistently text

-- 2. LOGIC REPAIR: The Resilient Medical Engine
CREATE OR REPLACE FUNCTION public.fn_recalculate_user_nutrition()
RETURNS TRIGGER AS $$
DECLARE
    v_actual_weight NUMERIC;
    v_height_cm NUMERIC;
    v_age NUMERIC;
    v_bmi NUMERIC;
    v_ibw NUMERIC; 
    v_abw NUMERIC; 
    v_weight_used NUMERIC;
    v_weight_basis TEXT;
    
    v_bmr NUMERIC;
    v_tdee NUMERIC;
    v_pal NUMERIC; 
    v_cal_goal NUMERIC;
    
    v_pro_g NUMERIC; v_carb_g NUMERIC; v_fat_g NUMERIC;
    v_goal TEXT;
BEGIN
    -- A. Data Sanitization (Zero Guesswork)
    v_actual_weight := NULLIF(NEW.weight::TEXT, '')::NUMERIC;
    v_height_cm     := NULLIF(NEW.height::TEXT, '')::NUMERIC;
    v_age           := NULLIF(NEW.age::TEXT, '')::NUMERIC;

    IF v_actual_weight IS NULL OR v_height_cm IS NULL OR v_age IS NULL THEN
        RETURN NEW;
    END IF;

    -- B. THE HEIGHT GUARD (Clinically Safe Heuristic)
    -- If height is < 3.0, user almost certainly entered meters (e.g. 1.75).
    -- We convert to cm to prevent BMI spikes in the millions.
    IF v_height_cm < 3.0 THEN
        v_height_cm := v_height_cm * 100.0;
    END IF;

    -- C. Body Composition Intelligence (BMI & ABW)
    v_bmi := v_actual_weight / ((v_height_cm / 100.0) ^ 2);
    
    -- Safety Cap: Prevent unrealistic BMI from crashing DB
    IF v_bmi > 100 THEN v_bmi := 100; END IF;
    
    -- Clinical Correction for obesity (BMI > 30)
    IF v_bmi > 30 THEN
        v_ibw := 22.5 * ((v_height_cm / 100.0) ^ 2);
        v_abw := v_ibw + 0.4 * (v_actual_weight - v_ibw);
        v_weight_used := v_abw;
        v_weight_basis := 'Adjusted (ABW)';
    ELSE
        v_weight_used := v_actual_weight;
        v_weight_basis := 'Actual';
    END IF;

    -- D. BMR Calculation (Mifflin-St Jeor)
    v_bmr := (10 * v_weight_used) + (6.25 * v_height_cm) - (5 * v_age);
    IF NEW.gender = 'male' THEN v_bmr := v_bmr + 5; ELSE v_bmr := v_bmr - 161; END IF;

    -- E. Activity Level Mapping (PAL)
    v_pal := CASE 
        WHEN NEW.workout_intensity = 'low' THEN 1.375
        WHEN NEW.workout_intensity = 'high' THEN 1.725
        WHEN NEW.workout_intensity = 'extreme' THEN 1.9
        ELSE 1.55 -- Clinical Moderate Baseline
    END;

    v_tdee := v_bmr * v_pal;
    
    -- Safety Cap: Prevent TDEE spikes
    IF v_tdee > 10000 THEN v_tdee := 10000; END IF;

    -- F. Goal Naming Alignment
    v_goal := COALESCE(NEW.goal, NEW.primary_objective, 'maintenance');
    v_goal := CASE 
        WHEN v_goal IN ('weight_loss', 'lose_weight', 'fat_loss') THEN 'weight_loss'
        WHEN v_goal IN ('weight_gain', 'build_muscle', 'muscle_gain', 'bulk') THEN 'muscle_gain'
        ELSE 'maintenance' 
    END;

    -- G. Adaptive Target Mapping
    v_cal_goal := v_tdee;
    IF v_goal = 'weight_loss' THEN v_cal_goal := v_tdee * 0.80; 
    ELSIF v_goal = 'muscle_gain' THEN v_cal_goal := v_tdee * 1.10; 
    END IF;

    -- H. Performance Macros (1.8g/kg Protein)
    v_pro_g := v_actual_weight * 1.8;
    v_fat_g := (v_cal_goal * 0.30) / 9;
    v_carb_g := (v_cal_goal - (v_pro_g * 4) - (v_fat_g * 9)) / 4;

    -- I. Transparency Sync
    NEW.calculated_bmi := ROUND(v_bmi, 1);
    NEW.calculated_bmr := ROUND(v_bmr);
    NEW.calculated_tdee := ROUND(v_tdee);
    NEW.scientific_weight_basis := v_weight_basis;

    -- J. Secure Result Storage
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

-- 3. FINAL RESET: Clean Backfill
UPDATE public.users SET updated_at = NOW() WHERE weight IS NOT NULL AND height IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
