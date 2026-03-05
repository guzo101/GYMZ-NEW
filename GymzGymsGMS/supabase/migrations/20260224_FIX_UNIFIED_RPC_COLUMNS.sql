-- =====================================================
-- FIX: UNIFIED RPC COLUMN MISMATCH (log_id)
-- Date: 2026-02-24
-- =====================================================

BEGIN;

-- Redefine get_unified_app_data with correct column references
CREATE OR REPLACE FUNCTION public.get_unified_app_data(p_user_id UUID, p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_start_of_day TIMESTAMPTZ := p_date::timestamptz;
    v_end_of_day TIMESTAMPTZ := (p_date + interval '1 day')::timestamptz - interval '1 microsecond';
BEGIN
    SELECT jsonb_build_object(
        'profile', (
            SELECT jsonb_build_object(
                'id', u.id,
                'email', u.email,
                'name', u.name,
                'unique_id', u.unique_id,
                'gym_id', u.gym_id,
                'membership_status', u.membership_status,
                'membership_type', u.membership_type,
                'access_mode', u.access_mode,
                'avatar_url', u.avatar_url,
                'renewal_due_date', u.renewal_due_date,
                'weight_lost', u.weight_lost,
                'height', u.height,
                'weight', u.weight,
                'age', u.age,
                'gender', u.gender,
                'goal', u.goal
            ) FROM public.users u WHERE u.id = p_user_id
        ),
        'nutrition', (
            SELECT jsonb_build_object(
                'today_calories', COALESCE(SUM(calories) FILTER (WHERE food_name != 'Water Intake'), 0),
                'today_water', COALESCE(SUM(quantity) FILTER (WHERE food_name = 'Water Intake'), 0),
                'logs', COALESCE(jsonb_agg(l) FILTER (WHERE l.log_id IS NOT NULL), '[]'::jsonb) -- FIXED: id -> log_id
            )
            FROM public.daily_nutrition_logs l
            WHERE l.user_id = p_user_id 
            AND l.logged_at >= v_start_of_day 
            AND l.logged_at <= v_end_of_day
        ),
        'gamification', (
            SELECT jsonb_build_object(
                'total_xp', COALESCE(SUM(points), 0),
                'level', GREATEST(1, FLOOR(COALESCE(SUM(points), 0) / 1000) + 1),
                'rank', (SELECT rank FROM public.leaderboard_data WHERE user_id = p_user_id LIMIT 1),
                'total_points', (SELECT total_points FROM public.leaderboard_data WHERE user_id = p_user_id LIMIT 1)
            )
            FROM public.xp_transactions
            WHERE user_id = p_user_id
        ),
        'fitness', (
            SELECT jsonb_build_object(
                'workout_count', (SELECT COUNT(DISTINCT session_id) FROM public.workout_sessions WHERE user_id = p_user_id),
                'today_minutes', COALESCE((SELECT SUM(duration) FROM public.workout_sessions WHERE user_id = p_user_id AND completed_at >= v_start_of_day AND completed_at <= v_end_of_day), 0),
                'active_goal', (SELECT to_jsonb(g) FROM public.user_fitness_goals g WHERE g.user_id = p_user_id AND g.is_active = true LIMIT 1),
                'room_count', (SELECT COUNT(*) FROM public.room_members WHERE user_id = p_user_id),
                'attendance', (
                    SELECT jsonb_build_object(
                        'streak', COALESCE((SELECT current_streak FROM public.user_streaks WHERE user_id = p_user_id AND streak_type = 'workout' LIMIT 1), 0),
                        'weekly_count', COALESCE((SELECT total_workouts FROM public.weekly_progress_summary WHERE user_id = p_user_id AND week_start_date = date_trunc('week', p_date::timestamp)::date LIMIT 1), 0)
                    )
                )
            )
        ),
        'calendar', (
            SELECT COALESCE(jsonb_agg(s), '[]'::jsonb)
            FROM (
                SELECT 
                    ucs.id,
                    jsonb_build_object(
                        'id', gcs.id,
                        'date', gcs.date,
                        'start_time', gcs.start_time,
                        'gym_classes', to_jsonb(gc)
                    ) as gym_class_schedules
                FROM public.user_calendar_selections ucs
                LEFT JOIN public.gym_class_schedules gcs ON ucs.schedule_id = gcs.id
                LEFT JOIN public.gym_classes gc ON gcs.class_id = gc.id
                WHERE ucs.user_id = p_user_id
                AND gcs.date >= p_date
                ORDER BY gcs.date ASC, gcs.start_time ASC
                LIMIT 10
            ) s
        ),
        'timestamp', NOW()
    ) INTO v_result;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Ensure permissions are solid
GRANT EXECUTE ON FUNCTION public.get_unified_app_data(UUID, DATE) TO authenticated;

COMMIT;
