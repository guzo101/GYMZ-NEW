-- Structured waitlist / owner fields (also forwarded to Make via Edge Function row payload)
alter table public.website_inquiries
  add column if not exists gym_name text,
  add column if not exists gym_location text,
  add column if not exists approx_members text;

comment on column public.website_inquiries.gym_name is 'Gym or business name (e.g. owner waitlist)';
comment on column public.website_inquiries.gym_location is 'City/region';
comment on column public.website_inquiries.approx_members is 'Approx. active members (free text)';
