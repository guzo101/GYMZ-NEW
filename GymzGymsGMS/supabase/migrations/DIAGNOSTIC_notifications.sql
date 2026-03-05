-- ============================================================================
-- DIAGNOSTIC: Run this in Supabase SQL Editor to debug notification visibility
-- Copy results and share if notifications still don't appear in the bell
-- ============================================================================

-- 1. Notifications (payment_pending) and their gym_id
SELECT 
  n.id,
  n.type,
  n.gym_id AS notification_gym_id,
  n.user_id,
  n.message,
  n.created_at,
  p.gym_id AS payment_gym_id,
  p.user_id AS payer_user_id,
  u.gym_id AS payer_gym_id
FROM notifications n
LEFT JOIN payments p ON n.payment_id = p.id
LEFT JOIN users u ON u.id = COALESCE(p.user_id, p.member_id)
WHERE n.type IN ('payment_pending', 'payment_approved', 'payment_rejected', 'member_signup')
ORDER BY n.created_at DESC
LIMIT 20;

-- 2. Admins and their gym_id
SELECT id, email, role, gym_id 
FROM users 
WHERE role IN ('admin', 'owner', 'super_admin')
ORDER BY email;

-- 3. Payments and gym_id (for the 3 pending you showed)
SELECT id, user_id, member_id, gym_id, amount, status, created_at
FROM payments
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;
