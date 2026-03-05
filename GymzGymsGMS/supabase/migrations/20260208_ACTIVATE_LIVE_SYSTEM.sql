-- ============================================================================
-- GLOBAL ACTIVATION: WAKING UP THE NEURAL NETWORK
-- Run this in Supabase SQL Editor to calculate targets for all existing users.
-- ============================================================================

-- 1. Force a "touch" on all user profiles that have basic stats.
-- This will fire the 'trg_users_recalculate_nutrition' trigger.
UPDATE public.users 
SET updated_at = NOW() 
WHERE 
    weight IS NOT NULL 
    AND height IS NOT NULL 
    AND age IS NOT NULL;

-- 2. Verify that targets were created
SELECT 
    u.name, 
    u.weight, 
    g.daily_calorie_goal, 
    g.daily_protein_goal
FROM public.users u
JOIN public.user_fitness_goals g ON u.id = g.user_id
WHERE g.is_active = TRUE
LIMIT 10;
