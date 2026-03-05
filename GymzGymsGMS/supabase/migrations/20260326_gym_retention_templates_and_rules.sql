-- ============================================================================
-- GYMZ: Gym retention — training_category + notification templates & rules
-- Date: 2026-03-26
-- Purpose: Support GYM_RETENTION_SYSTEM_DESIGN.md — segment by program type,
--          seed retention templates and rules (onboarding, rescue, renewal).
-- ============================================================================

BEGIN;

-- ─── 1. Optional: training category on plans (for segmentation) ─────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gym_membership_plans'
    AND column_name = 'training_category'
  ) THEN
    ALTER TABLE public.gym_membership_plans
      ADD COLUMN training_category TEXT;
    COMMENT ON COLUMN public.gym_membership_plans.training_category IS
      'Program type for retention segmentation: gym, boxing, karate, yoga, classes, etc.';
  END IF;
END $$;

-- ─── 2. Retention notification templates (push) ────────────────────────────
INSERT INTO public.notification_templates (template_key, category, channel, content, priority) VALUES
-- Onboarding (Day 0–7)
('retention_onboarding_day1', 'retention_onboarding', 'push', 'You’re in. Your first session is the one that counts. {gym_name} — see you on the floor.', 1),
('retention_onboarding_day3', 'retention_onboarding', 'push', 'Your spot is ready. Most people who stick with it show up in the first week. {gym_name}.', 1),
('retention_onboarding_day5', 'retention_onboarding', 'push', 'Your first week is the best time to lock in. {gym_name} — when you’re ready.', 1),
-- Inactivity rescue
('retention_rescue_3d', 'retention_rescue', 'push', 'You’re one session away from being back on track. {gym_name}.', 1),
('retention_rescue_7d', 'retention_rescue', 'push', 'Your goal doesn’t take a break. One session and you’re back in the rhythm. {gym_name}.', 1),
('retention_rescue_14d', 'retention_rescue', 'push', 'One session resets the rhythm. You’ve done it before — {gym_name}, when you’re ready.', 1),
-- Milestones
('retention_milestone_streak', 'retention_milestone', 'push', '{streak} days in a row. This is who you are now. Keep going.', 2),
('retention_milestone_visits', 'retention_milestone', 'push', '{visit_count} sessions. You’re not the same person who walked in the first day.', 2),
-- Renewal / expiry
('retention_renewal_30d', 'retention_renewal', 'push', 'Your access runs through {plan_end_date}. Renew to keep your momentum.', 1),
('retention_renewal_7d', 'retention_renewal', 'push', 'Your access ends {plan_end_date}. Renew and keep the habit.', 1),
-- Daily pass
('retention_daily_pass', 'retention_daily_pass', 'push', 'Your pass is valid today. {gym_name} — doors open {time}. See you there.', 1)
ON CONFLICT (template_key) DO UPDATE SET
  content = EXCLUDED.content,
  category = EXCLUDED.category,
  updated_at = NOW();

-- ─── 3. Retention notification rules (trigger_config + template_ids) ──────
-- Rule rows reference templates by key; template_ids filled via subquery.

INSERT INTO public.notification_rules (
  rule_key, rule_name, description, enabled,
  trigger_type, trigger_config, action_type, template_ids,
  max_per_day, max_per_week, min_hours_between
) VALUES
(
  'retention_onboarding_day1',
  'Onboarding Day 1 (no visit)',
  'New member, approved, 0 check-ins; send Day 1 message.',
  true,
  'behavior_based',
  '{"days_since_approval": 1, "max_visits": 0, "segment": "onboarding"}'::jsonb,
  'send_notification',
  (SELECT array_agg(id) FROM public.notification_templates WHERE template_key = 'retention_onboarding_day1'),
  1, 3, 24
),
(
  'retention_onboarding_day3',
  'Onboarding Day 3 (no visit)',
  'New member, 0 check-ins; send Day 3 nudge.',
  true,
  'behavior_based',
  '{"days_since_approval": 3, "max_visits": 0, "segment": "onboarding"}'::jsonb,
  'send_notification',
  (SELECT array_agg(id) FROM public.notification_templates WHERE template_key = 'retention_onboarding_day3'),
  1, 3, 24
),
(
  'retention_onboarding_day5',
  'Onboarding Day 5 (no visit)',
  'New member, 0 check-ins; send Day 5 nudge.',
  true,
  'behavior_based',
  '{"days_since_approval": 5, "max_visits": 0, "segment": "onboarding"}'::jsonb,
  'send_notification',
  (SELECT array_agg(id) FROM public.notification_templates WHERE template_key = 'retention_onboarding_day5'),
  1, 3, 24
),
(
  'retention_rescue_3d',
  'Inactivity rescue 3 days',
  'Last check-in > 3 days; one session nudge.',
  true,
  'behavior_based',
  '{"days_since_last_checkin": 3, "segment": "rescue_3d"}'::jsonb,
  'send_notification',
  (SELECT array_agg(id) FROM public.notification_templates WHERE template_key = 'retention_rescue_3d'),
  1, 3, 48
),
(
  'retention_rescue_7d',
  'Inactivity rescue 7 days',
  'Last check-in > 7 days; back on track nudge.',
  true,
  'behavior_based',
  '{"days_since_last_checkin": 7, "segment": "rescue_7d"}'::jsonb,
  'send_notification',
  (SELECT array_agg(id) FROM public.notification_templates WHERE template_key = 'retention_rescue_7d'),
  1, 3, 48
),
(
  'retention_rescue_14d',
  'Inactivity rescue 14 days',
  'Last check-in > 14 days; reset rhythm nudge.',
  true,
  'behavior_based',
  '{"days_since_last_checkin": 14, "segment": "rescue_14d"}'::jsonb,
  'send_notification',
  (SELECT array_agg(id) FROM public.notification_templates WHERE template_key = 'retention_rescue_14d'),
  1, 3, 48
),
(
  'retention_renewal_30d',
  'Renewal reminder 30 days before end',
  'Plan end within 30 days; renew to keep momentum.',
  true,
  'time_based',
  '{"days_until_plan_end": 30, "segment": "renewal"}'::jsonb,
  'send_notification',
  (SELECT array_agg(id) FROM public.notification_templates WHERE template_key = 'retention_renewal_30d'),
  1, 4, 168
),
(
  'retention_renewal_7d',
  'Renewal reminder 7 days before end',
  'Plan end within 7 days; renew and keep habit.',
  true,
  'time_based',
  '{"days_until_plan_end": 7, "segment": "renewal"}'::jsonb,
  'send_notification',
  (SELECT array_agg(id) FROM public.notification_templates WHERE template_key = 'retention_renewal_7d'),
  1, 4, 24
),
(
  'retention_daily_pass',
  'Daily pass valid today',
  'Day of or day after daily pass purchase; 0 check-ins.',
  true,
  'behavior_based',
  '{"plan_type": "daily", "max_visits_for_pass": 0, "segment": "daily_pass"}'::jsonb,
  'send_notification',
  (SELECT array_agg(id) FROM public.notification_templates WHERE template_key = 'retention_daily_pass'),
  1, 1, 24
)
ON CONFLICT (rule_key) DO UPDATE SET
  rule_name = EXCLUDED.rule_name,
  description = EXCLUDED.description,
  trigger_type = EXCLUDED.trigger_type,
  trigger_config = EXCLUDED.trigger_config,
  template_ids = EXCLUDED.template_ids,
  max_per_day = EXCLUDED.max_per_day,
  max_per_week = EXCLUDED.max_per_week,
  min_hours_between = EXCLUDED.min_hours_between,
  updated_at = NOW();

-- Milestone rules (streak / visit count) — no fixed schedule; app/cron evaluates after check-in
INSERT INTO public.notification_rules (
  rule_key, rule_name, description, enabled,
  trigger_type, trigger_config, action_type, template_ids,
  max_per_day, max_per_week, min_hours_between
) VALUES
(
  'retention_milestone_streak',
  'Milestone: streak 3/7/14',
  'After check-in when streak hits threshold; celebrate identity.',
  true,
  'behavior_based',
  '{"streak_thresholds": [3, 7, 14], "streak_type": "gym_visit", "segment": "milestone"}'::jsonb,
  'send_notification',
  (SELECT array_agg(id) FROM public.notification_templates WHERE template_key = 'retention_milestone_streak'),
  1, 7, 24
),
(
  'retention_milestone_visits',
  'Milestone: visit count 5/10/25/50',
  'After check-in when total visits hit threshold.',
  true,
  'behavior_based',
  '{"visit_count_thresholds": [5, 10, 25, 50], "segment": "milestone"}'::jsonb,
  'send_notification',
  (SELECT array_agg(id) FROM public.notification_templates WHERE template_key = 'retention_milestone_visits'),
  1, 7, 24
)
ON CONFLICT (rule_key) DO UPDATE SET
  rule_name = EXCLUDED.rule_name,
  description = EXCLUDED.description,
  trigger_config = EXCLUDED.trigger_config,
  template_ids = EXCLUDED.template_ids,
  updated_at = NOW();

COMMIT;
