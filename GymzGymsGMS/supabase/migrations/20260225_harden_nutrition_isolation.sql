-- ============================================================================
-- GYMZ SECURITY HARDENING: NUTRITION & SNAPSHOT ISOLATION
-- Date: 2026-02-25
-- ============================================================================

BEGIN;

-- ─── 1. EXTEND NUTRITION TABLES ─────────────────────────────────────────────

ALTER TABLE public.daily_nutrition_logs ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id);
ALTER TABLE public.meal_scans ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id);

-- Backfill gym_id from users table
UPDATE public.daily_nutrition_logs dnl
SET gym_id = u.gym_id
FROM public.users u
WHERE dnl.user_id = u.id
AND dnl.gym_id IS NULL;

UPDATE public.meal_scans ms
SET gym_id = u.gym_id
FROM public.users u
WHERE ms.user_id = u.id
AND ms.gym_id IS NULL;

-- ─── 2. REFACTORED NUTRITION RLS (GYM-AWARE) ────────────────────────────────

DROP POLICY IF EXISTS "Admins can view member nutrition logs" ON public.daily_nutrition_logs;
CREATE POLICY "Admins can view member nutrition logs"
ON public.daily_nutrition_logs FOR SELECT
USING (public.is_gym_admin(gym_id));

DROP POLICY IF EXISTS "Admins can view member meal scans" ON public.meal_scans;
CREATE POLICY "Admins can view member meal scans"
ON public.meal_scans FOR SELECT
USING (public.is_gym_admin(gym_id));

-- Ensure members can still see their own data regardless of gym context
-- (In case they are moving between gyms, though currently it's one gym_id per user record)
DROP POLICY IF EXISTS "Users can view own nutrition logs" ON public.daily_nutrition_logs;
CREATE POLICY "Users can view own nutrition logs" 
ON public.daily_nutrition_logs FOR SELECT 
USING (auth.uid() = user_id);

-- ─── 3. SNAPSHOTS ISOLATION ──────────────────────────────────────────────────

ALTER TABLE public.user_snapshots ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id);

UPDATE public.user_snapshots us
SET gym_id = u.gym_id
FROM public.users u
WHERE us.user_id = u.id
AND us.gym_id IS NULL;

DROP POLICY IF EXISTS "Gym admins view their gym snapshots" ON public.user_snapshots;
CREATE POLICY "Gym admins view their gym snapshots"
ON public.user_snapshots FOR SELECT
USING (public.is_gym_admin(gym_id));

COMMIT;

NOTIFY pgrst, 'reload schema';
