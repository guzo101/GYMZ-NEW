-- ============================================================================
-- GYMZ: Data Integrity Queries — Paid User Relogin Fix
-- Run these to verify data consistency and detect issues.
-- ============================================================================

-- 1. Paid payment records that do NOT have a matching active membership
SELECT
  p.id AS payment_id,
  p.user_id,
  p.gym_id,
  p.status AS payment_status,
  p.paid_at,
  m.id AS membership_id,
  m.membership_status AS membership_status
FROM public.payments p
LEFT JOIN public.membership m
  ON m.user_id = p.user_id
  AND m.gym_id = COALESCE(p.gym_id, (SELECT gym_id FROM public.users WHERE id = p.user_id))
  AND m.access_mode = COALESCE(
    (SELECT access_mode FROM public.users WHERE id = p.user_id),
    'gym_access'
  )
WHERE LOWER(TRIM(p.status)) IN ('completed', 'approved', 'paid', 'success')
  AND (m.id IS NULL OR m.membership_status <> 'active' OR m.approved <> true);

-- 2. Active memberships missing valid user_id, gym_id, or plan reference
SELECT
  m.id,
  m.user_id,
  m.gym_id,
  m.access_mode,
  m.unique_member_id,
  u.id AS user_exists,
  g.id AS gym_exists
FROM public.membership m
LEFT JOIN public.users u ON u.id = m.user_id
LEFT JOIN public.gyms g ON g.id = m.gym_id
WHERE m.membership_status = 'active'
  AND m.approved = true
  AND (u.id IS NULL OR g.id IS NULL);

-- 3. Users with multiple gym memberships where users.gym_id doesn't match any active one
SELECT
  u.id AS user_id,
  u.email,
  u.gym_id AS users_gym_id,
  u.access_mode AS users_access_mode,
  m.gym_id AS membership_gym_id,
  m.access_mode AS membership_access_mode,
  m.membership_status
FROM public.users u
JOIN public.membership m ON m.user_id = u.id AND m.membership_status = 'active' AND m.approved = true
WHERE u.gym_id IS NOT NULL
  AND (u.gym_id <> m.gym_id OR COALESCE(u.access_mode, 'gym_access') <> m.access_mode);

-- 4. Event_access users with unique_id but no membership row (should be zero after backfill)
SELECT
  u.id,
  u.email,
  u.gym_id,
  u.unique_id,
  u.access_mode,
  m.id AS membership_id
FROM public.users u
LEFT JOIN public.membership m
  ON m.user_id = u.id AND m.gym_id = u.gym_id AND m.access_mode = 'event_access'
WHERE u.access_mode = 'event_access'
  AND u.gym_id IS NOT NULL
  AND u.unique_id IS NOT NULL
  AND (u.unique_id <> '' AND LENGTH(TRIM(u.unique_id)) > 0)
  AND m.id IS NULL;
