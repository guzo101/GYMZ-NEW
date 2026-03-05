-- ============================================================================
-- DIAGNOSTIC: Event member upgrade pricing
-- Run this in Supabase SQL Editor to find why event members see "Pricing not available"
-- ============================================================================

-- 1. Gyms with NO gym_access or both plans (event members cannot upgrade)
SELECT
  g.id AS gym_id,
  g.name AS gym_name,
  COUNT(p.id) AS total_plans,
  COUNT(p.id) FILTER (WHERE p.access_mode_scope IN ('gym_access', 'both')) AS gym_upgrade_plans,
  COUNT(p.id) FILTER (WHERE p.access_mode_scope = 'event_access') AS event_only_plans
FROM public.gyms g
LEFT JOIN public.gym_membership_plans p ON p.gym_id = g.id AND p.is_active = true
GROUP BY g.id, g.name
HAVING COUNT(p.id) FILTER (WHERE p.access_mode_scope IN ('gym_access', 'both')) = 0
ORDER BY g.name;

-- 2. Event members and their gym (do they have gym_id?)
SELECT
  u.id,
  u.email,
  u.gym_id,
  u.access_mode,
  g.name AS gym_name,
  (SELECT COUNT(*) FROM public.gym_membership_plans p
   WHERE p.gym_id = u.gym_id AND p.is_active = true
   AND p.access_mode_scope IN ('gym_access', 'both')) AS upgrade_plans_available
FROM public.users u
LEFT JOIN public.gyms g ON g.id = u.gym_id
WHERE u.access_mode = 'event_access'
ORDER BY u.created_at DESC
LIMIT 20;

-- 3. All gym_membership_plans with scope (sample)
SELECT gym_id, plan_name, price, access_mode_scope, is_active
FROM public.gym_membership_plans
WHERE is_active = true
ORDER BY gym_id, sort_order
LIMIT 50;
