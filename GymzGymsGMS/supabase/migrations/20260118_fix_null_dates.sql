-- FIX 1: Set Last Payment Date from actual Payment History
UPDATE public.users u
SET last_payment_date = (
    SELECT MAX(paid_at) 
    FROM public.payments p 
    WHERE p.user_id = u.id AND p.status IN ('completed', 'approved')
)
WHERE u.last_payment_date IS NULL;

-- FIX 2: Set Renewal Date for DAY PASS users (1 Day from payment)
UPDATE public.users u
SET renewal_due_date = (u.last_payment_date + INTERVAL '1 day')::date
WHERE u.renewal_due_date IS NULL
AND u.last_payment_date IS NOT NULL
AND (u.membership_type ILIKE '%day%' OR u.membership_type ILIKE '%daily%');

-- FIX 3: Set Renewal Date for MONTHLY users (1 Month from payment - Default)
UPDATE public.users u
SET renewal_due_date = (u.last_payment_date + INTERVAL '1 month')::date
WHERE u.renewal_due_date IS NULL
AND u.last_payment_date IS NOT NULL
AND (u.membership_type NOT ILIKE '%day%' AND u.membership_type NOT ILIKE '%daily%');

-- FIX 4: Ensure Membership Expiry matches Renewal Due Date
UPDATE public.users u
SET membership_expiry = u.renewal_due_date
WHERE u.membership_expiry IS NULL
AND u.renewal_due_date IS NOT NULL;
