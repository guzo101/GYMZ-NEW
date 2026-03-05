-- ============================================================================
-- INTERCONNECTED INTELLIGENCE ENGINE (PHASE 2)
-- Purpose: Move core personalization logic to the database (The Brain).
-- Logic:
-- 1. Metric Sync: body_metrics -> users.weight
-- 2. Nutrition Sync: users profile change -> user_fitness_goals targets
-- ============================================================================

-- 1. FUNCTION: propagate_body_metrics_to_profile
-- Logic: When a user logs a new weight in body_metrics, update their profile weight.
CREATE OR REPLACE FUNCTION public.fn_propagate_body_metrics_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users 
    SET 
        weight = NEW.weight,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER: Propagate Weight
DROP TRIGGER IF EXISTS trg_body_metrics_to_profile ON public.body_metrics;
CREATE TRIGGER trg_body_metrics_to_profile
AFTER INSERT OR UPDATE OF weight ON public.body_metrics
FOR EACH ROW EXECUTE FUNCTION public.fn_propagate_body_metrics_to_profile();


-- 3. FUNCTION: recalculate_nutrition_targets
-- Logic: Mifflin-St Jeor calculation in SQL for high-precision, trusted targets.
CREATE OR REPLACE FUNCTION public.fn_recalculate_user_nutrition()
RETURNS TRIGGER AS $$
DECLARE
    v_bmr NUMERIC;
    v_tdee NUMERIC;
    v_activity_mult NUMERIC;
    v_cal_goal NUMERIC;
    v_pro_g NUMERIC;
    v_carb_g NUMERIC;
    v_fat_g NUMERIC;
    v_goal TEXT;
BEGIN
    -- Only run if critical metrics exist
    IF NEW.weight IS NULL OR NEW.height IS NULL OR NEW.age IS NULL THEN
        RETURN NEW;
    END IF;

    -- A. Calculate BMR (Mifflin-St Jeor)
    v_bmr := (10 * NEW.weight) + (6.25 * NEW.height) - (5 * NEW.age);
    IF NEW.gender = 'male' THEN
        v_bmr := v_bmr + 5;
    ELSE
        v_bmr := v_bmr - 161;
    END IF;

    -- B. Determine Activity Multiplier
    v_activity_mult := CASE 
        WHEN NEW.workout_intensity = 'low' THEN 1.375
        WHEN NEW.workout_intensity = 'high' THEN 1.725
        WHEN NEW.workout_intensity = 'extreme' THEN 1.9
        ELSE 1.55 -- moderate default
    END;

    v_tdee := v_bmr * v_activity_mult;
    v_goal := COALESCE(NEW.goal, NEW.primary_objective, 'maintenance');

    -- C. Adjust based on Goal
    v_cal_goal := v_tdee;
    IF v_goal = 'lose_weight' THEN v_cal_goal := v_cal_goal - 500; END IF;
    IF v_goal = 'build_muscle' THEN v_cal_goal := v_cal_goal + 300; END IF;
    
    v_cal_goal := GREATEST(v_cal_goal, 1200);

    -- D. Calculate Macros (Standard Splits)
    IF v_goal = 'lose_weight' THEN
        v_pro_g := (v_cal_goal * 0.40) / 4;
        v_carb_g := (v_cal_goal * 0.35) / 4;
        v_fat_g := (v_cal_goal * 0.25) / 9;
    ELSIF v_goal = 'build_muscle' THEN
        v_pro_g := (v_cal_goal * 0.35) / 4;
        v_carb_g := (v_cal_goal * 0.45) / 4;
        v_fat_g := (v_cal_goal * 0.20) / 9;
    ELSE -- maintenance/other
        v_pro_g := (v_cal_goal * 0.30) / 4;
        v_carb_g := (v_cal_goal * 0.45) / 4;
        v_fat_g := (v_cal_goal * 0.25) / 9;
    END IF;

    -- E. UPSERT into user_fitness_goals
    INSERT INTO public.user_fitness_goals (
        user_id, 
        goal_type, 
        daily_calorie_goal, 
        daily_protein_goal, 
        daily_carbs_goal, 
        daily_fats_goal, 
        is_active, 
        updated_at
    )
    VALUES (
        NEW.id, 
        v_goal, 
        ROUND(v_cal_goal), 
        ROUND(v_pro_g), 
        ROUND(v_carb_g), 
        ROUND(v_fat_g), 
        TRUE, 
        NOW()
    )
    ON CONFLICT (user_id, is_active) WHERE is_active = TRUE
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

-- 4. TRIGGER: Auto-Recalculate Nutrition
DROP TRIGGER IF EXISTS trg_users_recalculate_nutrition ON public.users;
CREATE TRIGGER trg_users_recalculate_nutrition
AFTER UPDATE OF weight, height, age, goal, primary_objective, workout_intensity ON public.users
FOR EACH ROW EXECUTE FUNCTION public.fn_recalculate_user_nutrition();

-- 5. RELOAD
NOTIFY pgrst, 'reload schema';
