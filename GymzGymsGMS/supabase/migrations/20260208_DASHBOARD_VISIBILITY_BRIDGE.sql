-- ============================================================================
-- DASHBOARD VISIBILITY BRIDGE (CLEAN SYNC)
-- Purpose: 
-- 1. Ensure the app (Authenticated User) has full SELECT permission.
-- 2. Repair any active-goal conflicts.
-- 3. Force a complete data sync for the current user.
-- ============================================================================

BEGIN;

-- 1. SECURITY: Force-Repair RLS Permissions
-- Ensure the 'authenticated' role (the Mobile App) can actually see the goals.
DROP POLICY IF EXISTS "Users can view own goals" ON public.user_fitness_goals;
CREATE POLICY "Users can view own goals" 
ON public.user_fitness_goals 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Ensure the trigger (which might run as the user) can also update/insert.
DROP POLICY IF EXISTS "Users can insert own goals" ON public.user_fitness_goals;
CREATE POLICY "Users can insert own goals" ON public.user_fitness_goals FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can update own goals" ON public.user_fitness_goals;
CREATE POLICY "Users can update own goals" ON public.user_fitness_goals FOR UPDATE USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- 2. DATA ALIGNMENT: The "Single Active Goal" Contract
-- Deactivate any rogue old goals and keep only the newest one per user.
WITH latest_goals AS (
    SELECT id, ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY updated_at DESC) as r
    FROM public.user_fitness_goals
    WHERE is_active = true
)
UPDATE public.user_fitness_goals
SET is_active = false
WHERE id IN (SELECT id FROM latest_goals WHERE r > 1);

-- 3. TRIGGER SPARK: Final Refresh
UPDATE public.users SET updated_at = NOW() WHERE weight IS NOT NULL;

COMMIT;

-- Force Cache Clear
NOTIFY pgrst, 'reload schema';
