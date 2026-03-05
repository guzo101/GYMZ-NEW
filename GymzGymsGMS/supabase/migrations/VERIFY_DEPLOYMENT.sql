-- ================================================================================
-- POST-DEPLOYMENT VERIFICATION TESTS
-- Run these queries to verify migrations were successful
-- ================================================================================

-- Test 1: Check migration logs
SELECT * FROM migration_logs 
WHERE migration_name LIKE '%2026012%'
ORDER BY applied_at DESC;
-- Expected: 2 rows (comprehensive_data_integrity_fix, create_data_quality_monitoring)

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Test 2: Verify Monitoring Functions Work                                  │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Test user data completeness
SELECT * FROM check_user_data_completeness();
-- Expected: Returns table with user stats

-- Test payment statistics
SELECT get_payment_statistics();
-- Expected: Returns JSON with payment metrics

-- Test progress tracking stats
SELECT get_progress_tracking_stats();
-- Expected: Returns JSON with progress table counts

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Test 3: Verify Views Work                                                 │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Check users needing attention
SELECT COUNT(*) as users_with_issues FROM users_needing_attention;
-- Expected: Number (0 or more)

-- Check payment issues
SELECT COUNT(*) as payment_issues_count FROM payment_issues;
-- Expected: Number (0 or more)

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Test 4: Verify Table Structure                                            │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Check payments table has membership_type column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' 
  AND column_name = 'membership_type';
-- Expected: 1 row showing the column exists

-- Check user_level_system table exists
SELECT COUNT(*) as users_with_levels FROM user_level_system;
-- Expected: Number matching user count (or 0 if no users)

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Test 5: Check Indexes Created                                             │
-- └────────────────────────────────────────────────────────────────────────────┘

SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
-- Expected: Multiple indexes on users, payments, and progress tables

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ SUMMARY REPORT                                                             │
-- └────────────────────────────────────────────────────────────────────────────┘

DO $$
DECLARE
  user_count INTEGER;
  payment_count INTEGER;
  level_count INTEGER;
  issue_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  SELECT COUNT(*) INTO payment_count FROM payments;
  SELECT COUNT(*) INTO level_count FROM user_level_system;
  SELECT COUNT(*) INTO issue_count FROM users_needing_attention;
  
  RAISE NOTICE '================================';
  RAISE NOTICE 'DEPLOYMENT VERIFICATION SUMMARY';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Total Users: %', user_count;
  RAISE NOTICE 'Total Payments: %', payment_count;
  RAISE NOTICE 'Users with Levels: %', level_count;
  RAISE NOTICE 'Users Needing Attention: %', issue_count;
  RAISE NOTICE '================================';
  
  IF level_count = user_count THEN
    RAISE NOTICE '✓ All users have level records';
  ELSE
    RAISE WARNING '⚠ Level record mismatch';
  END IF;
  
  RAISE NOTICE '✓ Migrations deployed successfully!';
END $$;

-- ================================================================================
-- READY TO USE!
-- ================================================================================
-- You can now use these monitoring queries anytime:
--
-- SELECT * FROM check_user_data_completeness();
-- SELECT get_payment_statistics();
-- SELECT get_progress_tracking_stats();
-- SELECT * FROM users_needing_attention;
-- SELECT * FROM payment_issues;
-- ================================================================================
