-- =====================================================
-- Migration: AI-Powered Gym Retention System
-- Date: 2026-02-14
-- Purpose: Complete database schema for gym retention with AI Chat
-- =====================================================

-- =====================================================
-- SECTION 1: EXTEND USERS TABLE
-- Add gym schedule detection and notification preferences
-- =====================================================

-- Gym tracking fields
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS typical_gym_days INT[];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS typical_gym_time TIME;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_gym_visit TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_gym_visits INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Nairobi';

-- Notification preference fields
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gym_visit_reminders BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nutrition_reminders BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS workout_log_reminders BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_chat_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS streak_protection_enabled BOOLEAN DEFAULT TRUE;

-- Quiet hours (JSON format: {"start": "22:00", "end": "07:00"})
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS quiet_hours JSONB DEFAULT '{"start": "22:00", "end": "07:00"}';

-- User engagement metadata
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_notification_sent TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_ai_chat_message TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notification_touchpoints_today INT DEFAULT 0;

COMMENT ON COLUMN public.users.typical_gym_days IS 'Array of weekdays user typically goes to gym (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN public.users.typical_gym_time IS 'Typical time user goes to gym (calculated from check-in history)';
COMMENT ON COLUMN public.users.quiet_hours IS 'JSON object with start/end times for quiet hours (no notifications)';

-- =====================================================
-- SECTION 2: AI CHAT HISTORY TABLE
-- Store all AI Chat conversations and proactive messages
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    message_type VARCHAR(50) NOT NULL,  -- 'ai_proactive', 'ai_response', 'user_message'
    content TEXT NOT NULL,
    template_used VARCHAR(100),  -- Template ID if using template
    context JSONB,  -- User data at time of message (streak, gym visits, etc)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    read_at TIMESTAMPTZ,
    
    -- Metadata for admin monitoring
    token_count INT,  -- Number of tokens used (for cost tracking)
    llm_model VARCHAR(50),  -- e.g., 'gpt-4', 'gpt-3.5-turbo'
    generation_time_ms INT,  -- How long AI took to respond
    cost_usd DECIMAL(10, 6),  -- Actual cost of this message
    
    CONSTRAINT valid_message_type CHECK (message_type IN ('ai_proactive', 'ai_response', 'user_message'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_user_date ON public.ai_chat_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_type ON public.ai_chat_history(message_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_unread ON public.ai_chat_history(user_id, read_at) WHERE read_at IS NULL;

COMMENT ON TABLE public.ai_chat_history IS 'Complete history of AI Chat interactions for engagement and cost tracking';

-- =====================================================
-- SECTION 3: NOTIFICATIONS SENT TABLE
-- Track all engagement touchpoints (push + AI chat)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.notifications_sent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    notification_type VARCHAR(50) NOT NULL,  -- 'gym_visit_reminder', 'post_workout', etc
    channel VARCHAR(20) NOT NULL,  -- 'push', 'ai_chat'
    sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    scheduled_for TIMESTAMPTZ,  -- When it was scheduled to send
    opened_at TIMESTAMPTZ,
    clicked BOOLEAN DEFAULT FALSE,
    template_used TEXT,  -- The actual template content sent
    context JSONB,  -- Data used to populate template (streak, gym visits, etc)
    
    -- Delivery metadata
    delivery_status VARCHAR(20) DEFAULT 'sent',  -- 'sent', 'failed', 'pending'
    failure_reason TEXT,
    expo_push_id VARCHAR(100),  -- Expo push notification ID
    
    CONSTRAINT valid_channel CHECK (channel IN ('push', 'ai_chat')),
    CONSTRAINT valid_status CHECK (delivery_status IN ('sent', 'failed', 'pending'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_date ON public.notifications_sent(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications_sent(notification_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON public.notifications_sent(channel, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_today ON public.notifications_sent(user_id, sent_at);

COMMENT ON TABLE public.notifications_sent IS 'Complete log of all engagement touchpoints for analytics and anti-spam';

-- =====================================================
-- SECTION 4: USER_STREAKS TABLE
-- Create if not exists, simplify if exists, remove gamification
-- =====================================================

-- Create user_streaks table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    streak_type VARCHAR(50) NOT NULL,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_activity_date DATE,
    streak_start_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, streak_type),
    CONSTRAINT user_streaks_streak_type_check 
        CHECK (streak_type IN ('workout', 'nutrition_log', 'check_in', 'water_intake', 'class_attendance', 'gym_visit'))
);

-- If table already existed, remove gamification columns
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_streaks') THEN
        -- Remove gamification columns if they exist
        ALTER TABLE public.user_streaks DROP COLUMN IF EXISTS xp_earned;
        ALTER TABLE public.user_streaks DROP COLUMN IF EXISTS level;
        ALTER TABLE public.user_streaks DROP COLUMN IF EXISTS points;
        ALTER TABLE public.user_streaks DROP COLUMN IF EXISTS badges;
        
        -- Ensure essential columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'user_streaks' AND column_name = 'current_streak') THEN
            ALTER TABLE public.user_streaks ADD COLUMN current_streak INT DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'user_streaks' AND column_name = 'longest_streak') THEN
            ALTER TABLE public.user_streaks ADD COLUMN longest_streak INT DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'user_streaks' AND column_name = 'last_activity_date') THEN
            ALTER TABLE public.user_streaks ADD COLUMN last_activity_date DATE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'user_streaks' AND column_name = 'streak_start_date') THEN
            ALTER TABLE public.user_streaks ADD COLUMN streak_start_date DATE;
        END IF;
        
        -- Update constraint to include gym_visit
        ALTER TABLE public.user_streaks DROP CONSTRAINT IF EXISTS user_streaks_streak_type_check;
        ALTER TABLE public.user_streaks ADD CONSTRAINT user_streaks_streak_type_check 
            CHECK (streak_type IN ('workout', 'nutrition_log', 'check_in', 'water_intake', 'class_attendance', 'gym_visit'));
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_type ON public.user_streaks(user_id, streak_type);

COMMENT ON TABLE public.user_streaks IS 'Simplified streak tracking focused on habit formation (no gamification)';

-- =====================================================
-- SECTION 5: ADMIN NOTIFICATION CONTROL TABLES
-- Allow admins to control AI messages and notifications
-- =====================================================

-- Notification templates that admins can edit
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key VARCHAR(100) UNIQUE NOT NULL,  -- 'gym_visit_reminder_1', 'post_workout_1', etc
    category VARCHAR(50) NOT NULL,  -- 'gym_visit', 'nutrition', 'streak', 're_engagement'
    channel VARCHAR(20) NOT NULL,  -- 'push', 'ai_chat', 'both'
    content TEXT NOT NULL,  -- Template with variables like {streak}, {gym_visits_week}
    enabled BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 3,  -- 1=highest, 5=lowest
    
    -- A/B testing support
    variant VARCHAR(10) DEFAULT 'A',  -- 'A', 'B', 'control'
    
    -- Metadata
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    usage_count INT DEFAULT 0,
    
    CONSTRAINT valid_template_channel CHECK (channel IN ('push', 'ai_chat', 'both'))
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON public.notification_templates(category, enabled);
CREATE INDEX IF NOT EXISTS idx_templates_key ON public.notification_templates(template_key);

COMMENT ON TABLE public.notification_templates IS 'Admin-editable notification templates for complete control over messaging';

-- Notification rules that admins can toggle
CREATE TABLE IF NOT EXISTS public.notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key VARCHAR(100) UNIQUE NOT NULL,  -- 'missed_gym_day', 'lapsed_7_days', etc
    rule_name VARCHAR(200) NOT NULL,  -- Human-readable name
    description TEXT,  -- What this rule does
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Trigger conditions
    trigger_type VARCHAR(50) NOT NULL,  -- 'time_based', 'behavior_based', 'pattern_based'
    trigger_config JSONB NOT NULL,  -- Configuration for when to trigger
    
    -- Actions
    action_type VARCHAR(50) NOT NULL,  -- 'send_notification', 'ai_chat_proactive', 'both'
    template_ids UUID[],  -- Which templates to use (randomly selected)
    
    -- Frequency limits
    max_per_day INT DEFAULT 1,
    max_per_week INT DEFAULT 7,
    min_hours_between INT DEFAULT 2,
    
    -- Metadata
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_trigger CHECK (trigger_type IN ('time_based', 'behavior_based', 'pattern_based')),
    CONSTRAINT valid_action CHECK (action_type IN ('send_notification', 'ai_chat_proactive', 'both'))
);

CREATE INDEX IF NOT EXISTS idx_rules_enabled ON public.notification_rules(enabled);

COMMENT ON TABLE public.notification_rules IS 'Admin-controlled rules for when and how to engage users';

-- =====================================================
-- SECTION 6: PERFORMANCE INDEXES
-- Critical indexes for query optimization
-- =====================================================

-- User gym tracking
CREATE INDEX IF NOT EXISTS idx_users_last_gym_visit ON public.users(last_gym_visit) WHERE last_gym_visit IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_typical_gym_days ON public.users USING GIN(typical_gym_days) WHERE typical_gym_days IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_gym_reminders ON public.users(id) WHERE gym_visit_reminders = TRUE;

-- Attendance logs (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_checkin ON public.attendance_logs(user_id, checkin_time DESC);
        CREATE INDEX IF NOT EXISTS idx_attendance_logs_recent ON public.attendance_logs(checkin_time DESC);
    END IF;
END $$;

-- =====================================================
-- SECTION 7: ROW LEVEL SECURITY (RLS)
-- Security policies for new tables
-- =====================================================

-- AI Chat History RLS
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat history" ON public.ai_chat_history;
CREATE POLICY "Users can view own chat history" 
ON public.ai_chat_history FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own messages" ON public.ai_chat_history;
CREATE POLICY "Users can insert own messages" 
ON public.ai_chat_history FOR INSERT 
WITH CHECK (auth.uid() = user_id AND message_type = 'user_message');

DROP POLICY IF EXISTS "Admins can view all chat history" ON public.ai_chat_history;
CREATE POLICY "Admins can view all chat history" 
ON public.ai_chat_history FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
);

-- Notifications Sent RLS
ALTER TABLE public.notifications_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications_sent;
CREATE POLICY "Users can view own notifications" 
ON public.notifications_sent FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications_sent;
CREATE POLICY "Admins can view all notifications" 
ON public.notifications_sent FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
);

-- Notification Templates RLS (Admin-only)
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage templates" ON public.notification_templates;
CREATE POLICY "Admins can manage templates" 
ON public.notification_templates FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
);

-- Notification Rules RLS (Admin-only)
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage rules" ON public.notification_rules;
CREATE POLICY "Admins can manage rules" 
ON public.notification_rules FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
);

-- =====================================================
-- SECTION 8: HELPER FUNCTIONS
-- Utility functions for common operations
-- =====================================================

-- Function to reset daily touchpoint counter (call via cron job)
CREATE OR REPLACE FUNCTION reset_daily_touchpoints()
RETURNS void AS $$
BEGIN
    UPDATE public.users SET notification_touchpoints_today = 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_daily_touchpoints() IS 'Reset touchpoint counter daily at midnight (call via cron)';

-- Function to get user's notification stats
CREATE OR REPLACE FUNCTION get_user_notification_stats(p_user_id UUID)
RETURNS TABLE(
    total_sent INT,
    total_opened INT,
    open_rate DECIMAL,
    push_sent INT,
    ai_chat_sent INT,
    touchpoints_today INT,
    last_notification TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INT as total_sent,
        COUNT(opened_at)::INT as total_opened,
        CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(opened_at)::DECIMAL / COUNT(*)) * 100, 2) ELSE 0 END as open_rate,
        COUNT(*) FILTER (WHERE channel = 'push')::INT as push_sent,
        COUNT(*) FILTER (WHERE channel = 'ai_chat')::INT as ai_chat_sent,
        COALESCE((SELECT notification_touchpoints_today FROM users WHERE id = p_user_id), 0)::INT as touchpoints_today,
        MAX(sent_at) as last_notification
    FROM public.notifications_sent
    WHERE user_id = p_user_id
    AND sent_at >= NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can receive notification (anti-spam)
CREATE OR REPLACE FUNCTION can_send_notification(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_last_sent TIMESTAMPTZ;
    v_touchpoints_today INT;
    v_quiet_hours JSONB;
    v_current_time TIME;
BEGIN
    -- Get user data
    SELECT last_notification_sent, notification_touchpoints_today, quiet_hours, CURRENT_TIME
    INTO v_last_sent, v_touchpoints_today, v_quiet_hours, v_current_time
    FROM public.users
    WHERE id = p_user_id;
    
    -- Check if minimum 2 hours passed since last notification
    IF v_last_sent IS NOT NULL AND v_last_sent > NOW() - INTERVAL '2 hours' THEN
        RETURN FALSE;
    END IF;
    
    -- Check if max touchpoints per day reached (7)
    IF v_touchpoints_today >= 7 THEN
        RETURN FALSE;
    END IF;
    
    -- Check quiet hours
    IF v_quiet_hours IS NOT NULL THEN
        IF v_current_time BETWEEN (v_quiet_hours->>'start')::TIME AND (v_quiet_hours->>'end')::TIME THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECTION 9: SEED DEFAULT TEMPLATES
-- Insert initial notification templates
-- =====================================================

INSERT INTO public.notification_templates (template_key, category, channel, content, priority) VALUES
-- Gym Visit Reminders (Push)
('gym_visit_reminder_1', 'gym_visit', 'push', 'Your {time} gym slot is reserved. See you there? 💪', 2),
('gym_visit_reminder_2', 'gym_visit', 'push', 'It''s {day}! Your usual gym day. Stick to the routine? 💪', 2),
('gym_visit_reminder_3', 'gym_visit', 'push', 'Morning! The hardest part is showing up. You''ve got this. 🌅', 2),

-- Post-Workout (Push)
('post_workout_log_1', 'post_workout', 'push', 'Great session! 💪 Don''t forget to log your workout.', 2),
('post_workout_log_2', 'post_workout', 'push', 'You crushed it! 🔥 Log your workout while it''s fresh.', 2),
('post_workout_nutrition_1', 'post_workout', 'push', 'Recovery starts now! Log your post-workout meal. 🍗', 2),

-- Nutrition Reminders (Push)
('morning_nutrition_1', 'nutrition', 'push', 'Morning! Pre-workout fuel or breakfast? Log it. 🥑', 3),
('morning_nutrition_2', 'nutrition', 'push', 'Your gym performance starts with breakfast. What are you eating? 🍳', 3),
('lunch_nutrition_1', 'nutrition', 'push', 'Lunch break! Recovery nutrition matters. Log your meal. 🍽️', 3),
('dinner_nutrition_1', 'nutrition', 'push', 'Dinner time! End your day with good nutrition. Log it. 🌙', 3),

-- Streak Protection (Push)
('streak_danger_1', 'streak', 'push', 'Quick! Log one meal before midnight. Keep your streak alive! 🔥', 1),
('streak_danger_2', 'streak', 'push', 'Your {streak}-day logging streak is too valuable to lose. One quick entry?', 1),

-- AI Chat Proactive Messages
('ai_missed_gym_1', 'gym_visit', 'ai_chat', 'Hey! I noticed you usually hit the gym on {day} mornings. Everything okay? 💙', 2),
('ai_post_gym_1', 'post_workout', 'ai_chat', 'Saw you crushed a gym session! 💪 How''d it go? Log your workout?', 2),
('ai_no_log_1', 'nutrition', 'ai_chat', 'Hey! You haven''t logged anything today. Too busy or just forgot? Quick meal entry? 📝', 3),
('ai_lapsed_2d_1', 're_engagement', 'ai_chat', 'Haven''t heard from you in 2 days. Everything okay? 💙', 2),
('ai_lapsed_7d_1', 're_engagement', 'ai_chat', 'Real talk: It''s been a week. Are you still working toward your fitness goals? Let''s chat. 💙', 1),
('ai_streak_milestone_1', 'streak', 'ai_chat', '🔥 {streak} DAYS! 🔥 You''re building real consistency here. I''m proud of you!', 1)

ON CONFLICT (template_key) DO NOTHING;

COMMENT ON TABLE public.notification_templates IS 'Seeded with initial templates - admins can edit/disable via GMS dashboard';

-- =====================================================
-- SECTION 10: ANALYTICS VIEWS
-- Helpful views for admin dashboard
-- =====================================================

-- Daily notification stats
CREATE OR REPLACE VIEW admin_notification_stats_daily AS
SELECT 
    DATE(sent_at) as date,
    channel,
    notification_type,
    COUNT(*) as total_sent,
    COUNT(opened_at) as total_opened,
    ROUND((COUNT(opened_at)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2) as open_rate_percent,
    COUNT(DISTINCT user_id) as unique_users
FROM public.notifications_sent
WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(sent_at), channel, notification_type
ORDER BY DATE(sent_at) DESC, channel, notification_type;

-- AI Chat cost tracking
CREATE OR REPLACE VIEW admin_ai_chat_costs AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE message_type IN ('ai_proactive', 'ai_response')) as ai_messages,
    SUM(token_count) FILTER (WHERE message_type IN ('ai_proactive', 'ai_response')) as total_tokens,
    SUM(cost_usd) FILTER (WHERE message_type IN ('ai_proactive', 'ai_response')) as total_cost_usd,
    AVG(generation_time_ms) FILTER (WHERE message_type IN ('ai_proactive', 'ai_response')) as avg_generation_time
FROM public.ai_chat_history
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- User engagement summary
CREATE OR REPLACE VIEW admin_user_engagement_summary AS
SELECT 
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.last_gym_visit,
    u.total_gym_visits,
    u.typical_gym_days,
    COALESCE(ns.notifications_30d, 0) as notifications_sent_30d,
    COALESCE(ns.notifications_opened, 0) as notifications_opened_30d,
    COALESCE(ac.chat_messages_30d, 0) as ai_chat_messages_30d,
    COALESCE(us.current_streak, 0) as logging_streak
FROM public.users u
LEFT JOIN (
    SELECT user_id, 
           COUNT(*) as notifications_30d,
           COUNT(opened_at) as notifications_opened
    FROM public.notifications_sent
    WHERE sent_at >= NOW() - INTERVAL '30 days'
    GROUP BY user_id
) ns ON u.id = ns.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as chat_messages_30d
    FROM public.ai_chat_history
    WHERE created_at >= NOW() - INTERVAL '30 days'
    AND message_type IN ('user_message', 'ai_response')
    GROUP BY user_id
) ac ON u.id = ac.user_id
LEFT JOIN (
    SELECT user_id, current_streak
    FROM public.user_streaks
    WHERE streak_type = 'nutrition_log'
) us ON u.id = us.user_id
WHERE u.role = 'member'
ORDER BY u.last_gym_visit DESC NULLS LAST;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Log migration success
DO $$
BEGIN
    RAISE NOTICE 'AI Retention System migration completed successfully';
    RAISE NOTICE 'Tables created: ai_chat_history, notifications_sent, notification_templates, notification_rules';
    RAISE NOTICE 'Users table extended with gym tracking and preferences';
    RAISE NOTICE 'User streaks simplified (gamification removed)';
    RAISE NOTICE 'Default templates seeded';
    RAISE NOTICE 'Admin views created for analytics';
END $$;
