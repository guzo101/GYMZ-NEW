-- ============================================================================
-- CALORIE GAP DIAGNOSTIC: FINDING THE BLOCKED METRICS
-- Purpose: 
-- 1. Identify why the World-Class Engine didn't calculate calories.
-- 2. Check for missing Age, Gender, or Weight data.
-- 3. Verify if the recommendations are stuck in the database.
-- ============================================================================

SELECT 
    id, 
    email,
    weight, 
    height, 
    age, 
    gender, 
    workout_intensity,
    calculated_bmi,
    calculated_bmr,
    calculated_tdee,
    (SELECT count(*) FROM public.user_fitness_goals WHERE user_id = public.users.id AND is_active = true) as goals_found
FROM public.users
WHERE email IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;

-- Check for any recent engine errors
-- Note: This requires access to the warning logs, but usually we look at the profile results.
