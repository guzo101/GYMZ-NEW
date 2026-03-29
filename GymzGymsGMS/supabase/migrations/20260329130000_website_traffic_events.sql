-- First-party marketing site page views (ingested via Edge Function). OAC read-only.
create table if not exists public.website_traffic_events (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  referrer text,
  session_id text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists website_traffic_events_created_at_idx
  on public.website_traffic_events (created_at desc);
create index if not exists website_traffic_events_path_idx
  on public.website_traffic_events (path);

comment on table public.website_traffic_events is 'Anonymous page views from gymzandnutrition.com (marketing site); insert via Edge Function only.';

alter table public.website_traffic_events enable row level security;

-- Platform / super admins only (OAC dashboard)
drop policy if exists "website_traffic_events_platform_select" on public.website_traffic_events;
create policy "website_traffic_events_platform_select"
  on public.website_traffic_events
  for select
  to authenticated
  using (public.is_platform_admin());

-- No direct client inserts; service role (Edge Function) bypasses RLS
