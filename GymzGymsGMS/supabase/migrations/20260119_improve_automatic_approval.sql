-- Function to automatically activate membership when payment is completed or approved
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
    v_description text;
BEGIN
    -- Only run when status changes to 'completed' or 'approved'
    IF (NEW.status IN ('completed', 'approved')) AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        
        -- Convert NEW row to JSONB for safe access
        v_payment_json := to_jsonb(NEW);
        
        -- 1. Identify the User (Standardize on user_id, fallback to member_id)
        v_user_id := COALESCE(
            (v_payment_json->>'user_id')::uuid,
            (v_payment_json->>'member_id')::uuid
        );

        -- If still null, we cannot proceed
        IF v_user_id IS NULL THEN
            RAISE NOTICE 'Skipping membership activation: No user_id or member_id found on payment %', NEW.id;
            RETURN NEW;
        END IF;

        -- 2. Get Current Expiry Date from User
        SELECT membership_expiry INTO v_current_expiry FROM public.users WHERE id = v_user_id;

        -- 3. Determine Start Date (Honoring existing time)
        -- If current membership is still active, extend it. Otherwise start from today.
        IF v_current_expiry IS NOT NULL AND v_current_expiry > CURRENT_DATE THEN
            v_new_start_date := v_current_expiry;
        ELSE
            v_new_start_date := CURRENT_DATE;
        END IF;

        -- 4. Calculate New Expiry (With Smart Parsing)
        v_months := COALESCE(NEW.months, 1);
        v_description := COALESCE(NEW.description, '');
        
        -- Override Logic: Check Description for Keywords to Correct Common Input Errors
        IF (v_description ILIKE '%day%pass%' OR v_description ILIKE '%daily%') THEN
            v_expiry_date := (v_new_start_date + INTERVAL '1 day')::date;
            v_plan_id := 'Day Pass';
            v_months := 1/30.0;
        ELSIF (v_description ILIKE '%week%pass%' OR v_description ILIKE '%weekly%') THEN
             v_expiry_date := (v_new_start_date + INTERVAL '1 week')::date;
             v_plan_id := 'Weekly Pass';
             v_months := 0.25;
        ELSIF (v_description ILIKE '%year%' OR v_description ILIKE '%annual%') THEN
             v_expiry_date := (v_new_start_date + INTERVAL '1 year')::date;
             v_plan_id := 'Annual Membership';
             v_months := 12;
        ELSIF v_months < 0.1 THEN 
            -- Explicit small month value usually means Day Pass (e.g. 0.033)
            v_expiry_date := (v_new_start_date + INTERVAL '1 day')::date;
            v_plan_id := 'Day Pass';
        ELSE
            -- Standard Monthly Logic
            v_expiry_date := (v_new_start_date + (v_months || ' months')::interval)::date;
            v_plan_id := 'Monthly Subscription';
        END IF;

        -- 5. Update the User Record
        -- This is the "Automatic" part the user wants to improve.
        UPDATE public.users
        SET 
            membership_status = 'Active',
            status = 'Active',           -- Sync legacy status
            payment_status = 'completed', -- Sync legacy payment status
            membership_expiry = v_expiry_date,
            renewal_due_date = v_expiry_date,
            last_payment_date = CURRENT_DATE,
            subscription_duration_months = v_months,
            membership_type = COALESCE(NULLIF(v_plan_id, ''), NEW.description, membership_type),
            updated_at = NOW()
        WHERE id = v_user_id;

        -- 6. Mark relevant notifications as read
        UPDATE public.notifications
        SET is_read = TRUE, updated_at = NOW()
        WHERE payment_id = NEW.id AND is_read = FALSE;

        RAISE NOTICE 'Automated Activation: User % set to Active until % via payment %', v_user_id, v_expiry_date, NEW.id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is attached correctly
DROP TRIGGER IF EXISTS on_payment_completed_activate_member ON public.payments;
CREATE TRIGGER on_payment_completed_activate_member
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_membership_activation();
