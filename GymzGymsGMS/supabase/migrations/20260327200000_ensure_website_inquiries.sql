-- Ensures marketing lead table exists for Edge Function submit-website-inquiry.
-- Uses gen_random_uuid() (PG13+) so uuid-ossp is not required.
create table if not exists public.website_inquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  interest text,
  preferred_contact text,
  message text,
  gym_name text,
  gym_location text,
  approx_members text,
  status text not null default 'new',
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create index if not exists website_inquiries_status_idx on public.website_inquiries (status);
create index if not exists website_inquiries_created_idx on public.website_inquiries (created_at desc);

comment on table public.website_inquiries is 'Inbound leads captured from the public website';
