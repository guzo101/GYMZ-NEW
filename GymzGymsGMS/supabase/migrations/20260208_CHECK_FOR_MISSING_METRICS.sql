-- ============================================================================
-- WORLD-CLASS DIAGNOSTIC: THE "MISSING METRIC" HUNTER
-- Purpose: 
-- 1. Identify which specific metric is blocking the Calorie Engine.
-- 2. Verify if the database is actually saving your metrics.
-- ============================================================================

SELECT 
    email,
    CASE WHEN weight IS NULL THEN '❌ MISSING' ELSE '✅ ' || weight || 'kg' END as weight_status,
    CASE WHEN height IS NULL THEN '❌ MISSING' ELSE '✅ ' || height || 'cm' END as height_status,
    CASE WHEN age IS NULL THEN '❌ MISSING' ELSE '✅ ' || age || ' yrs' END as age_status,
    CASE WHEN gender IS NULL THEN '❌ MISSING' ELSE '✅ ' || gender END as gender_status,
    CASE WHEN calculated_tdee IS NULL THEN '🛑 ENGINE BLOCKED' ELSE '🚀 ACTIVE: ' || calculated_tdee || ' kcal' END as engine_status,
    (SELECT count(*) FROM public.user_fitness_goals WHERE user_id = public.users.id AND is_active = true) as goals_in_db
FROM public.users
WHERE email IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;
