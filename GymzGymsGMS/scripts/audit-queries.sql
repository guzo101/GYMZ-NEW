-- ================================================================================
-- Gymz PLATFORM - COMPREHENSIVE DATA INTEGRITY AUDIT QUERIES
-- ================================================================================
-- Purpose: Verify data completeness, consistency, and integrity across all tables
-- Run these queries in Supabase SQL Editor and review results
-- ================================================================================

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 1: USER PROFILE COMPLETENESS                                      │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Query 1.1: Overall User Statistics
SELECT 
    'Total Users' as metric,
    COUNT(*) as count
FROM users
UNION ALL
SELECT 'Users with unique_id', COUNT(*) FROM users WHERE unique_id IS NOT NULL
UNION ALL
SELECT 'Users with name', COUNT(*) FROM users WHERE name IS NOT NULL
UNION ALL
SELECT 'Admin Users', COUNT(*) FROM users WHERE role IN ('admin', 'super_admin')
UNION ALL
SELECT 'Active Members', COUNT(*) FROM users WHERE membership_status = 'Active'
UNION ALL
SELECT 'Pending Members', COUNT(*) FROM users WHERE membership_status = 'Pending'
ORDER BY metric;

-- Query 1.2: Users with Incomplete Profiles
SELECT 
    id,
    email,
    name,
    unique_id,
    role,
    membership_status,
    membership_expiry,
    created_at
FROM users
WHERE unique_id IS NULL 
   OR name IS NULL 
   OR email IS NULL
ORDER BY created_at DESC;

-- Query 1.3: Membership Expiry Issues
SELECT 
    id,
    email,
    membership_status,
    membership_expiry,
    CASE 
        WHEN membership_expiry IS NULL THEN 'No expiry set'
        WHEN membership_expiry < CURRENT_DATE THEN 'Expired'
        ELSE 'Valid'
    END as expiry_status,
    membership_expiry - CURRENT_DATE as days_remaining
FROM users
WHERE membership_status = 'Active'
ORDER BY membership_expiry ASC NULLS FIRST
LIMIT 20;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 2: FINANCE & PAYMENT INTEGRITY                                    │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Query 2.1: Payment Summary Statistics
SELECT 
    COUNT(*) as total_payments,
    COUNT(CASE WHEN approved = true THEN 1 END) as approved_payments,
    COUNT(CASE WHEN approved = false OR approved IS NULL THEN 1 END) as pending_payments,
    COUNT(CASE WHEN amount IS NULL OR amount <= 0 THEN 1 END) as invalid_amounts,
    COUNT(CASE WHEN paid_at IS NULL THEN 1 END) as missing_timestamps,
    SUM(CASE WHEN approved = true THEN COALESCE(amount, 0) ELSE 0 END) as total_revenue,
    AVG(CASE WHEN approved = true THEN amount END) as avg_payment_amount
FROM payments;

-- Query 2.2: Payments with Data Quality Issues
SELECT 
    id,
    user_id,
    amount,
    membership_type,
    approved,
    status,
    paid_at,
    created_at,
    CASE
        WHEN amount IS NULL THEN 'NULL amount'
        WHEN amount <= 0 THEN 'Zero or negative amount'
        WHEN paid_at IS NULL AND approved = true THEN 'Approved but no timestamp'
        WHEN membership_type IS NULL THEN 'No membership type'
        ELSE 'Other issue'
    END as issue_type
FROM payments
WHERE amount IS NULL 
   OR amount <= 0
   OR (paid_at IS NULL AND approved = true)
   OR membership_type IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- Query 2.3: Orphaned Payment Records (no matching user)
SELECT 
    p.id,
    p.user_id,
    p.amount,
    p.membership_type,
    p.approved,
    p.created_at
FROM payments p
LEFT JOIN users u ON p.user_id = u.id
WHERE u.id IS NULL;

-- Query 2.4: Status Field Mismatches
SELECT 
    id,
    user_id,
    amount,
    approved,
    status,
    membership_type,
    paid_at
FROM payments
WHERE (approved = true AND status != 'Approved')
   OR (approved = false AND status = 'Approved')
   OR (approved IS NULL AND status IS NOT NULL)
ORDER BY created_at DESC
LIMIT 20;

-- Query 2.5: Recent Payment Processing
SELECT 
    p.id,
    p.user_id,
    u.email,
    u.name,
    p.amount,
    p.membership_type,
    p.approved,
    p.paid_at,
    u.membership_status,
    u.membership_expiry,
    CASE 
        WHEN p.approved = true AND u.membership_status != 'Active' THEN 'Payment approved but membership not active'
        WHEN p.approved = true AND u.membership_expiry IS NULL THEN 'Payment approved but no expiry date'
        ELSE 'OK'
    END as sync_status
FROM payments p
JOIN users u ON p.user_id = u.id
WHERE p.paid_at > NOW() - INTERVAL '30 days'
ORDER BY p.paid_at DESC
LIMIT 20;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 3: PROGRESS TRACKING UTILIZATION                                  │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Query 3.1: Progress Table Record Counts
SELECT 
    'body_metrics' as table_name, 
    COUNT(*) as record_count,
    COUNT(DISTINCT user_id) as unique_users
FROM body_metrics
UNION ALL
SELECT 'user_fitness_goals', COUNT(*), COUNT(DISTINCT user_id) FROM user_fitness_goals
UNION ALL
SELECT 'daily_calorie_summary', COUNT(*), COUNT(DISTINCT user_id) FROM daily_calorie_summary
UNION ALL
SELECT 'user_streaks', COUNT(*), COUNT(DISTINCT user_id) FROM user_streaks
UNION ALL
SELECT 'exercise_progress', COUNT(*), COUNT(DISTINCT user_id) FROM exercise_progress
UNION ALL
SELECT 'class_attendance_summary', COUNT(*), COUNT(DISTINCT user_id) FROM class_attendance_summary
UNION ALL
SELECT 'weekly_progress_summary', COUNT(*), COUNT(DISTINCT user_id) FROM weekly_progress_summary
ORDER BY record_count DESC;

-- Query 3.2: Nutrition Tracking Activity
SELECT 
    'daily_nutrition_logs' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as active_users,
    COUNT(CASE WHEN logged_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_logs
FROM daily_nutrition_logs
UNION ALL
SELECT 'meal_scans', COUNT(*), COUNT(DISTINCT user_id), 
       COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END)
FROM meal_scans
UNION ALL
SELECT 'water_logs', COUNT(*), COUNT(DISTINCT user_id),
       COUNT(CASE WHEN log_date > CURRENT_DATE - 7 THEN 1 END)
FROM water_logs
UNION ALL
SELECT 'daily_health_logs', COUNT(*), COUNT(DISTINCT user_id),
       COUNT(CASE WHEN log_date > CURRENT_DATE - 7 THEN 1 END)
FROM daily_health_logs;

-- Query 3.3: Gamification Engagement
SELECT 
    'User Level System' as metric,
    COUNT(*) as count
FROM user_level_system
UNION ALL
SELECT 'Users with XP', COUNT(DISTINCT user_id) FROM xp_transactions
UNION ALL
SELECT 'Total XP Awarded', SUM(points) FROM xp_transactions
UNION ALL
SELECT 'Unlocked Badges', COUNT(*) FROM user_badge_progress WHERE is_unlocked = true
UNION ALL
SELECT 'Users with Badges', COUNT(DISTINCT user_id) FROM user_badge_progress WHERE is_unlocked = true
UNION ALL
SELECT 'Active Achievements', COUNT(*) FROM achievement_badges WHERE is_active = true;

-- Query 3.4: Users Without Progress Data
SELECT 
    u.id,
    u.email,
    u.name,
    u.membership_status,
    COUNT(DISTINCT bm.id) as body_metric_count,
    COUNT(DISTINCT ufg.id) as goal_count,
    COUNT(DISTINCT us.id) as streak_count,
    COUNT(DISTINCT uls.id) as has_level,
    CASE 
        WHEN COUNT(DISTINCT bm.id) = 0 
         AND COUNT(DISTINCT ufg.id) = 0 
         AND COUNT(DISTINCT us.id) = 0 
        THEN 'No progress data'
        ELSE 'Has some data'
    END as status
FROM users u
LEFT JOIN body_metrics bm ON u.id = bm.user_id
LEFT JOIN user_fitness_goals ufg ON u.id = ufg.user_id
LEFT JOIN user_streaks us ON u.id = us.user_id
LEFT JOIN user_level_system uls ON u.id = uls.user_id
WHERE u.membership_status = 'Active'
GROUP BY u.id, u.email, u.name, u.membership_status
HAVING COUNT(DISTINCT bm.id) = 0 
   AND COUNT(DISTINCT ufg.id) = 0 
   AND COUNT(DISTINCT us.id) = 0
LIMIT 20;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 4: CLASS MANAGEMENT & ATTENDANCE                                  │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Query 4.1: Class System Overview
SELECT 
    (SELECT COUNT(*) FROM gym_classes) as total_classes,
    (SELECT COUNT(*) FROM gym_class_schedules) as total_schedules,
    (SELECT COUNT(*) FROM gym_class_bookings) as total_bookings,
    (SELECT COUNT(*) FROM gym_class_bookings WHERE status = 'confirmed') as confirmed_bookings,
    (SELECT COUNT(*) FROM attendance) as total_check_ins;

-- Query 4.2: Class Schedules Without Class Definition
SELECT 
    gcs.id,
    gcs.class_id,
    gcs.start_time,
    gcs.instructor,
    gc.name as class_name
FROM gym_class_schedules gcs
LEFT JOIN gym_classes gc ON gcs.class_id = gc.id
WHERE gc.id IS NULL
LIMIT 10;

-- Query 4.3: Bookings Without Attendance
-- (Helps identify no-shows)
SELECT 
    gcb.id,
    gcb.user_id,
    u.email,
    gcb.schedule_id,
    gcs.start_time,
    gc.name as class_name,
    gcb.status,
    CASE 
        WHEN gcs.start_time < NOW() THEN 'Past class - potential no-show'
        ELSE 'Upcoming'
    END as attendance_status
FROM gym_class_bookings gcb
JOIN users u ON gcb.user_id = u.id
LEFT JOIN gym_class_schedules gcs ON gcb.schedule_id = gcs.id
LEFT JOIN gym_classes gc ON gcs.class_id = gc.id
LEFT JOIN attendance a ON a.user_id = gcb.user_id 
    AND a.class_schedule_id = gcb.schedule_id
WHERE a.id IS NULL
  AND gcs.start_time < NOW()
  AND gcb.status = 'confirmed'
ORDER BY gcs.start_time DESC
LIMIT 20;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 5: REFERENTIAL INTEGRITY CHECKS                                   │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Query 5.1: Orphaned Records Across Tables
SELECT 'user_badge_progress' as table_name, COUNT(*) as orphaned_count
FROM user_badge_progress ubp
LEFT JOIN users u ON ubp.user_id = u.id
WHERE u.id IS NULL
UNION ALL
SELECT 'body_metrics', COUNT(*)
FROM body_metrics bm
LEFT JOIN users u ON bm.user_id = u.id
WHERE u.id IS NULL
UNION ALL
SELECT 'daily_nutrition_logs', COUNT(*)
FROM daily_nutrition_logs dnl
LEFT JOIN users u ON dnl.user_id = u.id
WHERE u.id IS NULL
UNION ALL
SELECT 'gym_class_bookings', COUNT(*)
FROM gym_class_bookings gcb
LEFT JOIN users u ON gcb.user_id = u.id
WHERE u.id IS NULL;

-- Query 5.2: Users Without Level Record
SELECT 
    u.id,
    u.email,
    u.name,
    u.membership_status,
    u.created_at
FROM users u
LEFT JOIN user_level_system uls ON u.id = uls.user_id
WHERE uls.id IS NULL
  AND u.membership_status = 'Active'
ORDER BY u.created_at DESC
LIMIT 20;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 6: TRIGGER & AUTOMATION VERIFICATION                              │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Query 6.1: Check Critical Triggers Exist
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    CASE tgenabled
        WHEN 'O' THEN 'Enabled'
        WHEN 'D' THEN 'Disabled'
        WHEN 'A' THEN 'Enabled (Always)'
        WHEN 'R' THEN 'Enabled (Replica)'
        ELSE 'Unknown'
    END as status
FROM pg_trigger
WHERE tgname IN (
    'on_auth_user_created',
    'handle_membership_activation',
    'handle_payment_notification',
    'on_payment_status_change'
)
ORDER BY tgname;

-- Query 6.2: Recent Auth Users Without Public Profile
SELECT 
    au.id,
    au.email,
    au.created_at,
    pu.id as public_profile_exists
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
  AND au.created_at > NOW() - INTERVAL '30 days'
ORDER BY au.created_at DESC;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 7: DATA FRESHNESS & ACTIVITY                                      │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Query 7.1: Recent Activity Summary
SELECT 
    'New Users (7 days)' as metric,
    COUNT(*) as count
FROM users
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'New Payments (7 days)', COUNT(*)
FROM payments
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'Nutrition Logs (7 days)', COUNT(*)
FROM daily_nutrition_logs
WHERE logged_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'Class Bookings (7 days)', COUNT(*)
FROM gym_class_bookings
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'Check-ins (7 days)', COUNT(*)
FROM attendance
WHERE check_in_time > NOW() - INTERVAL '7 days';

-- Query 7.2: Inactive Users (No Recent Activity)
SELECT 
    u.id,
    u.email,
    u.name,
    u.membership_status,
    u.last_login,
    MAX(dnl.logged_at) as last_nutrition_log,
    MAX(a.check_in_time) as last_check_in,
    MAX(p.created_at) as last_payment
FROM users u
LEFT JOIN daily_nutrition_logs dnl ON u.id = dnl.user_id
LEFT JOIN attendance a ON u.id = a.user_id
LEFT JOIN payments p ON u.id = p.user_id
WHERE u.membership_status = 'Active'
GROUP BY u.id, u.email, u.name, u.membership_status, u.last_login
HAVING MAX(COALESCE(dnl.logged_at, a.check_in_time, p.created_at)) < NOW() - INTERVAL '30 days'
    OR MAX(COALESCE(dnl.logged_at, a.check_in_time, p.created_at)) IS NULL
ORDER BY last_check_in DESC NULLS LAST
LIMIT 20;

-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 8: SOCIAL & COMMUNICATION TABLES                                  │
-- └────────────────────────────────────────────────────────────────────────────┘

-- Query 8.1: Social Features Usage
SELECT 
    'Rooms' as feature,
    COUNT(*) as count
FROM rooms
UNION ALL
SELECT 'Room Members', COUNT(*) FROM room_members
UNION ALL
SELECT 'Room Posts', COUNT(*) FROM room_posts
UNION ALL
SELECT 'Post Reactions', COUNT(*) FROM room_post_reactions
UNION ALL
SELECT 'Post Comments', COUNT(*) FROM room_post_comments
UNION ALL
SELECT 'Conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'Notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'Notice Board Items', COUNT(*) FROM notice_board;

-- Query 8.2: Unread Notifications
SELECT 
    COUNT(*) as total_notifications,
    COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count,
    COUNT(DISTINCT user_id) as users_with_notifications
FROM notifications;

-- ================================================================================
-- END OF AUDIT QUERIES
-- ================================================================================
-- 
-- NEXT STEPS:
-- 1. Run each section and save results
-- 2. Review any rows returned in "issues" or "orphaned" queries
-- 3. Identify priority fixes based on critical vs warning issues
-- 4. Create data fix migrations for automated resolution
-- ================================================================================
