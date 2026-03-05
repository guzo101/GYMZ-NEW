-- ============================================================================
-- Find which gym a user belongs to (by email)
-- Usage: Run in Supabase Dashboard > SQL Editor
-- Replace 'mm@gmail.com' with the target email
-- ============================================================================

-- 1. From public.users (primary gym_id)
SELECT 
  u.id AS user_id,
  u.email,
  u.name,
  u.role,
  u.gym_id,
  g.name AS gym_name,
  g.slug AS gym_slug,
  g.city AS gym_city
FROM public.users u
LEFT JOIN public.gyms g ON u.gym_id = g.id
WHERE LOWER(TRIM(u.email)) = LOWER(TRIM('mm@gmail.com'));

-- 2. From public.membership (all gym memberships if multi-gym)
SELECT 
  u.email,
  u.name,
  u.role,  -- CRITICAL: Members list only shows role='member'
  m.gym_id,
  g.name AS gym_name,
  g.slug AS gym_slug,
  m.access_mode,
  m.membership_status,
  m.approved
FROM public.users u
JOIN public.membership m ON m.user_id = u.id
LEFT JOIN public.gyms g ON g.id = m.gym_id
WHERE LOWER(TRIM(u.email)) = LOWER(TRIM('mm@gmail.com'));

-- 3. FIX: If role is NOT 'member', update it so they appear in GMS Members list
-- Run this ONLY if the user should be a regular member (not admin/staff):
-- UPDATE public.users SET role = 'member' WHERE LOWER(TRIM(email)) = 'mm@gmail.com';
