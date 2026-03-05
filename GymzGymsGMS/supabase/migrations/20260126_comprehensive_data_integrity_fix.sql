-- ================================================================================
-- COMPREHENSIVE DATA INTEGRITY FIX MIGRATION
-- Generated: 2026-01-26
-- Purpose: Fix all identified data integrity issues from system audit
-- ================================================================================

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 1: Add Missing membership_type Column to Payments Table               │
-- └────────────────────────────────────────────────────────────────────────────┘

DO $$ 
BEGIN
  -- 1. Ensure column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'membership_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN membership_type TEXT;
    RAISE NOTICE 'Added membership_type column to payments table';
  END IF;

  -- 2. Drop existing constraint if it exists (allows us to update the list of valid types)
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'payments' AND column_name = 'membership_type' 
    AND constraint_name = 'payments_membership_type_check'
  ) THEN
    ALTER TABLE payments DROP CONSTRAINT payments_membership_type_check;
  END IF;

  -- 3. Apply expanded constraint
  ALTER TABLE payments ADD CONSTRAINT payments_membership_type_check 
    CHECK (membership_type IN ('Day Pass', 'Basic', 'Family', 'Student', 'Monthly', 'Yearly', 'Executive'));
    
  RAISE NOTICE 'Updated membership_type check constraint';
END $$;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 13: Backfill membership_type based on description/amount               │
-- └────────────────────────────────────────────────────────────────────────────┘

UPDATE payments
SET membership_type = CASE
  -- Priority: Match explicit descriptions
  WHEN description ILIKE '%Day Pass%' OR description ILIKE '%daily%' OR amount <= 50 THEN 'Day Pass'
  WHEN description ILIKE '%Family%' OR amount >= 2000 THEN 'Family'
  WHEN description ILIKE '%Student%' THEN 'Student'
  WHEN description ILIKE '%Executive%' THEN 'Executive'
  -- Broad catch for Basic
  WHEN description ILIKE '%Basic%' OR description ILIKE '%Monthly%' OR description ILIKE '%Yearly%' OR amount >= 500 THEN 'Basic'
  ELSE 'Basic'
END
WHERE membership_type IS NULL OR membership_type = '' OR membership_type = 'unknown';

-- Force status synchronization for graph visibility
UPDATE payments
SET payment_status = status
WHERE payment_status IS NULL OR payment_status != status;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 2: Backfill Missing User Data (unique_id, name)                       │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Ensure all users have unique_id
UPDATE users 
SET unique_id = (
  (floor(random() * 9000 + 1000)::text) || 
  (ARRAY['!','@','#','$','%','^','&','*'])[floor(random() * 8 + 1)]
)
WHERE unique_id IS NULL;

-- Ensure all users have a name (fallback to email prefix)
UPDATE users
SET name = split_part(email, '@', 1)
WHERE name IS NULL AND email IS NOT NULL;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 3: Update Expired Membership Status                                   │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Mark active memberships as Inactive if expired
UPDATE users
SET 
  membership_status = 'Inactive',
  updated_at = NOW()
WHERE membership_status = 'Active'
  AND membership_expiry IS NOT NULL
  AND membership_expiry < CURRENT_DATE;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 4: Initialize User Level System for All Active Users                  │
-- └────────────────────────────────────────────────────────────────────────────┘

-- First ensure the table exists
CREATE TABLE IF NOT EXISTS user_level_system (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_level INTEGER DEFAULT 1,
  current_xp INTEGER DEFAULT 0,
  total_xp INTEGER DEFAULT 0,
  xp_to_next_level INTEGER DEFAULT 100,
  level_title TEXT DEFAULT 'Beginner',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS if not already enabled
ALTER TABLE user_level_system ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_level_system' AND policyname = 'Users can view own level'
  ) THEN
    CREATE POLICY "Users can view own level" ON user_level_system FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_level_system' AND policyname = 'Users can update own level'
  ) THEN
    CREATE POLICY "Users can update own level" ON user_level_system FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create level records for users without one
INSERT INTO user_level_system (
  user_id,
  current_level,
  current_xp,
  total_xp,
  xp_to_next_level,
  level_title,
  created_at,
  updated_at
)
SELECT 
  u.id,
  1 as current_level,
  0 as current_xp,
  0 as total_xp,
  100 as xp_to_next_level,
  'Beginner' as level_title,
  NOW() as created_at,
  NOW() as updated_at
FROM users u
LEFT JOIN user_level_system uls ON u.id = uls.user_id
WHERE uls.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 5: Remove Orphaned Payment Records                                     │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Delete payments with no matching user (orphaned records)
DELETE FROM payments p
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = p.user_id
);

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 6: Normalize Payment Status Field                                     │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Normalize status values (some may be lowercase, mixed case, etc)
UPDATE payments
SET status = CASE 
  WHEN LOWER(status) IN ('approved', 'paid', 'completed') THEN 'Approved'
  WHEN LOWER(status) IN ('rejected', 'cancelled', 'failed') THEN 'Rejected'
  WHEN LOWER(status) IN ('pending', 'pending_approval') THEN 'Pending'
  ELSE COALESCE(status, 'Pending')
END
WHERE status IS NULL 
   OR status NOT IN ('Approved', 'Rejected', 'Pending');

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 7: Add paid_at Timestamp for Approved Payments Missing It             │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Set paid_at to approved_at or NOW() if missing for approved payments
UPDATE payments
SET paid_at = COALESCE(approved_at, NOW())
WHERE status = 'Approved' AND paid_at IS NULL;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 8: Initialize Achievement Badges (if not already seeded)              │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Check if badges exist, if table exists
DO $$
DECLARE
  badge_count INTEGER;
  table_exists BOOLEAN;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'achievement_badges'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT COUNT(*) INTO badge_count FROM achievement_badges;
    
    IF badge_count = 0 THEN
      RAISE NOTICE 'No achievement badges found. Please run: 20260113_seed_achievement_badges.sql';
    ELSE
      RAISE NOTICE 'Found % achievement badges', badge_count;
    END IF;
  ELSE
    RAISE NOTICE 'achievement_badges table does not exist. Please run: 20260113_create_progress_tracking_tables.sql';
  END IF;
END $$;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 9: Ensure Proper Indexes for Performance                              │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Users table indexes (always exists)
CREATE INDEX IF NOT EXISTS idx_users_membership_status ON users(membership_status);
CREATE INDEX IF NOT EXISTS idx_users_membership_expiry ON users(membership_expiry);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Payments table indexes (check if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
    CREATE INDEX IF NOT EXISTS idx_payments_membership_type ON payments(membership_type);
    CREATE INDEX IF NOT EXISTS idx_payments_approved_at ON payments(approved_at);
  END IF;
END $$;

-- Progress tracking indexes (only if tables exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'body_metrics') THEN
    CREATE INDEX IF NOT EXISTS idx_body_metrics_date ON body_metrics(date DESC);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_nutrition_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_nutrition_logs_date ON daily_nutrition_logs(logged_at DESC);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'water_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_water_logs_date ON water_logs(date DESC);
  END IF;
END $$;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 11: Ensure created_at exists in Payments table                         │
-- └────────────────────────────────────────────────────────────────────────────┘

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE 'Added created_at column to payments table';
  END IF;
END $$;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 12: Sync payment_status with status field                              │
-- └────────────────────────────────────────────────────────────────────────────┘

-- If payment_status is missing, add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_status TEXT;
  END IF;
END $$;

-- Sync the two status columns to ensure UI consistency
UPDATE payments
SET payment_status = status
WHERE payment_status IS NULL OR payment_status != status;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ FIX 10: Validate and Log Completion                                       │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Create a migration log table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'SUCCESS',
  notes TEXT
);

-- Log this migration
INSERT INTO migration_logs (migration_name, status, notes)
VALUES (
  'comprehensive_data_integrity_fix',
  'SUCCESS',
  'Fixed membership_type column, backfilled user data, updated expired memberships, initialized levels, removed orphaned records'
);

-- Display summary
DO $$
DECLARE
  total_users INTEGER;
  active_members INTEGER;
  total_payments INTEGER;
  approved_payments INTEGER;
  users_with_levels INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO active_members FROM users WHERE membership_status = 'Active';
  SELECT COUNT(*) INTO total_payments FROM payments;
  SELECT COUNT(*) INTO approved_payments FROM payments WHERE status = 'Approved';
  SELECT COUNT(*) INTO users_with_levels FROM user_level_system;
  
  RAISE NOTICE '================================';
  RAISE NOTICE 'DATA INTEGRITY FIX COMPLETE';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Total Users: %', total_users;
  RAISE NOTICE 'Active Members: %', active_members;
  RAISE NOTICE 'Total Payments: %', total_payments;
  RAISE NOTICE 'Approved Payments: %', approved_payments;
  RAISE NOTICE 'Users with Levels: %', users_with_levels;
  RAISE NOTICE '================================';
END $$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
