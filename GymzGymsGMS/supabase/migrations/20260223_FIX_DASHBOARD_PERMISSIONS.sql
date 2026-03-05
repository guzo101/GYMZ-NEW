-- =====================================================
-- FIX: DASHBOARD DATA VISIBILITY & RPC PERMISSIONS
-- Date: 2026-02-23
-- =====================================================

BEGIN;

-- 1. Grant EXECUTE on the main Dashboard RPC
-- Without this, the app (running as 'authenticated') cannot call the function.
GRANT EXECUTE ON FUNCTION public.get_unified_app_data(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_app_data(UUID, DATE) TO service_role;

-- 2. Explicitly ensure SELECT access to nutrition and metrics tables
-- While the RPC is SECURITY DEFINER, direct fetches in DashboardScreen.tsx 
-- (like nutritionService.getMacroTargets) need RLS/Grants.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- 3. Verify user_fitness_goals RLS
DROP POLICY IF EXISTS "Users can view own goals" ON public.user_fitness_goals;
CREATE POLICY "Users can view own goals" 
ON public.user_fitness_goals 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 4. Force a schema cache reload for PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
