-- MIGRATION: RESET ALL PAYMENTS AND MEMBERSHIP STATUSES
-- DATE: 2026-01-20
-- PURPOSE: "Start afresh" - Delete all payment history and reset user memberships.

BEGIN;

-- 1. Delete all payments
-- Using TRUNCATE with CASCADE to handle foreign keys (like notifications.payment_id)
TRUNCATE TABLE public.payments CASCADE;

-- 2. Reset user membership details
-- We exclude admins to prevent accidental lockout, though admins usually bypass checks.
-- We reset all membership-related fields to their initial/empty state.
UPDATE public.users
SET 
    membership_status = 'Pending',
    status = 'Pending',            -- Resets their main status so they must pay/activate again
    membership_expiry = NULL,
    renewal_due_date = NULL,
    last_payment_date = NULL,
    subscription_duration_months = NULL,
    membership_type = NULL,
    updated_at = NOW()
WHERE 
    role IS DISTINCT FROM 'admin'  -- Protect admin accounts
    AND email NOT IN ('admin@Gymz.com'); -- Extra safety check

-- 3. Verify (Optional logging)
DO $$
DECLARE
    v_payment_count integer;
    v_active_users integer;
BEGIN
    SELECT count(*) INTO v_payment_count FROM public.payments;
    SELECT count(*) INTO v_active_users FROM public.users WHERE membership_status = 'Active' AND role IS DISTINCT FROM 'admin';
    
    RAISE NOTICE 'Reset Complete. Remaining Payments: %, Remaining Active Users: %', v_payment_count, v_active_users;
END $$;

COMMIT;
