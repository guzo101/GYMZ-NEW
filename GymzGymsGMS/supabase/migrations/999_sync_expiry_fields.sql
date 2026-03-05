-- CONSOLIDATE EXPIRY FIELDS MIGRATION
-- This ensures that membership_expiry and renewal_due_date are synced
-- to prevent accidental deactivations.

-- 1. Sync renewal_due_date from membership_expiry where renewal_due_date is NULL
UPDATE public.users 
SET renewal_due_date = membership_expiry
WHERE role = 'member' 
AND renewal_due_date IS NULL 
AND membership_expiry IS NOT NULL;

-- 2. Sync membership_expiry from renewal_due_date where membership_expiry is NULL
-- (For backward compatibility with scripts that still use membership_expiry)
UPDATE public.users 
SET membership_expiry = renewal_due_date
WHERE role = 'member' 
AND membership_expiry IS NULL 
AND renewal_due_date IS NOT NULL;

-- 3. If both exist and differ, prioritize renewal_due_date (as it's often updated by GMS UI)
UPDATE public.users 
SET membership_expiry = renewal_due_date
WHERE role = 'member' 
AND renewal_due_date IS NOT NULL 
AND membership_expiry IS NOT NULL 
AND renewal_due_date != membership_expiry;

-- 4. Re-grant permissions
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

DO $$ 
BEGIN 
    RAISE NOTICE 'Expiry field consolidation completed.';
END $$;
