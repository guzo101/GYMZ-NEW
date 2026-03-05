-- ============================================================================
-- GYMZ RETENTION ENGINE: FINAL VARIABLE HARMONIZATION
-- Date: 2026-03-03
-- Purpose: 
-- 1. Add record-tracking (Highest Streak).
-- 2. Enable temporary XP multipliers (Boosts).
-- 3. Track mascot personality state.
-- ============================================================================

BEGIN;

-- 1. Enhance User Behavior Metrics with Gamification records
ALTER TABLE public.user_behavior_metrics
ADD COLUMN IF NOT EXISTS highest_streak_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS xp_boost_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS personality_depth_score INTEGER DEFAULT 1, -- Tracks how much Coach Z "knows" the user
ADD COLUMN IF NOT EXISTS last_tonal_interaction TEXT DEFAULT 'hype'; -- 'hype', 'guilt', 'scientific'

-- 2. Update the track_user_retention_activity function to handle Highest Streak
CREATE OR REPLACE FUNCTION public.track_user_retention_activity(
    p_user_id UUID,
    p_activity_type TEXT -- 'meal', 'workout'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_metrics RECORD;
    v_new_streak INTEGER;
    v_xp_reward INTEGER := 10; -- Base XP
    v_is_new_day BOOLEAN := FALSE;
    v_xp_multiplier FLOAT := 1.0;
BEGIN
    -- 1. Lock and Get Metrics
    SELECT * INTO v_metrics 
    FROM public.user_behavior_metrics 
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.user_behavior_metrics (user_id) 
        VALUES (p_user_id) 
        RETURNING * INTO v_metrics;
    END IF;

    -- 2. Check for Active XP Boost
    IF v_metrics.xp_boost_expires_at IS NOT NULL AND v_metrics.xp_boost_expires_at > NOW() THEN
        v_xp_multiplier := 2.0;
    END IF;

    -- 3. Pulse Streak Calculation Logic
    IF v_metrics.last_log_at IS NULL THEN
        v_is_new_day := TRUE;
        v_new_streak := 1;
    ELSIF v_metrics.last_log_at < CURRENT_DATE THEN
        v_is_new_day := TRUE;
        IF v_metrics.last_log_at >= (CURRENT_DATE - INTERVAL '1 day') THEN
            v_new_streak := v_metrics.pulse_streak_count + 1;
        ELSE
            IF v_metrics.recovery_shields_remaining > 0 THEN
                v_new_streak := v_metrics.pulse_streak_count + 1;
                UPDATE public.user_behavior_metrics SET recovery_shields_remaining = recovery_shields_remaining - 1 WHERE user_id = p_user_id;
                INSERT INTO public.retention_events (user_id, event_type, message, priority) VALUES (p_user_id, 'pulse_boost', '🛡️ Recovery Shield used! Coach Z saved your streak.', 2);
            ELSE
                v_new_streak := 1;
            END IF;
        END IF;
    ELSE
        v_is_new_day := FALSE;
        v_new_streak := v_metrics.pulse_streak_count;
    END IF;

    -- 4. Milestone Detection
    IF v_is_new_day AND (v_new_streak % 7 = 0) THEN
        INSERT INTO public.retention_events (user_id, event_type, message, priority, metadata)
        VALUES (p_user_id, 'milestone', '🏆 ' || v_new_streak || ' Day Streak! You are unstoppable.', 2, jsonb_build_object('streak', v_new_streak));
        v_xp_reward := v_xp_reward + 50;
    END IF;

    -- 5. Final Atomic Update
    UPDATE public.user_behavior_metrics
    SET 
        pulse_streak_count = v_new_streak,
        highest_streak_count = GREATEST(highest_streak_count, v_new_streak),
        last_log_at = NOW(),
        total_xp = total_xp + (v_xp_reward * v_xp_multiplier),
        consecutive_gym_days = CASE WHEN p_activity_type = 'workout' AND v_is_new_day THEN consecutive_gym_days + 1 ELSE consecutive_gym_days END,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'new_streak', v_new_streak,
        'xp_gained', (v_xp_reward * v_xp_multiplier),
        'is_new_day', v_is_new_day,
        'multiplier_active', v_xp_multiplier > 1.0
    );
END;
$$;

COMMIT;
