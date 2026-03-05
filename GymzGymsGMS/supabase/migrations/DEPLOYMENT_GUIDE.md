# Migration Deployment Guide

## ✅ Fixes Applied

Both migration files have been corrected:

### Fix 1: `20260126_comprehensive_data_integrity_fix.sql`
**Error Fixed**: `relation "user_level_system" does not exist`

**Solution**: Added table creation with RLS policies before attempting insert
- Now creates the `user_level_system` table if it doesn't exist
- Sets up proper RLS policies
- Then safely inserts level records for all users

### Fix 2: `20260126_create_data_quality_monitoring.sql`  
**Error Fixed**: `syntax error at or near "RAISE"`

**Solution**: Wrapped standalone RAISE NOTICE in DO block
```sql
DO $$
BEGIN
  RAISE NOTICE 'Data quality monitoring system created successfully';
END $$;
```

---

## 🚀 How to Deploy

### Option 1: Via Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to your project: https://app.supabase.com
   - Navigate to: SQL Editor

2. **Run Migration 1**
   ```sql
   -- Copy/paste entire content of:
   -- 20260126_comprehensive_data_integrity_fix.sql
   ```
   - Click "Run"
   - Wait for success message

3. **Run Migration 2**
   ```sql
   -- Copy/paste entire content of:
   -- 20260126_create_data_quality_monitoring.sql
   ```
   - Click "Run"
   - Wait for success message

4. **Verify Installation**
   ```sql
   -- Test monitoring functions
   SELECT * FROM check_user_data_completeness();
   SELECT get_payment_statistics();
   SELECT get_progress_tracking_stats();
   ```

### Option 2: Via Supabase CLI

```bash
cd "Gymz GMS"

# Apply migrations
supabase db push

# Or apply specific migrations
psql $DATABASE_URL -f supabase/migrations/20260126_comprehensive_data_integrity_fix.sql
psql $DATABASE_URL -f supabase/migrations/20260126_create_data_quality_monitoring.sql
```

### Option 3: All-in-One Runner

```bash
# Use the combined runner (if \i commands work in your environment)
psql $DATABASE_URL -f supabase/migrations/20260126_run_all_fixes.sql
```

---

## 🔍 What Each Migration Does

### Migration 1: Data Integrity Fix

✅ Adds missing `membership_type` column to payments table  
✅ Backfills user `unique_id` and `name` fields  
✅ Updates expired active memberships to Inactive  
✅ Creates `user_level_system` table if missing  
✅ Initializes levels for all users  
✅ Removes orphaned payment records  
✅ Syncs payment status fields  
✅ Adds missing payment timestamps  
✅ Creates performance indexes  
✅ Logs migration execution

### Migration 2: Monitoring System

✅ Creates 6 monitoring functions:
- `check_user_data_completeness()` - User profile stats
- `get_payment_statistics()` - Payment metrics  
- `find_expired_active_memberships()` - Expiry issues
- `get_progress_tracking_stats()` - Progress table stats
- `check_referential_integrity()` - Orphaned records check
- `daily_data_quality_check()` - Automated daily check

✅ Creates 2 monitoring views:
- `users_needing_attention` - Users with issues
- `payment_issues` - Problematic payments

✅ Creates `migration_logs` table for tracking

---

## ✅ Post-Deployment Verification

Run these queries to confirm everything worked:

```sql
-- 1. Check users table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('unique_id', 'name', 'membership_status');

-- 2. Check payments table structure  
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name = 'membership_type';

-- 3. Verify user_level_system exists
SELECT COUNT(*) as users_with_levels FROM user_level_system;

-- 4. Test monitoring functions
SELECT * FROM check_user_data_completeness();

-- 5. Check migration logs
SELECT * FROM migration_logs 
WHERE migration_name LIKE '%2026012 6%'
ORDER BY applied_at DESC;
```

**Expected Results**:
- ✅ `unique_id` and `name` columns exist in users table
- ✅ `membership_type` column exists in payments table
- ✅ `user_level_system` table exists with user records
- ✅ Monitoring functions return data (not errors)
- ✅ 2 migration log entries created

---

## 🎯 Using the Monitoring System

### Check Overall Data Quality

```sql
-- User data health
SELECT * FROM check_user_data_completeness();

-- Payment health
SELECT get_payment_statistics();

-- Progress tracking usage
SELECT get_progress_tracking_stats();
```

### Find Specific Issues

```sql
-- Users needing attention (incomplete data)
SELECT * FROM users_needing_attention;

-- Payments with issues
SELECT * FROM payment_issues;

-- Expired active memberships
SELECT * FROM find_expired_active_memberships();

-- Orphaned records
SELECT check_referential_integrity();
```

### Trigger Manual Quality Check

```sql
-- Send notifications to admins about any issues
SELECT daily_data_quality_check();

-- Then check notifications table
SELECT * FROM notifications 
WHERE type IN ('warning', 'error')
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## 🔧 Troubleshooting

### If Migration 1 Fails

**Error**: "column already exists"
- ✅ Safe to ignore - migration uses `IF NOT EXISTS` checks

**Error**: "permission denied"
- ❌ Need to run as database owner or with sufficient privileges
- Try running via Supabase dashboard as admin

**Error**: "foreign key violation"
- ❌ There may be orphaned records
- Run the orphaned records cleanup queries first

### If Migration 2 Fails

**Error**: "function already exists"
- ✅ Safe - script uses `CREATE OR REPLACE FUNCTION`

**Error**: "table migration_logs does not exist"
- The script creates it, but if there's a failure before that point:
```sql
CREATE TABLE migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'SUCCESS',
  notes TEXT
);
```

---

## 📞 Next Steps After Deployment

1. **Verify all users have complete data**
   ```sql
   SELECT COUNT(*) FROM users WHERE unique_id IS NULL OR name IS NULL;
   -- Should return 0
   ```

2. **Check for any remaining issues**
   ```sql
   SELECT * FROM users_needing_attention;
   SELECT * FROM payment_issues;
   -- Review and fix any remaining records
   ```

3. **Schedule daily monitoring** (optional)
   - Set up a cron job or Supabase function scheduler
   - Call `daily_data_quality_check()` once per day

4. **Update TypeScript types**
   ```bash
   cd "Gymz GMS"
   supabase gen types typescript --local > src/integrations/supabase/types.ts
   ```

5. **Test critical workflows**
   - Create a test user
   - Submit a test payment
   - Verify membership activation works
   - Check progress tracking data can be added

---

## ✨ Success Indicators

After successful deployment, you should see:

- ✅ All users have `unique_id` and `name`
- ✅ All users have a `user_level_system` record
- ✅ `payments` table has `membership_type` column
- ✅ No expired active memberships
- ✅ No orphaned payment records
- ✅ 6 monitoring functions callable
- ✅ 2 monitoring views queryable
- ✅ Migration logs show SUCCESS status

**You now have a robust data integrity system with ongoing monitoring!**
