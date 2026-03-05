-- MEGA SCHEMA SYNC - Ensure all possible columns exist to prevent Query Failures
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS membership_expiry DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS renewal_due_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_payment_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS join_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS unique_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_duration_months numeric;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age numeric;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fitness_goal text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weight text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS height text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS level_label text DEFAULT 'Member';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS points numeric DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS streak numeric DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS primary_objective text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS secondary_objective text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS areas_of_caution text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS intensity_clearance text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_training_styles text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trainer_preference text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_training_env text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS availability text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS travel_frequency text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS body_fat_pct text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS waist text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS resting_hr text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS blood_pressure text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS privacy_progress boolean DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notif_session_reminders boolean DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notif_checkin boolean DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notif_program_updates boolean DEFAULT true;

-- Reload cache
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');

DO $$ 
BEGIN 
    RAISE NOTICE 'Mega Schema Sync completed.';
END $$;
