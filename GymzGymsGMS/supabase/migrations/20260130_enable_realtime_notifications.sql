-- Enable Realtime for notifications to ensure GMS picks up changes immediately
alter publication supabase_realtime add table public.notifications;
