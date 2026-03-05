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
    v_payment_json jsonb;
BEGIN
    -- Only run when status changes to 'completed'
    IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
        
        -- Convert NEW row to JSONB to safely check for columns that might not exist in all schemas
        v_payment_json := to_jsonb(NEW);
        
        -- 1. Identify the User
        -- Try standard 'user_id'
        IF v_payment_json ? 'user_id' AND v_payment_json->>'user_id' IS NOT NULL THEN
            v_user_id := (v_payment_json->>'user_id')::uuid;
        END IF;

        -- Fallback: Try 'member_id' if user_id was null
        IF v_user_id IS NULL AND v_payment_json ? 'member_id' AND v_payment_json->>'member_id' IS NOT NULL THEN
            v_user_id := (v_payment_json->>'member_id')::uuid;
        END IF;

        -- If still null, we cannot proceed
        IF v_user_id IS NULL THEN
            RAISE NOTICE 'Skipping membership activation: No user_id or member_id found on payment %', NEW.id;
            RETURN NEW;
        END IF;

        -- 2. Get Current Expiry Date from User
        SELECT membership_expiry INTO v_current_expiry FROM public.users WHERE id = v_user_id;

        -- 3. Determine Start Date (Honoring existing time)
        IF v_current_expiry IS NOT NULL AND v_current_expiry > CURRENT_DATE THEN
            v_new_start_date := v_current_expiry;
        ELSE
            v_new_start_date := CURRENT_DATE;
        END IF;

        -- 4. Calculate New Expiry
        v_months := COALESCE(NEW.months, 1);
        
        IF v_months < 0.1 THEN -- Day Pass
            v_expiry_date := (v_new_start_date + INTERVAL '1 day')::date;
            v_plan_id := 'Day Pass';
        ELSE
            v_expiry_date := (v_new_start_date + (v_months || ' months')::interval)::date;
            v_plan_id := 'Monthly Subscription';
        END IF;

        -- 5. Update the User Record
        UPDATE public.users
        SET 
            membership_status = 'Active',
            status = 'Active',
            payment_status = 'completed',
            membership_expiry = v_expiry_date,
            renewal_due_date = v_expiry_date,
            last_payment_date = CURRENT_DATE,
            subscription_duration_months = v_months,
            membership_type = COALESCE(NEW.description, membership_type, v_plan_id),
            updated_at = NOW()
        WHERE id = v_user_id;

        RAISE NOTICE 'Smart Activation: User % extended from % to %', v_user_id, v_new_start_date, v_expiry_date;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger first
DROP TRIGGER IF EXISTS on_payment_completed_activate_member ON public.payments;

-- Re-create Trigger
CREATE TRIGGER on_payment_completed_activate_member
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_membership_activation();
