-- DIAGNOSTIC: Check User ID Integrity
-- Following Absolute Harmony & Data Stewardship rules

SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE gym_id IS NULL) as missing_gym_id,
    COUNT(*) FILTER (WHERE unique_id IS NULL OR unique_id = '') as missing_unique_id,
    COUNT(*) FILTER (WHERE gym_id IS NOT NULL AND (unique_id IS NULL OR unique_id = '')) as missing_id_with_gym
FROM public.users;

-- Check for status casing issues
SELECT 
    membership_status, 
    COUNT(*) 
FROM public.users 
GROUP BY membership_status;
