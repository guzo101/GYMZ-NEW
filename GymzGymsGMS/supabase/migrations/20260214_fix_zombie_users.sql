-- =================================================================
-- FIX ZOMBIE USER STATUSES
-- Issue: Some users have valid ACTIVE subscriptions but their user.membership_status 
-- is stuck in "Rejected" or "Pending" due to failed top-ups or legacy logic.
-- This script synchronizes the user status with the subscription truth.
-- =================================================================

BEGIN;

-- 1. Identify and Log Affected Users (for audit trail in messages)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT u.id, u.email, u.membership_status, s.ends_at
        FROM public.users u
        JOIN public.subscriptions s ON u.id = s.user_id
        WHERE s.status = 'active' 
          AND s.ends_at > NOW()
          AND u.membership_status NOT IN ('Active', 'active') -- Catch any non-active status
    LOOP
        RAISE NOTICE 'Fixing user % (%) - Status was "%", resetting to Active (Sub ends: %)', r.email, r.id, r.membership_status, r.ends_at;
    END LOOP;
END $$;

-- 2. Perform the Update
UPDATE public.users u
SET 
    membership_status = 'Active',
    updated_at = NOW()
FROM public.subscriptions s
WHERE u.id = s.user_id
  AND s.status = 'active'
  AND s.ends_at > NOW()
  AND u.membership_status NOT IN ('Active', 'active');

COMMIT;

-- 3. Force Schema Reload (optional, mainly for API cache clearing)
NOTIFY pgrst, 'reload schema';
