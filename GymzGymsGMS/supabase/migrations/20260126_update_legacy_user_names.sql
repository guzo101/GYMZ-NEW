-- =====================================================
-- Update Legacy User Names from Emails
-- =====================================================
-- This script updates users who registered before the
-- first_name/last_name feature was implemented.
-- It extracts their first name from their email address.
-- =====================================================

-- Update users with null first_name
UPDATE public.users
SET 
    first_name = INITCAP(SPLIT_PART(SPLIT_PART(email, '@', 1), '.', 1)),
    last_name = CASE 
        WHEN POSITION('.' IN SPLIT_PART(email, '@', 1)) > 0 
        THEN INITCAP(SPLIT_PART(SPLIT_PART(email, '@', 1), '.', 2))
        ELSE NULL
    END,
    name = INITCAP(REPLACE(SPLIT_PART(email, '@', 1), '.', ' '))
WHERE 
    first_name IS NULL 
    AND email IS NOT NULL
    AND email != '';

-- Display updated users count
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM public.users
    WHERE first_name IS NOT NULL AND name IS NOT NULL;
    
    RAISE NOTICE 'Total users with names: %', updated_count;
END $$;

-- =====================================================
-- Example transformations:
-- john.doe@example.com -> John / Doe / John Doe
-- jane@example.com -> Jane / NULL / Jane
-- musam.dev@gmail.com -> Musam / Dev / Musam Dev
-- =====================================================
