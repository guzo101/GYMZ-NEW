-- DEFINITIVE FIX: SAME-DAY EXPIRY LOGIC (BASE DATE + DURATION)
-- This migration implements the refined logic where Day Passes expire today (valid for today only)
-- and subsequent payments extend any existing active duration.

BEGIN;

-- 1. Correct/Update the Smart Activation Trigger
CREATE OR REPLACE FUNCTION public.handle_membership_activation()
RETURNS TRIGGER AS $$
DECLARE
    v_months numeric;
    v_expiry_date date;
    v_current_expiry date;
    v_user_id uuid;
    v_plan_id text;
    v_base_date date; -- The starting point for the new duration
    v_description text;
    v_is_valid_status boolean;
    v_was_valid_status boolean;
BEGIN
    -- Define what counts as a "paid" status
    v_is_valid_status := NEW.status IN ('completed', 'approved') OR NEW.payment_status IN ('completed', 'approved');
    
    -- Check if it WAS already paid (to avoid double-activation)
    IF TG_OP = 'UPDATE' THEN
        v_was_valid_status := OLD.status IN ('completed', 'approved') OR OLD.payment_status IN ('completed', 'approved');
    ELSE
        v_was_valid_status := FALSE;
    END IF;

    -- Only run when status becomes valid/paid AND wasn't before
    IF v_is_valid_status AND NOT v_was_valid_status THEN
        
        -- Resolve User ID
        v_user_id := COALESCE(NEW.user_id, NEW.member_id);
        
        IF v_user_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- 1. Get Current Expiry Date from User
        SELECT membership_expiry INTO v_current_expiry FROM public.users WHERE id = v_user_id;

        -- 2. Determine BASE DATE (The floor for calculations)
        -- If current expiry is in the future, start the new period from THEN.
        -- If it's expired or null, start from YESTERDAY so that +1 day = TODAY.
        IF v_current_expiry IS NOT NULL AND v_current_expiry >= CURRENT_DATE THEN
            v_base_date := v_current_expiry;
        ELSE
            v_base_date := CURRENT_DATE - INTERVAL '1 day';
        END IF;

        -- 3. Calculate New Expiry
        v_months := COALESCE(NEW.months, 1);
        v_description := COALESCE(NEW.description, '');
        
        -- Requirement: "Day Pass expires on the same day". 
        -- Logic: base_date + 1 day.
        -- If fresh: (Today - 1) + 1 = Today.
        -- If active (e.g. expires Jan 25): Jan 25 + 1 = Jan 26.
        
        IF (v_description ILIKE '%day%' OR v_description ILIKE '%daily%' OR v_months < 0.1) THEN
            v_expiry_date := (v_base_date + INTERVAL '1 day')::date;
            v_plan_id := 'Day Pass';
            v_months := 0.033;
            
        ELSIF (v_description ILIKE '%week%' OR v_description ILIKE '%weekly%') THEN
             v_expiry_date := (v_base_date + INTERVAL '7 days')::date;
             v_plan_id := 'Weekly Pass';
             v_months := 0.25;

        ELSE
            -- Standard Monthly logic: Add months to the base date
            v_months := CASE WHEN v_months <= 0 THEN 1 ELSE v_months END;
            v_expiry_date := (v_base_date + (v_months || ' months')::interval)::date;
            v_plan_id := 'Monthly Subscription';
        END IF;

        -- 4. Update the User Record
        UPDATE public.users
        SET 
            membership_status = 'Active',
            status = 'Active',
            payment_status = 'completed', 
            membership_expiry = v_expiry_date,
            renewal_due_date = v_expiry_date,
            last_payment_date = CURRENT_DATE,
            subscription_duration_months = v_months,
            membership_type = COALESCE(NULLIF(v_description, ''), membership_type, v_plan_id),
            updated_at = NOW()
        WHERE id = v_user_id;

        RAISE NOTICE 'Gymz Refined Activation: User % base % -> expiry %', v_user_id, v_base_date, v_expiry_date;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger
DROP TRIGGER IF EXISTS on_payment_completed_activate_member ON public.payments;
CREATE TRIGGER on_payment_completed_activate_member
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_membership_activation();

COMMIT;
