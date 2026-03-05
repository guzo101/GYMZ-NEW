-- ============================================================================
-- NEUTRAL ONBOARDING: ID SYNCHRONIZATION & RLS HARDENING
-- Date: 2026-03-05
-- Purpose: 
-- 1. Ensure users get a professional Unique ID the MOMENT they pick a gym.
-- 2. Restore and harden RLS policies for tracking tables (blocking new users).
-- 3. Sync gym_id into tracking tables for strict multi-tenant isolation.
-- ============================================================================

BEGIN;

-- ─── 1. HARDEN UNIQUE ID GENERATION ON UPDATE ────────────────────────────────
-- This ensures that when a user updates their gym_id (from NULL or changed),
-- they immediately get a professional ID assigned.

CREATE OR REPLACE FUNCTION public.ensure_member_unique_id()
RETURNS TRIGGER AS $$
DECLARE
    v_is_event BOOLEAN;
BEGIN
    -- Determine if this should be an event ID or regular ID
    v_is_event := (NEW.access_mode = 'event_access') 
                  OR (NEW.membership_status IS NULL OR NEW.membership_status = 'unassigned');

    -- IF gym_id is set and (it was NULL OR it changed)
    IF NEW.gym_id IS NOT NULL AND (OLD.gym_id IS NULL OR NEW.gym_id <> OLD.gym_id) THEN
        -- Generate new ID
        NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, v_is_event);
        -- Update membership status if it was unassigned
        IF NEW.membership_status = 'unassigned' THEN
            NEW.membership_status := 'New';
        END IF;
    END IF;

    -- Backup: If unique_id is somehow still NULL but gym_id exists
    IF NEW.gym_id IS NOT NULL AND (NEW.unique_id IS NULL OR NEW.unique_id = '') THEN
        NEW.unique_id := public.generate_gym_member_id(NEW.gym_id, v_is_event);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach to catch gym_id updates during onboarding
DROP TRIGGER IF EXISTS trigger_ensure_member_unique_id ON public.users;
CREATE TRIGGER trigger_ensure_member_unique_id
BEFORE UPDATE OF gym_id, access_mode, membership_status ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_member_unique_id();


-- ─── 2. RESTORE TRACKING POLICIES (RLS FIX) ──────────────────────────────────
-- Specifically addresses "new row violates row-level security policy" for new users.

-- A. body_metrics
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own body metrics" ON public.body_metrics;
DROP POLICY IF EXISTS "Users can insert own body metrics" ON public.body_metrics;
DROP POLICY IF EXISTS "Users can update own body metrics" ON public.body_metrics;

CREATE POLICY "Users can view own body metrics" ON public.body_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own body metrics" ON public.body_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own body metrics" ON public.body_metrics FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- B. user_fitness_goals
ALTER TABLE public.user_fitness_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own goals" ON public.user_fitness_goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON public.user_fitness_goals;
DROP POLICY IF EXISTS "Users can update own goals" ON public.user_fitness_goals;

CREATE POLICY "Users can view own goals" ON public.user_fitness_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.user_fitness_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.user_fitness_goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- C. daily_calorie_summary
ALTER TABLE public.daily_calorie_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own calorie summary" ON public.daily_calorie_summary;
DROP POLICY IF EXISTS "Users can insert own calorie summary" ON public.daily_calorie_summary;
DROP POLICY IF EXISTS "Users can update own calorie summary" ON public.daily_calorie_summary;

CREATE POLICY "Users can view own calorie summary" ON public.daily_calorie_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calorie summary" ON public.daily_calorie_summary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calorie summary" ON public.daily_calorie_summary FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─── 3. GYM SCOPING & ISOLATION ──────────────────────────────────────────────
-- Adds gym_id to tracking tables to allow Admins to eventually view these metrics.

DO $$ 
BEGIN
    -- body_metrics
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'body_metrics' AND column_name = 'gym_id') THEN
        ALTER TABLE public.body_metrics ADD COLUMN gym_id UUID REFERENCES public.gyms(id);
    END IF;

    -- user_fitness_goals
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_fitness_goals' AND column_name = 'gym_id') THEN
        ALTER TABLE public.user_fitness_goals ADD COLUMN gym_id UUID REFERENCES public.gyms(id);
    END IF;

    -- daily_calorie_summary
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_calorie_summary' AND column_name = 'gym_id') THEN
        ALTER TABLE public.daily_calorie_summary ADD COLUMN gym_id UUID REFERENCES public.gyms(id);
    END IF;
END $$;

-- ─── 4. BACKFILL GYM_ID ──────────────────────────────────────────────────────
UPDATE public.body_metrics t SET gym_id = u.gym_id FROM public.users u WHERE t.user_id = u.id AND t.gym_id IS NULL;
UPDATE public.user_fitness_goals t SET gym_id = u.gym_id FROM public.users u WHERE t.user_id = u.id AND t.gym_id IS NULL;
UPDATE public.daily_calorie_summary t SET gym_id = u.gym_id FROM public.users u WHERE t.user_id = u.id AND t.gym_id IS NULL;

-- ─── 5. UPDATE NUTRITION ENGINE (GYM-AWARE) ───────────────────────────────────
-- Ensures that the database-side recalculation also inherits the gym_id.

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
    v_goal := COALESCE(NEW.goal, NEW.primary_objective, 'recomp');

    -- Adjust Goal
    v_cal_goal := v_tdee;
    IF v_goal = 'lose_weight' THEN v_cal_goal := v_cal_goal - 500; END IF;
    IF v_goal = 'build_muscle' THEN v_cal_goal := v_cal_goal + 300; END IF;
    v_cal_goal := GREATEST(v_cal_goal, 1200);

    -- Macro Splits
    IF v_goal = 'lose_weight' THEN
        v_pro_g := (v_cal_goal * 0.40) / 4; v_carb_g := (v_cal_goal * 0.35) / 4; v_fat_g := (v_cal_goal * 0.25) / 9;
    ELSIF v_goal = 'build_muscle' THEN
        v_pro_g := (v_cal_goal * 0.35) / 4; v_carb_g := (v_cal_goal * 0.45) / 4; v_fat_g := (v_cal_goal * 0.20) / 9;
    ELSE
        v_pro_g := (v_cal_goal * 0.30) / 4; v_carb_g := (v_cal_goal * 0.45) / 4; v_fat_g := (v_cal_goal * 0.25) / 9;
    END IF;

    -- Update user_fitness_goals (GYM-AWARE UPSERT)
    INSERT INTO public.user_fitness_goals (
        user_id, 
        gym_id,
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
        NEW.gym_id,
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
        gym_id = COALESCE(public.user_fitness_goals.gym_id, EXCLUDED.gym_id),
        goal_type = EXCLUDED.goal_type,
        daily_calorie_goal = EXCLUDED.daily_calorie_goal,
        daily_protein_goal = EXCLUDED.daily_protein_goal,
        daily_carbs_goal = EXCLUDED.daily_carbs_goal,
        daily_fats_goal = EXCLUDED.daily_fats_goal,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 6. ADMIN VIEW PERMISSIONS (Multi-Tenant Enforced) ───────────────────────
DROP POLICY IF EXISTS "Admins can view member body metrics" ON public.body_metrics;
CREATE POLICY "Admins can view member body metrics" ON public.body_metrics FOR SELECT USING (public.is_gym_admin(gym_id));

DROP POLICY IF EXISTS "Admins can view member fitness goals" ON public.user_fitness_goals;
CREATE POLICY "Admins can view member fitness goals" ON public.user_fitness_goals FOR SELECT USING (public.is_gym_admin(gym_id));

COMMIT;

NOTIFY pgrst, 'reload schema';
