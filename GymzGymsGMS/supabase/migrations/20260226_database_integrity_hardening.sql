-- ============================================================================
-- DATABASE INTEGRITY HARDENING: GLOBAL ON DELETE CASCADE
-- Date: 2026-02-26
-- Purpose: Resolve FK constraint errors preventing user deletion.
-- ============================================================================

BEGIN;

-- 1. ROBUST CASCADE HELPER (Reusable and Idempotent)
CREATE OR REPLACE FUNCTION public.apply_integrity_cascade(
    target_table text, 
    fk_column text, 
    referenced_table text DEFAULT 'public.users'
) RETURNS void AS $$
DECLARE
    constraint_record record;
BEGIN
    -- Skip if table/column missing
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = target_table AND column_name = fk_column) THEN
        RETURN;
    END IF;

    -- Find ALL existing foreign key constraints on this column
    FOR constraint_record IN 
        SELECT conname, confdeltype
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
        WHERE con.contype = 'f' 
          AND con.conrelid = ('public.' || target_table)::regclass 
          AND att.attname = fk_column
    LOOP
        -- If it's already CASCADE (confdeltype = 'c'), we're done for this specific constraint
        IF constraint_record.confdeltype = 'c' THEN
            CONTINUE;
        END IF;

        -- Otherwise, drop it to replace it
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', target_table, constraint_record.conname);
    END LOOP;

    -- Add the CASCADE constraint if it doesn't exist (using standardized naming)
    -- We use a name that won't conflict with legacy ones
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(id) ON DELETE CASCADE', 
                   target_table, 'fk_' || target_table || '_' || fk_column || '_cascade', fk_column, referenced_table);

    RAISE NOTICE 'Integrity Hardened: public.%.% -> %', target_table, fk_column, referenced_table;
END;
$$ LANGUAGE plpgsql;

-- 2. APPLY TO MISSING / RECENT TABLES
-- The specific block reported by the user
SELECT public.apply_integrity_cascade('admin_audit_logs', 'admin_id');
SELECT public.apply_integrity_cascade('admin_audit_logs', 'target_user_id');

-- Metrics & Progress (Ensuring absolute coverage)
SELECT public.apply_integrity_cascade('user_fitness_goals', 'user_id');
SELECT public.apply_integrity_cascade('daily_calorie_summary', 'user_id');
SELECT public.apply_integrity_cascade('xp_transactions', 'user_id');

-- Verify existing from V3 cleanup script (idempotent run)
SELECT public.apply_integrity_cascade('payments', 'user_id');
SELECT public.apply_integrity_cascade('payments', 'member_id');
SELECT public.apply_integrity_cascade('notifications', 'user_id');
SELECT public.apply_integrity_cascade('notifications', 'member_id');

-- 3. CLEANUP ORPHANED DATA BLOCKING MIGRATION (Ghost Protection)
-- If a user was partially deleted in auth.users but remains in public.users, 
-- or if logs exist for non-existent public users, clear them now.
DELETE FROM public.admin_audit_logs WHERE admin_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.admin_audit_logs WHERE target_user_id NOT IN (SELECT id FROM public.users);

-- 4. CLEANUP HELPER
DROP FUNCTION public.apply_integrity_cascade;

COMMIT;

-- Reload Supabase schema cache
NOTIFY pgrst, 'reload schema';
