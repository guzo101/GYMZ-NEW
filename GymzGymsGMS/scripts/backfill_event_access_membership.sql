-- Backfill membership rows for event_access users with unique_id but no membership.
-- Also set users.membership_status = 'Active' (event path is free = auto-active).
-- Run this to fix users like khad@gmail.com and lop@gmail.com who get no_membership on relogin.

INSERT INTO public.membership (
  user_id, gym_id, access_mode,
  membership_status, approved, approved_at, unique_member_id,
  calibration_required, calibration_completed, updated_at
)
SELECT
  u.id, u.gym_id, 'event_access',
  'active', true, NOW(), u.unique_id,
  false, false, NOW()
FROM public.users u
LEFT JOIN public.membership m
  ON m.user_id = u.id AND m.gym_id = u.gym_id AND m.access_mode = 'event_access'
WHERE u.gym_id IS NOT NULL
  AND u.access_mode = 'event_access'
  AND u.unique_id IS NOT NULL
  AND TRIM(u.unique_id) <> ''
  AND m.id IS NULL
ON CONFLICT (user_id, gym_id, access_mode) DO NOTHING;

-- Set users.membership_status = 'Active' for event_access (free path = auto-active)
UPDATE public.users u
SET membership_status = 'Active', updated_at = NOW()
WHERE u.gym_id IS NOT NULL
  AND u.access_mode = 'event_access'
  AND u.unique_id IS NOT NULL
  AND TRIM(u.unique_id) <> ''
  AND (u.membership_status IS NULL OR LOWER(TRIM(u.membership_status)) NOT IN ('active', 'approved'));
