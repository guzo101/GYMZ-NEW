-- Relax Constraints on membership_status
-- This script removes any CHECK constraints that might be blocking the 'New' status.

-- 1. Try to drop the common constraint name if it exists
DO $$ 
BEGIN
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_membership_status_check;
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS membership_status_check;
EXCEPTION
    WHEN undefined_object THEN 
        RAISE NOTICE 'Constraint did not exist, skipping drop.';
END $$;

-- 2. Add a new constraint that EXPLICITLY allows 'New' and 'Inactive'
--    This ensures data integrity while allowing our new status.
ALTER TABLE public.users
ADD CONSTRAINT users_membership_status_check 
CHECK (membership_status IN (
    'New', 
    'Pending', 
    'Active', 
    'Inactive',
    'Expired', 
    'Cancelled', 
    'Suspended', 
    'Rejected'
));

-- 3. Re-apply the default to be safe
ALTER TABLE public.users ALTER COLUMN membership_status SET DEFAULT 'New';
