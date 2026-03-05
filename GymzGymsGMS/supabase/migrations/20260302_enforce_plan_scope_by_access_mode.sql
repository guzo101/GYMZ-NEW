-- ============================================================================
-- Enforce payments plan scope by user access mode
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_onboarding_plan_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan RECORD;
    v_user_gym_id UUID;
    v_user_access_mode TEXT;
    v_tip NUMERIC := COALESCE(NEW.tip_amount, 0);
    v_duration_days NUMERIC;
BEGIN
    IF NEW.plan_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT *
    INTO v_plan
    FROM public.gym_membership_plans
    WHERE id = NEW.plan_id
      AND is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pricing not available: selected plan is missing or inactive';
    END IF;

    SELECT gym_id, access_mode
    INTO v_user_gym_id, v_user_access_mode
    FROM public.users
    WHERE id = COALESCE(NEW.user_id, NEW.member_id)
    LIMIT 1;

    IF v_user_gym_id IS NOT NULL AND v_user_gym_id <> v_plan.gym_id THEN
        RAISE EXCEPTION 'Plan does not belong to member gym';
    END IF;

    IF v_user_access_mode IS NOT NULL
       AND COALESCE(v_plan.access_mode_scope, 'gym_access') <> 'both'
       AND COALESCE(v_plan.access_mode_scope, 'gym_access') <> v_user_access_mode THEN
        RAISE EXCEPTION 'Plan is not available for this access path';
    END IF;

    NEW.description := v_plan.plan_name;
    NEW.amount := v_plan.price + v_tip;

    v_duration_days := COALESCE(v_plan.duration_days,
        CASE v_plan.plan_type
            WHEN 'daily' THEN 1
            WHEN 'weekly' THEN 7
            WHEN 'monthly' THEN 30
            WHEN '3_months' THEN 90
            WHEN '6_months' THEN 180
            WHEN 'annual' THEN 365
            ELSE NULL
        END
    );

    IF v_duration_days IS NOT NULL THEN
        NEW.months := ROUND((v_duration_days / 30.0)::numeric, 3);
    END IF;

    RETURN NEW;
END;
$$;
