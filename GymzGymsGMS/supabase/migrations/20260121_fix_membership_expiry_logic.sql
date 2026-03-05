-- FIX: ADD MISSING COLUMNS AND IMPLEMENT SMART EXPIRY LOGIC
-- Migration to ensure all membership columns exist and triggers are accurate.

BEGIN;

-- 1. Ensure all columns exist in public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS membership_expiry DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS renewal_due_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_payment_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_duration_months NUMERIC DEFAULT 1;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payment_status TEXT;

-- 2. Update the Smart Activation Trigger
CREATE OR REPLACE FUNCTION public.handle_membership_activation()
RETURNS TRIGGER AS $$
DECLARE
    v_months numeric;
    v_expiry_date date;
    v_current_expiry date;
    v_user_id uuid;
    v_plan_id text;
    v_new_start_date date;
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
        
        -- Resolve User ID (Handle both user_id and member_id logic)
        v_user_id := COALESCE(NEW.user_id, NEW.member_id);
        
        IF v_user_id IS NULL THEN
            RAISE WARNING 'Payment % has no user_id or member_id', NEW.id;
            RETURN NEW;
        END IF;

        -- 1. Get Current Expiry Date from User
        SELECT membership_expiry INTO v_current_expiry FROM public.users WHERE id = v_user_id;

        -- 2. Determine Start Date (Honoring existing time)
        -- If current expiry is in the future, start the new period from THEN.
        -- If it's expired or null, start from TODAY.
        IF v_current_expiry IS NOT NULL AND v_current_expiry > CURRENT_DATE THEN
            v_new_start_date := v_current_expiry;
        ELSE
            v_new_start_date := CURRENT_DATE;
        END IF;

        -- 3. Calculate New Expiry
        v_months := COALESCE(NEW.months, 1);
        v_description := COALESCE(NEW.description, '');
        
        -- CASE 1: Day Pass / Daily
        IF (v_description ILIKE '%day%' OR v_description ILIKE '%daily%' OR v_months < 0.1) THEN
             -- User requested: "if the payment is a day pass then the payment expires on the same day at midnight"
             -- In SQL, CURRENT_DATE + 1 is the next day at 00:00:00, which is midnight of the same day.
            v_expiry_date := (v_new_start_date + INTERVAL '1 day')::date;
            v_plan_id := 'Day Pass';
            v_months := 0.033; -- Normalized record keeping
            
        -- CASE 2: Weekly
        ELSIF (v_description ILIKE '%week%' OR v_description ILIKE '%weekly%') THEN
             v_expiry_date := (v_new_start_date + INTERVAL '7 days')::date;
             v_plan_id := 'Weekly Pass';
             v_months := 0.25;

        -- CASE 3: Standard Monthly or Multi-Month
        ELSE
            v_expiry_date := (v_new_start_date + (v_months || ' months')::interval)::date;
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

        RAISE NOTICE 'Gymz Smart Activation: User % extended from % to % (Plan: %)', v_user_id, v_new_start_date, v_expiry_date, v_plan_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-apply trigger to payments table
DROP TRIGGER IF EXISTS on_payment_completed_activate_member ON public.payments;

CREATE TRIGGER on_payment_completed_activate_member
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_membership_activation();

COMMIT;
