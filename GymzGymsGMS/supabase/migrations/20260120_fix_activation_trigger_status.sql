-- Fix membership activation to work with 'approved' status (Admin Dashboard)
-- Previously only worked with 'completed' status

CREATE OR REPLACE FUNCTION public.handle_membership_activation()
RETURNS TRIGGER AS $$
DECLARE
    v_months numeric;
    v_expiry_date date;
    v_current_expiry date;
    v_user_id uuid;
    v_plan_id text;
    v_new_start_date date;
    v_is_valid_status boolean;
    v_was_valid_status boolean;
BEGIN
    -- Define what counts as a "paid" status
    v_is_valid_status := NEW.status IN ('completed', 'approved');
    
    -- Check if it WAS already paid (to avoid double-activation)
    IF TG_OP = 'UPDATE' THEN
        v_was_valid_status := OLD.status IN ('completed', 'approved');
    ELSE
        v_was_valid_status := FALSE;
    END IF;

    -- Only run when status becomes valid/paid AND wasn't before
    IF v_is_valid_status AND NOT v_was_valid_status THEN
        
        v_user_id := NEW.user_id;
        IF v_user_id IS NULL THEN
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
        
        IF v_months < 0.1 THEN -- Day Pass
             -- Day Pass expires at the END of the start date (Same Day)
            v_expiry_date := v_new_start_date;
            v_plan_id := 'Day Pass';
        ELSE
            -- Add months to the start date
            v_expiry_date := (v_new_start_date + (v_months || ' months')::interval)::date;
            v_plan_id := 'Monthly Subscription';
        END IF;

        -- 4. Update the User Record
        UPDATE public.users
        SET 
            membership_status = 'Active',
            status = 'Active',
            payment_status = 'completed', -- Sync user payment status to completed even if payment is just approved
            membership_expiry = v_expiry_date,
            renewal_due_date = v_expiry_date,
            last_payment_date = CURRENT_DATE,
            subscription_duration_months = v_months,
            -- Only update membership type if it's changing, otherwise keep existing
            membership_type = COALESCE(NEW.description, membership_type, v_plan_id),
            updated_at = NOW()
        WHERE id = v_user_id;

        RAISE NOTICE 'Smart Activation (Fix): User % extended from % to %', v_user_id, v_new_start_date, v_expiry_date;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger to be safe (though function update is enough usually)
DROP TRIGGER IF EXISTS on_payment_completed_activate_member ON public.payments;

CREATE TRIGGER on_payment_completed_activate_member
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_membership_activation();
