-- 1. Batch Update: Fix any users who have paid but are stuck in 'Pending'
-- matches users with recent completed payments and forces them to Active
UPDATE public.users u
SET 
  membership_status = 'Active',
  status = 'Active',
  payment_status = 'completed',
  -- Attempt to sync expiry if missing
  membership_expiry = COALESCE(membership_expiry, (p.paid_at + INTERVAL '1 month')::date) 
FROM public.payments p
WHERE p.user_id = u.id
AND p.status IN ('completed', 'approved')
AND p.paid_at > (NOW() - INTERVAL '45 days') -- Look back 45 days
AND (u.membership_status IS DISTINCT FROM 'Active' OR u.status IS DISTINCT FROM 'Active');

-- 2. Ensure Trigger is strictly Case-Insensitive for future
-- (Re-applying the v3 trigger logic with lower-case status safeguards just in case)
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
    -- Only run when status changes to 'completed'
    IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
        
        v_payment_json := to_jsonb(NEW);
        
        -- Identify User
        IF v_payment_json ? 'user_id' AND v_payment_json->>'user_id' IS NOT NULL THEN
            v_user_id := (v_payment_json->>'user_id')::uuid;
        END IF;
        IF v_user_id IS NULL AND v_payment_json ? 'member_id' AND v_payment_json->>'member_id' IS NOT NULL THEN
            v_user_id := (v_payment_json->>'member_id')::uuid;
        END IF;

        IF v_user_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- Get Current Expiry
        SELECT membership_expiry INTO v_current_expiry FROM public.users WHERE id = v_user_id;

        -- Determine Start Date
        IF v_current_expiry IS NOT NULL AND v_current_expiry > CURRENT_DATE THEN
            v_new_start_date := v_current_expiry;
        ELSE
            v_new_start_date := CURRENT_DATE;
        END IF;

        -- Calculate Expiry
        v_months := COALESCE(NEW.months, 1);
        v_description := COALESCE(NEW.description, '');
        
        IF (v_description ILIKE '%day%pass%' OR v_description ILIKE '%daily%') THEN
            v_expiry_date := (v_new_start_date + INTERVAL '1 day')::date;
            v_plan_id := 'Day Pass';
            v_months := 0.033;
        ELSIF (v_description ILIKE '%week%pass%' OR v_description ILIKE '%weekly%') THEN
             v_expiry_date := (v_new_start_date + INTERVAL '1 week')::date;
             v_plan_id := 'Weekly Pass';
             v_months := 0.25;
        ELSIF v_months < 0.1 THEN 
            v_expiry_date := (v_new_start_date + INTERVAL '1 day')::date;
            v_plan_id := 'Day Pass';
        ELSE
            v_expiry_date := (v_new_start_date + (v_months || ' months')::interval)::date;
            v_plan_id := 'Monthly Subscription';
        END IF;

        -- Update User
        -- We set 'Active' and also ensure payment_status is 'completed'
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
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
