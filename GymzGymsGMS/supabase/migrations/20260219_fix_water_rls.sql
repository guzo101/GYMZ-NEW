-- =====================================================
-- FIX: WATER TRACKING PERSISTENCE & TURBO SYNC
-- =====================================================

-- 1. Fix RLS policies for water_logs
-- Ensure the table exists and RLS is on
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'water_logs') THEN
        ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
        
        -- Drop potentially broken policies
        DROP POLICY IF EXISTS "Users can view own water logs" ON public.water_logs;
        DROP POLICY IF EXISTS "Users can insert own water logs" ON public.water_logs;
        DROP POLICY IF EXISTS "Users can update own water logs" ON public.water_logs;
        DROP POLICY IF EXISTS "Users can delete own water logs" ON public.water_logs;
        
        -- Re-apply clean policies
        CREATE POLICY "Users can view own water logs" ON public.water_logs
            FOR SELECT USING (auth.uid() = user_id);
            
        CREATE POLICY "Users can insert own water logs" ON public.water_logs
            FOR INSERT WITH CHECK (auth.uid() = user_id);
            
        CREATE POLICY "Users can update own water logs" ON public.water_logs
            FOR UPDATE USING (auth.uid() = user_id);
            
        CREATE POLICY "Users can delete own water logs" ON public.water_logs
            FOR DELETE USING (auth.uid() = user_id);

        RAISE NOTICE 'Refreshed RLS policies for water_logs';
    END IF;
END $$;

-- 2. Update get_unified_app_data RPC to include water_logs table
CREATE OR REPLACE FUNCTION public.get_unified_app_data(p_user_id UUID, p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_start_of_day TIMESTAMPTZ := p_date::timestamptz;
    v_end_of_day TIMESTAMPTZ := (p_date + interval '1 day')::timestamptz - interval '1 microsecond';
    v_water_total INTEGER;
BEGIN
    -- Calculate water total from BOTH modern (water_logs) and legacy (daily_nutrition_logs) sources
    v_water_total := (
        COALESCE((
            SELECT SUM(amount) 
            FROM public.water_logs 
            WHERE user_id = p_user_id AND date = p_date
        ), 0)
        +
        COALESCE((
            SELECT SUM(quantity) 
            FROM public.daily_nutrition_logs 
            WHERE user_id = p_user_id 
            AND food_name = 'Water Intake'
            AND logged_at >= v_start_of_day 
            AND logged_at <= v_end_of_day
        ), 0)
    );

    SELECT jsonb_build_object(
        'profile', (
            SELECT to_jsonb(u) FROM public.users u WHERE u.id = p_user_id
        ),
        'nutrition', (
            SELECT jsonb_build_object(
                'today_calories', COALESCE(SUM(calories) FILTER (WHERE food_name != 'Water Intake'), 0),
                'today_water', v_water_total,
                'logs', COALESCE(jsonb_agg(l) FILTER (WHERE l.id IS NOT NULL), '[]'::jsonb)
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
