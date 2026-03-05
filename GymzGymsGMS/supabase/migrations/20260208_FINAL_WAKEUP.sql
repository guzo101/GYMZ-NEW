-- ============================================================================
-- FINAL WAKEUP: CALORIE ENGINE ACTIVATION (V3)
-- Purpose: 
-- 1. Redefine the engine with strict scientific categories and safety fallbacks.
-- 2. Restore a liberal trigger that fires on ANY profile update.
-- 3. Force a global backfill to populate the dashboard immediately.
-- ============================================================================

BEGIN;

-- 1. FUNCTION: The Scientific Brain (Enhanced)
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
    -- A. Data Sanitization (Zero Guesswork)
    v_weight := NULLIF(NEW.weight::TEXT, '')::NUMERIC;
    v_height := NULLIF(NEW.height::TEXT, '')::NUMERIC;
    v_age    := NULLIF(NEW.age::TEXT, '')::NUMERIC;

    IF v_weight IS NULL OR v_height IS NULL OR v_age IS NULL THEN
        RETURN NEW;
    END IF;

    -- B. BMR Calculation (Mifflin-St Jeor)
    v_bmr := (10 * v_weight) + (6.25 * v_height) - (5 * v_age);
    IF NEW.gender = 'male' THEN v_bmr := v_bmr + 5; ELSE v_bmr := v_bmr - 161; END IF;

    -- C. Activity Factor
    v_activity_mult := CASE 
        WHEN NEW.workout_intensity = 'low' THEN 1.375
        WHEN NEW.workout_intensity = 'high' THEN 1.725
        WHEN NEW.workout_intensity = 'extreme' THEN 1.9
        ELSE 1.55 -- Default to moderate
    END;

    v_tdee := v_bmr * v_activity_mult;
    
    -- D. Goal Normalization (Ensuring compatibility with DB constraints)
    v_goal := COALESCE(NEW.goal, NEW.primary_objective, 'maintenance');
    
    -- Safety: Force goal into one of the allowed scientific categories
    v_goal := CASE 
        WHEN v_goal IN ('weight_loss', 'lose_weight') THEN 'lose_weight'
        WHEN v_goal IN ('weight_gain', 'build_muscle', 'muscle_gain') THEN 'muscle_gain'
        WHEN v_goal = 'recomp' THEN 'recomp'
        WHEN v_goal = 'endurance' THEN 'endurance'
        WHEN v_goal = 'strength' THEN 'strength'
        ELSE 'maintenance' -- Non-negotiable scientific fallback
    END;

    -- E. Target Adjustment (Zero Guesswork)
    v_cal_goal := v_tdee;
    IF v_goal = 'lose_weight' THEN v_cal_goal := v_cal_goal - 500; END IF;
    IF v_goal = 'muscle_gain' THEN v_cal_goal := v_cal_goal + 300; END IF;
    
    v_cal_goal := GREATEST(v_cal_goal, 1200);

    -- F. Macro Splits
    IF v_goal = 'lose_weight' THEN
        v_pro_g := (v_cal_goal * 0.40) / 4; v_carb_g := (v_cal_goal * 0.35) / 4; v_fat_g := (v_cal_goal * 0.25) / 9;
    ELSIF v_goal = 'muscle_gain' THEN
        v_pro_g := (v_cal_goal * 0.35) / 4; v_carb_g := (v_cal_goal * 0.45) / 4; v_fat_g := (v_cal_goal * 0.20) / 9;
    ELSE
        v_pro_g := (v_cal_goal * 0.30) / 4; v_carb_g := (v_cal_goal * 0.45) / 4; v_fat_g := (v_cal_goal * 0.25) / 9;
    END IF;

    -- G. Secure Upsert
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
    RAISE WARNING 'Nutrition engine error for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER: Universal Profile Sync
DROP TRIGGER IF EXISTS trg_users_recalculate_nutrition ON public.users;
CREATE TRIGGER trg_users_recalculate_nutrition
AFTER UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.fn_recalculate_user_nutrition();

-- 3. GLOBAL SPARK: Wake up every profile that has metrics
UPDATE public.users 
SET updated_at = NOW()
WHERE weight IS NOT NULL 
   OR height IS NOT NULL;

COMMIT;

-- Ensure cache reload
NOTIFY pgrst, 'reload schema';
