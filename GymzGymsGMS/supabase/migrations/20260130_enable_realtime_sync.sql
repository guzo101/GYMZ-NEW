-- Enable Realtime for key tables to ensure the app stays in sync with GMS changes
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.payments;
