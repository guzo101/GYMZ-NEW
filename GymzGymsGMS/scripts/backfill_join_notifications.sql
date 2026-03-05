-- ============================================================================
-- GYMZ: Backfill missed member join notifications
-- Date: 2026-03-29
-- Run on demand. Idempotent: safe to run multiple times (dedupe_key prevents duplicates).
-- Source tables: membership (gym path), event_rsvps (event path)
-- ============================================================================

-- Run this script in Supabase SQL Editor or via psql.
-- Prerequisite: Migration 20260329_join_notifications_schema_and_backfill.sql must be applied.

BEGIN;

-- ─── 1. GYM PATH: Backfill from membership (active gym_access) ─────────────
-- Uses membership.created_at as notification created_at. Marks is_backfilled=true.
INSERT INTO public.notifications (
  user_id, gym_id, recipient_admin_id, type, message, title, metadata,
  dedupe_key, is_backfilled, created_at, priority, is_read, status,
  action_url, action_label
)
SELECT
  NULL,
  m.gym_id,
  adm.admin_id,
  'member_joined_gym',
  COALESCE(u.name, u.first_name, split_part(u.email, '@', 1), 'New Member')
    || ' joined ' || COALESCE(g.name, 'Gym') || ' (Gym) • ID: ' || COALESCE(m.unique_member_id, u.unique_id, '—'),
  'New Gym Member',
  jsonb_build_object(
    'member_id', m.user_id,
    'user_id', m.user_id,
    'membership_type', 'gym_access',
    'join_source_path', 'gym',
    'join_record_id', m.id
  ),
  'join_gym:' || m.gym_id || ':' || m.user_id || ':' || m.id || ':' || adm.admin_id,
  true,
  m.created_at,
  3,
  false,
  'unread',
  '/members?search=' || m.user_id,
  'View Member'
FROM public.membership m
JOIN public.users u ON u.id = m.user_id
JOIN public.gyms g ON g.id = m.gym_id
CROSS JOIN LATERAL (
  SELECT admin_id FROM public.get_gym_admin_ids(m.gym_id)
) adm
WHERE m.membership_status = 'active'
  AND m.access_mode = 'gym_access'
  AND m.created_at IS NOT NULL
ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

-- Fallback for gyms with no admins (insert one per join with recipient_admin_id=NULL)
INSERT INTO public.notifications (
  user_id, gym_id, recipient_admin_id, type, message, title, metadata,
  dedupe_key, is_backfilled, created_at, priority, is_read, status,
  action_url, action_label
)
SELECT
  NULL,
  m.gym_id,
  NULL,
  'member_joined_gym',
  COALESCE(u.name, u.first_name, split_part(u.email, '@', 1), 'New Member')
    || ' joined ' || COALESCE(g.name, 'Gym') || ' (Gym) • ID: ' || COALESCE(m.unique_member_id, u.unique_id, '—'),
  'New Gym Member',
  jsonb_build_object(
    'member_id', m.user_id,
    'user_id', m.user_id,
    'membership_type', 'gym_access',
    'join_source_path', 'gym',
    'join_record_id', m.id
  ),
  'join_gym:' || m.gym_id || ':' || m.user_id || ':' || m.id || ':fallback',
  true,
  m.created_at,
  3,
  false,
  'unread',
  '/members?search=' || m.user_id,
  'View Member'
FROM public.membership m
JOIN public.users u ON u.id = m.user_id
JOIN public.gyms g ON g.id = m.gym_id
WHERE m.membership_status = 'active'
  AND m.access_mode = 'gym_access'
  AND m.created_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.get_gym_admin_ids(m.gym_id) LIMIT 1)
ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;


-- ─── 2. EVENT PATH: Backfill from event_rsvps (confirmed/waitlisted) ───────
INSERT INTO public.notifications (
  user_id, gym_id, recipient_admin_id, type, message, title, metadata,
  dedupe_key, is_backfilled, created_at, priority, is_read, status,
  action_url, action_label
)
SELECT
  NULL,
  er.gym_id,
  adm.admin_id,
  'member_joined_event',
  COALESCE(u.name, 'A member')
    || ' signed up for ' || COALESCE(e.title, 'Event') || ' at ' || COALESCE(g.name, 'Gym') || ' • ID: ' || COALESCE(u.unique_id, '—'),
  'New Event Sign-up',
  jsonb_build_object(
    'member_id', er.user_id,
    'user_id', er.user_id,
    'event_id', er.event_id,
    'join_source_path', 'event',
    'join_record_id', er.id
  ),
  'join_event:' || er.gym_id || ':' || er.user_id || ':' || er.event_id || ':' || er.id || ':' || adm.admin_id,
  true,
  er.created_at,
  3,
  false,
  'unread',
  '/admin/event-rsvps',
  'View Sign-ups'
FROM public.event_rsvps er
JOIN public.users u ON u.id = er.user_id
JOIN public.events e ON e.id = er.event_id
JOIN public.gyms g ON g.id = er.gym_id
CROSS JOIN LATERAL (
  SELECT admin_id FROM public.get_gym_admin_ids(er.gym_id)
) adm
WHERE er.status IN ('confirmed', 'waitlisted')
  AND er.created_at IS NOT NULL
ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

-- Fallback for gyms with no admins
INSERT INTO public.notifications (
  user_id, gym_id, recipient_admin_id, type, message, title, metadata,
  dedupe_key, is_backfilled, created_at, priority, is_read, status,
  action_url, action_label
)
SELECT
  NULL,
  er.gym_id,
  NULL,
  'member_joined_event',
  COALESCE(u.name, 'A member')
    || ' signed up for ' || COALESCE(e.title, 'Event') || ' at ' || COALESCE(g.name, 'Gym') || ' • ID: ' || COALESCE(u.unique_id, '—'),
  'New Event Sign-up',
  jsonb_build_object(
    'member_id', er.user_id,
    'user_id', er.user_id,
    'event_id', er.event_id,
    'join_source_path', 'event',
    'join_record_id', er.id
  ),
  'join_event:' || er.gym_id || ':' || er.user_id || ':' || er.event_id || ':' || er.id || ':fallback',
  true,
  er.created_at,
  3,
  false,
  'unread',
  '/admin/event-rsvps',
  'View Sign-ups'
FROM public.event_rsvps er
JOIN public.users u ON u.id = er.user_id
JOIN public.events e ON e.id = er.event_id
JOIN public.gyms g ON g.id = er.gym_id
WHERE er.status IN ('confirmed', 'waitlisted')
  AND er.created_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.get_gym_admin_ids(er.gym_id) LIMIT 1)
ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;


-- ─── 3. EVENT ACCESS PATH: Users with event_access who never RSVP'd ────────
-- These joined via AccessModeSelection (gym_id + event_access) but have no membership row
-- and no event_rsvp. Source: users where access_mode='event_access', gym_id set.
-- We use users.updated_at or created_at as proxy for join time.
INSERT INTO public.notifications (
  user_id, gym_id, recipient_admin_id, type, message, title, metadata,
  dedupe_key, is_backfilled, created_at, priority, is_read, status,
  action_url, action_label
)
SELECT
  NULL,
  u.gym_id,
  adm.admin_id,
  'member_joined_event',
  COALESCE(u.name, u.first_name, split_part(u.email, '@', 1), 'New Member')
    || ' joined ' || COALESCE(g.name, 'Gym') || ' (Event) • ID: ' || COALESCE(u.unique_id, '—'),
  'New Event Sign-up',
  jsonb_build_object(
    'member_id', u.id,
    'user_id', u.id,
    'event_id', NULL,
    'join_source_path', 'event_access',
    'join_record_id', u.id
  ),
  'join_event:' || u.gym_id || ':' || u.id || '::' || u.id || ':' || adm.admin_id,
  true,
  COALESCE(u.updated_at, u.created_at, NOW()),
  3,
  false,
  'unread',
  '/members?search=' || u.id,
  'View Member'
FROM public.users u
JOIN public.gyms g ON g.id = u.gym_id
CROSS JOIN LATERAL (
  SELECT admin_id FROM public.get_gym_admin_ids(u.gym_id)
) adm
WHERE u.gym_id IS NOT NULL
  AND COALESCE(u.access_mode, 'gym_access') = 'event_access'
  AND (u.role = 'member' OR u.role IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.membership m
    WHERE m.user_id = u.id AND m.gym_id = u.gym_id AND m.access_mode = 'event_access'
  )
ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

COMMIT;

-- Summary: Run "SELECT COUNT(*) FROM notifications WHERE is_backfilled = true AND type IN ('member_joined_gym', 'member_joined_event');" to verify.
