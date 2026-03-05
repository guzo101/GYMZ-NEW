-- ============================================================================
-- GYMZ RETENTION ENGINE: BEHAVIORAL SIGNALS & PULSE STREAKS
-- Date: 2026-03-03
-- Purpose: 
-- 1. Track user consistency (Pulse Streak).
-- 2. Enable recovery logic (Recovery Shields).
-- 3. Log retention events for real-time app nudges.
-- ============================================================================

BEGIN;

-- ─── 1. BEHAVIOR METRICS TABLE ──────────────────────────────────────────────
-- Tracks the long-term habit data for each user.
CREATE TABLE IF NOT EXISTS public.user_behavior_metrics (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    pulse_streak_count INTEGER DEFAULT 0,
    last_log_at TIMESTAMPTZ,
    prime_motivation_time TIME, -- Calculated from historical logs
    total_xp INTEGER DEFAULT 0,
    consecutive_gym_days INTEGER DEFAULT 0,
    recovery_shields_remaining INTEGER DEFAULT 2,
    last_processed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_behavior_metrics ENABLE ROW LEVEL SECURITY;

-- Users can only see their own metrics
DROP POLICY IF EXISTS "Users can view own behavior metrics" ON public.user_behavior_metrics;
CREATE POLICY "Users can view own behavior metrics" ON public.user_behavior_metrics
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can see all metrics for their gym
DROP POLICY IF EXISTS "Gym admins view their gym metrics" ON public.user_behavior_metrics;
CREATE POLICY "Gym admins view their gym metrics" ON public.user_behavior_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users admin_u
            WHERE admin_u.id = auth.uid()
            AND admin_u.role IN ('admin', 'super_admin')
            AND admin_u.gym_id = (SELECT target_u.gym_id FROM public.users target_u WHERE target_u.id = user_behavior_metrics.user_id)
        )
    );

-- ─── 2. RETENTION EVENTS TABLE ───────────────────────────────────────────────
-- Queue for real-time nudges and popups.
CREATE TABLE IF NOT EXISTS public.retention_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'streak_risk', 'milestone', 'comeback', 'pulse_boost'
    message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    priority INTEGER DEFAULT 3, -- 1 = Critical (iPhone Toast), 2 = High (Duolingo Card), 3 = Info
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.retention_events ENABLE ROW LEVEL SECURITY;

-- Users see their own events
DROP POLICY IF EXISTS "Users view own retention events" ON public.retention_events;
CREATE POLICY "Users view own retention events" ON public.retention_events
    FOR SELECT USING (auth.uid() = user_id);

-- Users can acknowledge their own events
DROP POLICY IF EXISTS "Users update own retention events" ON public.retention_events;
CREATE POLICY "Users update own retention events" ON public.retention_events
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── 3. AUTOMATIC METRICS INITIALIZATION ───────────────────────────────────
-- Ensures new users get a metrics record on signup.
CREATE OR REPLACE FUNCTION public.init_user_behavior_metrics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_behavior_metrics (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_user_behavior_metrics ON public.users;
CREATE TRIGGER trg_init_user_behavior_metrics
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.init_user_behavior_metrics();

-- Backfill existing users
INSERT INTO public.user_behavior_metrics (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
