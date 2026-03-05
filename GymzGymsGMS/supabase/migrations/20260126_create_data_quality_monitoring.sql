-- ================================================================================
-- AUTOMATED DATA QUALITY MONITORING FUNCTIONS
-- Purpose: Create functions to continuously monitor data quality
-- ================================================================================

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Function: Check User Data Completeness                                    │
-- └────────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION check_user_data_completeness()
RETURNS TABLE (
  metric TEXT,
  value INTEGER,
  percentage NUMERIC
) LANGUAGE plpgsql AS $$
DECLARE
  total_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  
  RETURN QUERY
  SELECT 
    'Total Users'::TEXT as metric,
    total_users as value,
    100.0 as percentage
  UNION ALL
  SELECT 
    'Users with unique_id',
    COUNT(*)::INTEGER,
    ROUND((COUNT(*)::NUMERIC / NULLIF(total_users, 0)) * 100, 2)
  FROM users WHERE unique_id IS NOT NULL
  UNION ALL
  SELECT 
    'Users with name',
    COUNT(*)::INTEGER,
    ROUND((COUNT(*)::NUMERIC / NULLIF(total_users, 0)) * 100, 2)
  FROM users WHERE name IS NOT NULL
  UNION ALL
  SELECT 
    'Active Members',
    COUNT(*)::INTEGER,
    ROUND((COUNT(*)::NUMERIC / NULLIF(total_users, 0)) * 100, 2)
  FROM users WHERE membership_status = 'Active';
END;
$$;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Function: Get Payment Statistics                                          │
-- └────────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION get_payment_statistics()
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_payments', COUNT(*),
    'approved_payments', COUNT(*) FILTER (WHERE status = 'Approved'),
    'pending_payments', COUNT(*) FILTER (WHERE status = 'Pending'),
    'rejected_payments', COUNT(*) FILTER (WHERE status = 'Rejected'),
    'total_revenue', COALESCE(SUM(amount) FILTER (WHERE status = 'Approved'), 0),
    'avg_payment', ROUND(AVG(amount) FILTER (WHERE status = 'Approved'), 2),
    'invalid_amounts', COUNT(*) FILTER (WHERE amount IS NULL OR amount <= 0),
    'missing_timestamps', COUNT(*) FILTER (WHERE status = 'Approved' AND paid_at IS NULL)
  ) INTO result
  FROM payments;
  
  RETURN result;
END;
$$;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Function: Find Expired Active Memberships                                 │
-- └────────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION find_expired_active_memberships()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  membership_expiry DATE,
  days_expired INTEGER
) LANGUAGE sql AS $$
  SELECT 
    id as user_id,
    email,
    membership_expiry,
    (CURRENT_DATE - membership_expiry)::INTEGER as days_expired
  FROM users
  WHERE membership_status = 'Active'
    AND membership_expiry < CURRENT_DATE
  ORDER BY membership_expiry ASC;
$$;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Function: Get Progress Tracking Utilization                               │
-- └────────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION get_progress_tracking_stats()
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'body_metrics', (SELECT COUNT(*) FROM body_metrics),
    'user_fitness_goals', (SELECT COUNT(*) FROM user_fitness_goals),
    'daily_calorie_summary', (SELECT COUNT(*) FROM daily_calorie_summary),
    'user_streaks', (SELECT COUNT(*) FROM user_streaks),
    'exercise_progress', (SELECT COUNT(*) FROM exercise_progress),
    'user_level_system', (SELECT COUNT(*) FROM user_level_system),
    'achievement_badges', (SELECT COUNT(*) FROM achievement_badges),
    'user_badge_progress', (SELECT COUNT(*) FROM user_badge_progress),
    'unlocked_badges', (SELECT COUNT(*) FROM user_badge_progress WHERE is_unlocked = true)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Function: Daily Data Quality Check (Scheduled Job)                        │
-- └────────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION daily_data_quality_check()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  issue_count INTEGER := 0;
  admin_user_id UUID;
BEGIN
  -- Find an admin to send notification to
  SELECT id INTO admin_user_id 
  FROM users 
  WHERE role IN ('admin', 'super_admin') 
  LIMIT 1;
  
  -- Check for users without unique_id
  SELECT COUNT(*) INTO issue_count FROM users WHERE unique_id IS NULL;
  IF issue_count > 0 THEN
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (
      admin_user_id,
      'warning',
      'Data Quality Alert',
      format('%s users are missing unique_id', issue_count)
    );
  END IF;
  
  -- Check for expired active memberships
  SELECT COUNT(*) INTO issue_count 
  FROM users 
  WHERE membership_status = 'Active' AND membership_expiry < CURRENT_DATE;
  
  IF issue_count > 0 THEN
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (
      admin_user_id,
      'warning',
      'Membership Expiry Alert',
      format('%s active members have expired memberships', issue_count)
    );
  END IF;
  
  -- Check for payments with invalid amounts
  SELECT COUNT(*) INTO issue_count 
  FROM payments 
  WHERE amount IS NULL OR amount <= 0;
  
  IF issue_count > 0 THEN
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (
      admin_user_id,
      'error',
      'Payment Data Alert',
      format('%s payments have invalid amounts', issue_count)
    );
  END IF;
END;
$$;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Function: Get Orphaned Records Report                                     │
-- └────────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION check_referential_integrity()
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  result JSON;
  orphaned_payments INTEGER;
  orphaned_progress INTEGER;
  orphaned_bookings INTEGER;
BEGIN
  -- Count orphaned payments
  SELECT COUNT(*) INTO orphaned_payments
  FROM payments p
  LEFT JOIN users u ON p.user_id = u.id
  WHERE u.id IS NULL;
  
  -- Count orphaned progress records
  SELECT COUNT(*) INTO orphaned_progress
  FROM user_badge_progress ubp
  LEFT JOIN users u ON ubp.user_id = u.id
  WHERE u.id IS NULL;
  
  -- Count orphaned bookings
  SELECT COUNT(*) INTO orphaned_bookings
  FROM gym_class_bookings gcb
  LEFT JOIN users u ON gcb.user_id = u.id
  WHERE u.id IS NULL;
  
  SELECT json_build_object(
    'orphaned_payments', orphaned_payments,
    'orphaned_progress_records', orphaned_progress,
    'orphaned_bookings', orphaned_bookings,
    'total_issues', orphaned_payments + orphaned_progress + orphaned_bookings
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Create Views for Easy Monitoring                                          │
-- └────────────────────────────────────────────────────────────────────────────┘

-- View: Users needing attention
CREATE OR REPLACE VIEW users_needing_attention AS
SELECT 
  id,
  email,
  name,
  unique_id,
  membership_status,
  membership_expiry,
  CASE
    WHEN unique_id IS NULL THEN 'Missing unique_id'
    WHEN name IS NULL THEN 'Missing name'
    WHEN membership_status = 'Active' AND membership_expiry < CURRENT_DATE THEN 'Expired membership'
    ELSE 'Other'
  END as issue_type
FROM users
WHERE unique_id IS NULL
   OR name IS NULL
   OR (membership_status = 'Active' AND membership_expiry < CURRENT_DATE);

-- View: Payment issues
CREATE OR REPLACE VIEW payment_issues AS
SELECT 
  p.id,
  p.user_id,
  u.email,
  p.amount,
  p.status,
  p.paid_at,
  CASE
    WHEN p.amount IS NULL OR p.amount <= 0 THEN 'Invalid amount'
    WHEN p.status = 'Approved' AND p.paid_at IS NULL THEN 'Missing timestamp'
    WHEN u.id IS NULL THEN 'Orphaned record'
    ELSE 'Other'
  END as issue_type
FROM payments p
LEFT JOIN users u ON p.user_id = u.id
WHERE p.amount IS NULL 
   OR p.amount <= 0
   OR (p.status = 'Approved' AND p.paid_at IS NULL)
   OR u.id IS NULL;

-- Grant permissions to authenticated users to view monitoring functions
GRANT EXECUTE ON FUNCTION check_user_data_completeness() TO authenticated;
GRANT EXECUTE ON FUNCTION get_payment_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_progress_tracking_stats() TO authenticated;
GRANT SELECT ON users_needing_attention TO authenticated;
GRANT SELECT ON payment_issues TO authenticated;

-- Log creation of monitoring system
INSERT INTO migration_logs (migration_name, status, notes)
VALUES (
  'create_data_quality_monitoring',
  'SUCCESS',
  'Created monitoring functions and views for continuous data quality checks'
);

-- Display completion message
DO $$
BEGIN
  RAISE NOTICE 'Data quality monitoring system created successfully';
END $$;
