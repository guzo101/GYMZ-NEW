-- ================================================================================
-- MIGRATION RUNNER - Deploy Both Fixes in Correct Order
-- Run this file in Supabase SQL Editor
-- ================================================================================

-- Step 1: Run comprehensive data integrity fix
\i 20260126_comprehensive_data_integrity_fix.sql

-- Step 2: Run data quality monitoring system
\i 20260126_create_data_quality_monitoring.sql

-- Step 3: Verify installation
DO $$
DECLARE
  total_users INTEGER;
  users_with_levels INTEGER;
  monitoring_functions INTEGER;
BEGIN
  -- Count users
  SELECT COUNT(*) INTO total_users FROM users;
  
  -- Count users with levels
  SELECT COUNT(*) INTO users_with_levels FROM user_level_system;
  
  -- Count monitoring functions
  SELECT COUNT(*) INTO monitoring_functions 
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname IN (
      'check_user_data_completeness',
      'get_payment_statistics',
      'find_expired_active_memberships',
      'get_progress_tracking_stats',
      'check_referential_integrity',
      'daily_data_quality_check'
    );
  
  RAISE NOTICE '================================';
  RAISE NOTICE 'MIGRATION VERIFICATION';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Total Users: %', total_users;
  RAISE NOTICE 'Users with Levels: %', users_with_levels;
  RAISE NOTICE 'Monitoring Functions: %/6', monitoring_functions;
  RAISE NOTICE '================================';
  
  IF monitoring_functions = 6 THEN
    RAISE NOTICE '✓ All migrations successful!';
  ELSE
    RAISE WARNING '⚠ Some monitoring functions may not have been created';
  END IF;
END $$;

-- Test monitoring functions
SELECT 'Testing: check_user_data_completeness()' as test;
SELECT * FROM check_user_data_completeness();

SELECT 'Testing: get_payment_statistics()' as test;
SELECT get_payment_statistics();

SELECT 'Testing: get_progress_tracking_stats()' as test;
SELECT get_progress_tracking_stats();

-- Show any users needing attention
SELECT 'Users Needing Attention:' as info;
SELECT * FROM users_needing_attention LIMIT 10;

-- Show any payment issues
SELECT 'Payment Issues:' as info;
SELECT * FROM payment_issues LIMIT 10;

RAISE NOTICE 'Deployment complete! You can now use the monitoring functions.';
