-- ============================================================================
-- FINAL NEURAL SPARK: FORCING THE ACTIVATION
-- Purpose: 
-- 1. Make the trigger more inclusive (fire on ANY profile update)
-- 2. Force a backfill that actually touches the weight column
-- ============================================================================

BEGIN;

-- 1. LIBERAL TRIGGER: Fire on any significant update or sync
DROP TRIGGER IF EXISTS trg_users_recalculate_nutrition ON public.users;
CREATE TRIGGER trg_users_recalculate_nutrition
AFTER UPDATE ON public.users -- Removed the "OF" restrictions to ensure it fires on any sync
FOR EACH ROW EXECUTE FUNCTION public.fn_recalculate_user_nutrition();

-- 2. FORCED BACKFILL: Touch the updated_at column to trigger recalculation
-- This ensures the system "wakes up" for users who ALREADY have their own data.
UPDATE public.users 
SET updated_at = NOW()
WHERE weight IS NOT NULL 
   OR height IS NOT NULL 
   OR age IS NOT NULL;

COMMIT;

-- Ensure schema cache is cleared
NOTIFY pgrst, 'reload schema';
