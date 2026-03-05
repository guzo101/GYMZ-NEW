-- Migration: Fix Sync Engine - Add Primary Objective & Ensure RLS
-- Date: 2026-02-07
-- Purpose: Add missing primary_objective column and ensure other health columns exist for Sync Engine to work.

-- 1. Add missing columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS primary_objective TEXT,
ADD COLUMN IF NOT EXISTS goal TEXT,
ADD COLUMN IF NOT EXISTS recommended_weight DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS goal_timeframe TEXT,
ADD COLUMN IF NOT EXISTS height DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS target_weight DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS gender TEXT;

-- 2. Add comments
COMMENT ON COLUMN users.primary_objective IS 'Primary fitness objective (redundant with goal but used in code)';
COMMENT ON COLUMN users.goal IS 'User fitness goal (lose_weight, build_muscle, recomp, endurance)';
COMMENT ON COLUMN users.recommended_weight IS 'AI-recommended ideal weight in kg based on BMI';
COMMENT ON COLUMN users.goal_timeframe IS 'Estimated timeframe to reach goal';

-- 3. Ensure RLS Policy exists for updates (Idempotent)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' AND policyname = 'table_users_update_self'
    ) THEN
        CREATE POLICY "table_users_update_self" ON public.users 
        FOR UPDATE USING (auth.uid() = id);
    END IF;
END $$;

-- 4. Reload schema
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
