-- ============================================================================
-- THE NEURAL FIX: TYPE-SAFE CALCULATIONS
-- Purpose: 
-- 1. Fix the "numeric * text" operator error by adding explicit casts.
-- 2. Ensure health metrics are treated as numbers regardless of DB storage type.
-- ============================================================================

BEGIN;

-- Redefine the function with explicit type safety (::NUMERIC)
CREATE OR REPLACE FUNCTION public.fn_recalculate_user_nutrition()
RETURNS TRIGGER AS $$
DECLARE
    v_bmr NUMERIC;
    v_tdee NUMERIC;
    v_activity_mult NUMERIC;
    v_cal_goal NUMERIC;
    v_pro_g NUMERIC; v_carb_g NUMERIC; v_fat_g NUMERIC;
    v_goal TEXT;
    v_weight NUMERIC;
    v_height NUMERIC;
    v_age NUMERIC;
BEGIN
    -- Explicitly cast to numeric to avoid "operator does not exist: numeric * text"
    v_weight := NULLIF(NEW.weight::TEXT, '')::NUMERIC;
    v_height := NULLIF(NEW.height::TEXT, '')::NUMERIC;
    v_age    := NULLIF(NEW.age::TEXT, '')::NUMERIC;

    IF v_weight IS NULL OR v_height IS NULL OR v_age IS NULL THEN
        RETURN NEW;
    END IF;

    -- Scientific BMR (Mifflin-St Jeor) with type-safe variables
    v_bmr := (10 * v_weight) + (6.25 * v_height) - (5 * v_age);
    
    IF NEW.gender = 'male' THEN 
        v_bmr := v_bmr + 5; 
    ELSE 
        v_bmr := v_bmr - 161; 
    END IF;

    -- Activity Multiplier (Activity-Adjusted Metabolism)
    v_activity_mult := CASE 
        WHEN NEW.workout_intensity = 'low' THEN 1.375
        WHEN NEW.workout_intensity = 'high' THEN 1.725
        WHEN NEW.workout_intensity = 'extreme' THEN 1.9
        ELSE 1.55 -- moderate default
    END;

    v_tdee := v_bmr * v_activity_mult;
    v_goal := COALESCE(NEW.goal, NEW.primary_objective, 'maintenance');

    -- STRICT SCIENTIFIC CATEGORIES (No Guesswork)
    -- If goal is non-standard text, we provide Maintenance (v_tdee)
    v_cal_goal := v_tdee;
    
    IF v_goal IN ('lose_weight', 'weight_loss') THEN 
        v_cal_goal := v_cal_goal - 500; 
    ELSIF v_goal IN ('build_muscle', 'muscle_gain') THEN 
        v_cal_goal := v_cal_goal + 300; 
    -- If it's not one of the above, we do NOT guess a deficit/surplus.
    -- We stay at v_tdee (Maintenance).
    END IF;
    
    -- Safety Floor
    v_cal_goal := GREATEST(v_cal_goal, 1200);

    -- Scientific Macro Splits
    IF v_goal = 'lose_weight' OR v_goal = 'weight_loss' THEN
        v_pro_g := (v_cal_goal * 0.40) / 4; 
        v_carb_g := (v_cal_goal * 0.35) / 4; 
        v_fat_g := (v_cal_goal * 0.25) / 9;
    ELSIF v_goal = 'build_muscle' OR v_goal = 'muscle_gain' THEN
        v_pro_g := (v_cal_goal * 0.35) / 4; 
        v_carb_g := (v_cal_goal * 0.45) / 4; 
        v_fat_g := (v_cal_goal * 0.20) / 9;
    ELSE -- maintenance/other
        v_pro_g := (v_cal_goal * 0.30) / 4; 
        v_carb_g := (v_cal_goal * 0.45) / 4; 
        v_fat_g := (v_cal_goal * 0.25) / 9;
    END IF;

    -- Upsert logical targets into user_fitness_goals
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
    -- Prevent profile updates from crashing if math fails
    RAISE WARNING 'Nutrition recalculation failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RE-SPARK: Force the update again with the new safe logic
UPDATE public.users 
SET updated_at = NOW()
WHERE weight IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
