-- Migration: Verify member has gym OR event access (for app check-in)
-- Used by member app before allowing gym check-in
-- Date: 2026-04-08

CREATE OR REPLACE FUNCTION public.verify_member_has_access(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_gym_active BOOLEAN := false;
    v_event_active BOOLEAN := false;
    v_expiry TIMESTAMPTZ;
    v_days_remaining INTEGER;
BEGIN
    -- 1. Get user
    SELECT id, name, membership_status, renewal_due_date, payment_status
    INTO v_user
    FROM public.users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'has_access', false,
            'gym_active', false,
            'event_active', false,
            'reason', 'User not found',
            'membership_status', NULL,
            'renewal_due_date', NULL,
            'days_remaining', NULL
        );
    END IF;

    -- 2. Check gym access (membership + payment)
    v_expiry := v_user.renewal_due_date;
    IF v_expiry IS NOT NULL AND v_expiry > NOW() THEN
        v_gym_active := (v_user.membership_status IS NULL OR lower(v_user.membership_status) IN ('active', 'completed', 'valid'));
    END IF;

    -- Also check payments table for completed payment
    IF EXISTS (
        SELECT 1 FROM public.payments
        WHERE (user_id = p_user_id OR member_id = p_user_id)
        AND lower(COALESCE(status, '')) IN ('completed', 'approved', 'active', 'paid')
        LIMIT 1
    ) THEN
        v_gym_active := true;
    END IF;

    -- 3. Check event access (confirmed RSVPs for today or future)
    SELECT EXISTS (
        SELECT 1
        FROM public.event_rsvps er
        JOIN public.events e ON e.id = er.event_id
        WHERE er.user_id = p_user_id
        AND er.status = 'confirmed'
        AND e.event_date >= date_trunc('day', NOW())
    ) INTO v_event_active;

    -- 4. Compute days remaining (for UI display)
    v_days_remaining := CASE
        WHEN v_expiry IS NULL THEN NULL
        ELSE GREATEST(0, (v_expiry::date - CURRENT_DATE)::INTEGER)
    END;

    -- 5. Overall: valid if gym OR event
    RETURN jsonb_build_object(
        'has_access', v_gym_active OR v_event_active,
        'gym_active', v_gym_active,
        'event_active', v_event_active,
        'reason', CASE
            WHEN v_gym_active AND v_event_active THEN 'Gym and event access active'
            WHEN v_gym_active THEN 'Gym access active'
            WHEN v_event_active THEN 'Event access active'
            ELSE 'No active gym or event access'
        END,
        'membership_status', v_user.membership_status,
        'renewal_due_date', v_expiry,
        'days_remaining', v_days_remaining
    );
END;
$$;
