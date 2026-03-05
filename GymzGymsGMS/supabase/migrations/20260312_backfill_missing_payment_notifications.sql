-- ============================================================================
-- GYMZ: BACKFILL MISSING PAYMENT NOTIFICATIONS
-- Date: 2026-03-12
-- Creates payment_pending notifications for existing pending payments that
-- don't have one. Fixes "old notifications not populating the bell".
-- ============================================================================

BEGIN;

-- 1. Ensure payments have gym_id (from payer)
UPDATE public.payments p
SET gym_id = u.gym_id
FROM public.users u
WHERE p.gym_id IS NULL
  AND u.id = COALESCE(p.user_id, p.member_id)
  AND u.gym_id IS NOT NULL;

-- 2. Ensure existing notifications have gym_id
UPDATE public.notifications n
SET gym_id = p.gym_id
FROM public.payments p
WHERE n.payment_id = p.id
  AND n.gym_id IS NULL
  AND p.gym_id IS NOT NULL;

UPDATE public.notifications n
SET gym_id = u.gym_id
FROM public.payments p
JOIN public.users u ON u.id = COALESCE(p.user_id, p.member_id)
WHERE n.payment_id = p.id
  AND n.gym_id IS NULL
  AND u.gym_id IS NOT NULL;

-- 3. INSERT missing payment_pending notifications for pending payments
INSERT INTO public.notifications (
  user_id, gym_id, type, message, payment_id, priority, is_read, status, action_url, action_label
)
SELECT
  NULL,
  COALESCE(p.gym_id, u.gym_id),
  'payment_pending',
  'New payment of ' || p.amount || ' from ' || COALESCE(u.name, 'Member'),
  p.id,
  2,
  FALSE,
  'unread',
  '/finances',
  'Review Payment'
FROM public.payments p
LEFT JOIN public.users u ON u.id = COALESCE(p.user_id, p.member_id)
WHERE p.status IN ('pending', 'pending_approval', 'pending_verification')
  AND COALESCE(p.gym_id, u.gym_id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.payment_id = p.id AND n.type = 'payment_pending'
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
