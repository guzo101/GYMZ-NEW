-- Migration: Add Health Metrics Columns
-- Date: 2026-02-07
-- Purpose: Add missing columns for health metrics onboarding

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS goal TEXT,
ADD COLUMN IF NOT EXISTS recommended_weight DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS goal_timeframe TEXT;

-- Add comments for documentation
COMMENT ON COLUMN users.goal IS 'User fitness goal (lose_weight, build_muscle, recomp, endurance)';
COMMENT ON COLUMN users.recommended_weight IS 'AI-recommended ideal weight in kg based on BMI';
COMMENT ON COLUMN users.goal_timeframe IS 'Estimated timeframe to reach goal (e.g., "3 months")';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');

DO $$ 
BEGIN 
    RAISE NOTICE 'Health metrics columns added successfully.';
END $$;
