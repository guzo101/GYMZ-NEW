-- ============================================================================
-- Verify: Gym retention migration (20260326_gym_retention_templates_and_rules)
-- Run this AFTER applying the migration. All checks should pass.
-- ============================================================================

-- 1. training_category column exists on gym_membership_plans
SELECT
  'training_category column' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gym_membership_plans'
    AND column_name = 'training_category'
  ) THEN 'PASS' ELSE 'FAIL' END AS result;

-- 2. Retention templates: expect 11 rows with our keys
SELECT
  'retention templates count' AS check_name,
  CASE WHEN COUNT(*) = 11 THEN 'PASS' ELSE 'FAIL (got ' || COUNT(*)::text || ')' END AS result
FROM public.notification_templates
WHERE template_key IN (
  'retention_onboarding_day1', 'retention_onboarding_day3', 'retention_onboarding_day5',
  'retention_rescue_3d', 'retention_rescue_7d', 'retention_rescue_14d',
  'retention_milestone_streak', 'retention_milestone_visits',
  'retention_renewal_30d', 'retention_renewal_7d',
  'retention_daily_pass'
);

-- 3. List retention templates (quick visual check)
SELECT template_key, category, LEFT(content, 50) || '...' AS content_preview, enabled
FROM public.notification_templates
WHERE category LIKE 'retention%'
ORDER BY category, template_key;

-- 4. Retention rules: expect 11 rows with our keys and non-null template_ids
SELECT
  'retention rules count' AS check_name,
  CASE WHEN COUNT(*) = 11 THEN 'PASS' ELSE 'FAIL (got ' || COUNT(*)::text || ')' END AS result
FROM public.notification_rules
WHERE rule_key IN (
  'retention_onboarding_day1', 'retention_onboarding_day3', 'retention_onboarding_day5',
  'retention_rescue_3d', 'retention_rescue_7d', 'retention_rescue_14d',
  'retention_renewal_30d', 'retention_renewal_7d', 'retention_daily_pass',
  'retention_milestone_streak', 'retention_milestone_visits'
);

-- 5. Rules must have template_ids set (array length >= 1)
SELECT
  'rules have template_ids' AS check_name,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL (' || COUNT(*)::text || ' rules missing template_ids)' END AS result
FROM public.notification_rules
WHERE rule_key LIKE 'retention_%'
  AND (template_ids IS NULL OR array_length(template_ids, 1) IS NULL OR array_length(template_ids, 1) < 1);

-- 6. List retention rules with trigger segment (for manual check)
SELECT rule_key, rule_name, enabled,
  trigger_config->>'segment' AS segment,
  trigger_config->>'days_since_approval' AS days_since_approval,
  trigger_config->>'days_since_last_checkin' AS days_since_last_checkin,
  trigger_config->>'days_until_plan_end' AS days_until_plan_end,
  array_length(template_ids, 1) AS template_count
FROM public.notification_rules
WHERE rule_key LIKE 'retention_%'
ORDER BY rule_key;
