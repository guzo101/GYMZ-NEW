-- Function to automatically activate membership when payment is completed
CREATE OR REPLACE FUNCTION public.handle_membership_activation()
RETURNS TRIGGER AS $$
DECLARE
    v_months numeric;
    v_expiry_date date;
    v_current_expiry date;
    v_user_id uuid;
    v_plan_id text;
    v_new_start_date date;
BEGIN
    -- Only run when status changes to 'completed'
    IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
        
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
            payment_status = 'completed',
            membership_expiry = v_expiry_date,
            renewal_due_date = v_expiry_date,
            last_payment_date = CURRENT_DATE,
            subscription_duration_months = v_months,
            -- Only update membership type if it's changing, otherwise keep existing
            membership_type = COALESCE(NEW.description, membership_type, v_plan_id),
            updated_at = NOW()
        WHERE id = v_user_id;

        RAISE NOTICE 'Smart Activation: User % extended from % to %', v_user_id, v_new_start_date, v_expiry_date;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger first to ensure clean update
DROP TRIGGER IF EXISTS on_payment_completed_activate_member ON public.payments;

-- Re-create Trigger
CREATE TRIGGER on_payment_completed_activate_member
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_membership_activation();


-- NEW: Trigger to handle manual updates on users table directly (Admin Panel Fix)
CREATE OR REPLACE FUNCTION public.handle_manual_membership_update()
RETURNS TRIGGER AS $$
DECLARE
    v_duration interval;
BEGIN
    -- If status changes to Active (and wasn't before)
    IF NEW.membership_status = 'Active' AND (OLD.membership_status IS DISTINCT FROM 'Active') THEN
        
        -- If dates are missing, auto-fill them
        IF NEW.last_payment_date IS NULL THEN
             NEW.last_payment_date := CURRENT_DATE;
        END IF;

        IF NEW.renewal_due_date IS NULL THEN
            -- Determine duration based on type string
            IF NEW.membership_type ILIKE '%day%' OR NEW.membership_type ILIKE '%daily%' THEN
                -- Day Pass: Valid for the paid day ONLY (Expires end of that day)
                v_duration := INTERVAL '0 day';
            ELSIF NEW.membership_type ILIKE '%week%' THEN
                v_duration := INTERVAL '1 week';
            ELSIF NEW.membership_type ILIKE '%year%' OR NEW.membership_type ILIKE '%annual%' THEN
                v_duration := INTERVAL '1 year';
            ELSE
                -- Default to 1 month for Basic, Premium, etc.
                v_duration := INTERVAL '1 month';
            END IF;

            NEW.renewal_due_date := (NEW.last_payment_date + v_duration)::date;
            NEW.membership_expiry := NEW.renewal_due_date; -- Sync expiry
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_manual_membership_update ON public.users;

CREATE TRIGGER on_manual_membership_update
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_manual_membership_update();
