-- ================================================================================
-- ATOMIC SUBSCRIPTION ACTIVATION ENGINE
-- Generated: 2026-02-04
-- ================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.activate_subscription_from_payment(
    p_payment_id UUID,
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_payment record;
    v_tier record;
    v_user_id UUID;
    v_amount NUMERIC;
    v_days INTEGER;
    v_existing_sub record;
    v_new_end_date TIMESTAMPTZ;
    v_start_date TIMESTAMPTZ;
BEGIN
    -- 1. Get Payment Details
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
    END IF;

    v_user_id := COALESCE(v_payment.user_id, v_payment.member_id);
    v_amount := v_payment.amount;

    -- 2. Identify the Tier
    -- Fallback logic to match text-based tiers from existing system
    SELECT * INTO v_tier FROM public.membership_tiers 
    WHERE name = v_payment.membership_type 
       OR name = v_payment.description
       OR (price_zmw = v_amount AND active = true)
    LIMIT 1;

    IF NOT FOUND THEN
        -- Default to Basic if price is close or unknown
        SELECT * INTO v_tier FROM public.membership_tiers WHERE name = 'Basic';
    END IF;

    -- 3. Insert Ledger Entry (Credit for Payment)
    INSERT INTO public.ledger_entries (
        user_id, amount, type, source_type, source_id, description
    ) VALUES (
        v_user_id, v_amount, 'credit', 'payment', p_payment_id, 
        'Payment received via ' || v_payment.method
    );

    -- 4. Check for existing active subscription
    SELECT * INTO v_existing_sub 
    FROM public.subscriptions 
    WHERE user_id = v_user_id 
      AND status IN ('active', 'grace_period')
    ORDER BY ends_at DESC LIMIT 1;

    -- 5. Calculate New Dates
    IF v_existing_sub.id IS NOT NULL AND v_existing_sub.ends_at > NOW() THEN
        -- Extend existing
        v_start_date := v_existing_sub.ends_at;
        v_new_end_date := v_start_date + (v_tier.duration_days || ' days')::interval;
    ELSE
        -- Start fresh
        v_start_date := NOW();
        v_new_end_date := v_start_date + (v_tier.duration_days || ' days')::interval;
    END IF;

    -- 6. Activate Subscription
    IF v_existing_sub.id IS NOT NULL AND v_existing_sub.status = 'active' THEN
        -- Update existing if it's the same tier
        IF v_existing_sub.tier_id = v_tier.id THEN
            UPDATE public.subscriptions 
            SET ends_at = v_new_end_date, updated_at = NOW() 
            WHERE id = v_existing_sub.id;
        ELSE
            -- New tier, create new subscription
            INSERT INTO public.subscriptions (user_id, tier_id, status, starts_at, ends_at)
            VALUES (v_user_id, v_tier.id, 'active', v_start_date, v_new_end_date);
        END IF;
    ELSE
        -- No active sub or different state, create new
        INSERT INTO public.subscriptions (user_id, tier_id, status, starts_at, ends_at)
        VALUES (v_user_id, v_tier.id, 'active', v_start_date, v_new_end_date);
    END IF;

    -- 7. Debit the Ledger for the Subscription Cost
    INSERT INTO public.ledger_entries (
        user_id, amount, type, source_type, source_id, description
    ) VALUES (
        v_user_id, -v_tier.price_zmw, 'debit', 'subscription_purchase', gen_random_uuid(), -- ideally we'd link to the sub id
        'Purchase of ' || v_tier.name
    );

    -- 8. legacy Sync (Keep users table in sync for backward compatibility)
    UPDATE public.users SET 
        membership_status = 'Active',
        membership_expiry = v_new_end_date::date,
        payment_status = 'completed',
        updated_at = NOW()
    WHERE id = v_user_id;

    -- 9. Log Audit
    IF p_admin_id IS NOT NULL THEN
        INSERT INTO public.admin_audit_logs (admin_id, target_user_id, action_type, new_state)
        VALUES (p_admin_id, v_user_id, 'PAYMENT_ACTIVATION', jsonb_build_object('payment_id', p_payment_id, 'tier', v_tier.name));
    END IF;

    RETURN jsonb_build_object('success', true, 'new_expiry', v_new_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
