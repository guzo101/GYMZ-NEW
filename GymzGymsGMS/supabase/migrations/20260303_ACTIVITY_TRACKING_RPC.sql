-- ============================================================================
-- GYMZ RETENTION ENGINE: ACTIVITY TRACKING RPC (FIXED)
-- Date: 2026-03-03
-- Purpose: 
-- 1. Automate daily streak calculation with first-log safety.
-- 2. Award XP and handle recovery shields correctly.
-- 3. Trigger retention events (milestones/streaks).
-- ============================================================================

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

    -- 2. Pulse Streak Calculation Logic
    IF v_metrics.last_log_at IS NULL THEN
        -- First time logging EVER - Start at 1
        v_is_new_day := TRUE;
        v_new_streak := 1;
    ELSIF v_metrics.last_log_at < CURRENT_DATE THEN
        -- It's a new day (since last log was before today)
        v_is_new_day := TRUE;
        
        -- Check if last log was YESTERDAY to continue streak
        IF v_metrics.last_log_at >= (CURRENT_DATE - INTERVAL '1 day') THEN
            v_new_streak := v_metrics.pulse_streak_count + 1;
        ELSE
            -- Streak broken (> 48 hours lapse) - try to use recovery shield
            IF v_metrics.recovery_shields_remaining > 0 THEN
                v_new_streak := v_metrics.pulse_streak_count + 1;
                
                -- Consume shield
                UPDATE public.user_behavior_metrics 
                SET recovery_shields_remaining = recovery_shields_remaining - 1
                WHERE user_id = p_user_id;
                
                -- Log shield usage event for the UI to show
                INSERT INTO public.retention_events (user_id, event_type, message, priority)
                VALUES (p_user_id, 'pulse_boost', '🛡️ Recovery Shield used! Coach Z saved your streak.', 2);
            ELSE
                -- No shields left - restart
                v_new_streak := 1;
            END IF;
        END IF;
    ELSE
        -- Already logged TODAY - maintain current streak but still grant XP
        v_is_new_day := FALSE;
        v_new_streak := v_metrics.pulse_streak_count;
    END IF;

    -- 3. Milestone Detection (Award bonus every 7 days)
    IF v_is_new_day AND (v_new_streak % 7 = 0) THEN
        INSERT INTO public.retention_events (user_id, event_type, message, priority, metadata)
        VALUES (
            p_user_id, 
            'milestone', 
            '🏆 ' || v_new_streak || ' Day Streak! You are unstoppable.', 
            2,
            jsonb_build_object('streak', v_new_streak)
        );
        v_xp_reward := v_xp_reward + 50; -- Milestone Bonus XP
    END IF;

    -- 4. Final Atomic Update
    UPDATE public.user_behavior_metrics
    SET 
        pulse_streak_count = v_new_streak,
        last_log_at = NOW(),
        total_xp = total_xp + v_xp_reward,
        consecutive_gym_days = CASE 
            WHEN p_activity_type = 'workout' AND v_is_new_day THEN consecutive_gym_days + 1 
            ELSE consecutive_gym_days 
        END,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'new_streak', v_new_streak,
        'xp_gained', v_xp_reward,
        'is_new_day', v_is_new_day
    );
END;
$$;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.track_user_retention_activity(UUID, TEXT) TO authenticated;
