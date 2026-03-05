-- ============================================================================
-- DATA SWEEP: PURGE ORPHANED NOTIFICATIONS & LOGS
-- Date: 2026-02-22
-- Purpose: Clean up persistent admin notifications and orphaned data after 
-- membership purges.
-- ============================================================================

BEGIN;

-- 1. CLEANUP ORPHANED NOTIFICATIONS
-- Delete notifications belonging to non-existent users
DELETE FROM public.notifications 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM public.users);

-- Delete admin notifications (user_id IS NULL) that refer to old test names
-- Specifically "jane like" mentioned by the user
DELETE FROM public.notifications 
WHERE user_id IS NULL 
AND (
    message ILIKE '%jane like%' 
    OR message ILIKE '%test%'
);

-- Delete ALL admin notifications older than 48 hours to clear the backlog
DELETE FROM public.notifications 
WHERE user_id IS NULL 
AND created_at < NOW() - INTERVAL '2 days';

-- 2. CLEANUP ORPHANED AUDIT LOGS
DELETE FROM public.admin_audit_logs 
WHERE actor_id IS NOT NULL 
AND actor_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.admin_audit_logs 
WHERE target_user_id IS NOT NULL 
AND target_user_id NOT IN (SELECT id FROM public.users);

-- 3. CLEANUP ORPHANED PAYMENTS & LEDGER
DELETE FROM public.payments 
WHERE (user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users))
   OR (member_id IS NOT NULL AND member_id NOT IN (SELECT id FROM public.users));

DELETE FROM public.ledger_entries 
WHERE user_id NOT IN (SELECT id FROM public.users);

-- 4. CLEANUP NUTRITION & HEALTH ORPHANS
DELETE FROM public.daily_nutrition_logs 
WHERE user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.meal_scans 
WHERE user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.water_logs 
WHERE user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.body_metrics 
WHERE user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.user_fitness_goals 
WHERE user_id NOT IN (SELECT id FROM public.users);

-- 5. ENSURE FUTURE INTEGRITY (Add Cascade if missing)
-- Water logs was missing CASCADE in one version
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'water_logs_user_id_fkey') THEN
        ALTER TABLE public.water_logs DROP CONSTRAINT water_logs_user_id_fkey;
        ALTER TABLE public.water_logs ADD CONSTRAINT water_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;

-- Reload Supabase schema cache
NOTIFY pgrst, 'reload schema';
