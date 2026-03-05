-- ============================================================================
-- Verify: Event member ID format migration (20260327_event_member_id_gym_aligned)
-- Run AFTER applying the migration.
-- ============================================================================

-- 1. Sample event_access members (should show SF-E60045 style)
SELECT
  u.email,
  u.unique_id,
  u.access_mode,
  g.name AS gym_name,
  g.short_code
FROM public.users u
JOIN public.gyms g ON g.id = u.gym_id
WHERE u.access_mode = 'event_access'
  AND u.gym_id IS NOT NULL
  AND u.unique_id IS NOT NULL
LIMIT 5;

-- 2. Sample gym_access members (should show SF-60045 style)
SELECT
  u.email,
  u.unique_id,
  u.access_mode,
  g.name AS gym_name,
  g.short_code
FROM public.users u
JOIN public.gyms g ON g.id = u.gym_id
WHERE (u.access_mode = 'gym_access' OR u.access_mode IS NULL)
  AND u.gym_id IS NOT NULL
  AND u.unique_id IS NOT NULL
LIMIT 5;

-- 3. Check for any legacy EV-/GY- format (should be 0 after migration)
SELECT
  'Legacy EV-/GY- count' AS check_name,
  COUNT(*) AS count
FROM public.users
WHERE unique_id LIKE 'EV-%' OR unique_id LIKE 'EVT-%' OR unique_id LIKE 'GY-%';

-- 4. DIAGNOSTIC: Why are legacy IDs still present?
SELECT
  u.id,
  u.email,
  u.unique_id,
  u.gym_id AS user_gym_id,
  u.access_mode,
  m.gym_id AS membership_gym_id
FROM public.users u
LEFT JOIN (
  SELECT DISTINCT ON (user_id) user_id, gym_id
  FROM public.membership
  ORDER BY user_id, gym_id
) m ON m.user_id = u.id
WHERE u.unique_id LIKE 'EV-%' OR u.unique_id LIKE 'EVT-%' OR u.unique_id LIKE 'GY-%';

-- 5. FIX: Run scripts/fix_legacy_member_ids.sql (uses SECURITY DEFINER to bypass RLS)
