/**
 * Engagement Coordinator
 * 
 * Central orchestration layer that prevents spam, routes messages intelligently,
 * and coordinates all user touchpoints (AI Chat + Push Notifications).
 * 
 * Key Responsibilities:
 * - Prevent notification fatigue (max 7 touchpoints/day, min 2h gap)
 * - Route messages to correct channel (AI Chat vs Push)
 * - Respect user preferences and quiet hours
 * - Log all engagement attempts for analytics
 */

import { supabase } from './supabase';
import { format } from 'date-fns';

export type EngagementChannel = 'push' | 'ai_chat' | 'both';
export type EngagementScenario =
    | 'missed_gym_day'
    | 'post_gym_checkin'
    | 'no_daily_log'
    | 'streak_danger'
    | 'streak_milestone'
    | 'lapsed_2_days'
    | 'lapsed_7_days'
    | 'pattern_detected'
    | 'weekly_recap'
    | 'gym_visit_reminder'
    | 'post_workout_log'
    | 'post_workout_nutrition'
    | 'morning_nutrition'
    | 'lunch_nutrition'
    | 'dinner_nutrition';

interface RoutingDecision {
    canSend: boolean;
    channel: EngagementChannel;
    reason?: string;
    delayMinutes?: number;
}

interface UserEngagementData {
    lastNotificationSent: Date | null;
    lastAiChatMessage: Date | null;
    touchpointsToday: number;
    quietHours: { start: string; end: string };
    aiChatEnabled: boolean;
    gymVisitReminders: boolean;
    nutritionReminders: boolean;
    workoutLogReminders: boolean;
    streakProtectionEnabled: boolean;
    timezone: string;
}

/**
 * Channel selection rules based on scenario and timing
 */
const CHANNEL_ROUTING_RULES: Record<EngagementScenario, (hour: number, userData: UserEngagementData) => EngagementChannel> = {
    // Time-sensitive scenarios → Push
    'streak_danger': () => 'push',
    'gym_visit_reminder': () => 'push',
    'post_workout_log': () => 'push',
    'post_workout_nutrition': () => 'push',
    'morning_nutrition': () => 'push',
    'lunch_nutrition': () => 'push',
    'dinner_nutrition': () => 'push',

    // Conversational scenarios → AI Chat
    'lapsed_2_days': () => 'ai_chat',
    'lapsed_7_days': () => 'ai_chat',
    'pattern_detected': () => 'ai_chat',
    'weekly_recap': () => 'ai_chat',

    // Context-dependent scenarios
    'missed_gym_day': (hour) => hour < 12 ? 'ai_chat' : 'push',
    'no_daily_log': (hour) => hour < 20 ? 'ai_chat' : 'push',

    // Major milestones → Both channels
    'streak_milestone': () => 'both',
    'post_gym_checkin': () => 'ai_chat',
};

class EngagementCoordinator {
    /**
     * Main routing function - decides if and how to engage user
     */
    async routeMessage(
        userId: string,
        scenario: EngagementScenario,
        context: Record<string, any> = {}
    ): Promise<RoutingDecision> {
        try {
            // 1. Get user engagement data
            const userData = await this.getUserEngagementData(userId);
            if (!userData) {
                return { canSend: false, channel: 'push', reason: 'User not found' };
            }

            // 2. Check if user can receive any message (anti-spam)
            const canSend = await this.canSendMessage(userData, scenario);
            if (!canSend.allowed) {
                return { canSend: false, channel: 'push', reason: canSend.reason };
            }

            // 3. Determine channel based on scenario and time
            const currentHour = new Date().getHours();
            const channelSelector = CHANNEL_ROUTING_RULES[scenario];
            const channel = channelSelector ? channelSelector(currentHour, userData) : 'push';

            // 4. Check user preferences for this channel
            if (!this.isChannelAllowed(scenario, channel, userData)) {
                return { canSend: false, channel, reason: 'User disabled this notification type' };
            }

            return { canSend: true, channel };
        } catch (error) {
            console.error('[EngagementCoordinator] Error routing message:', error);
            return { canSend: false, channel: 'push', reason: 'Routing error' };
        }
    }

    /**
     * Get user's engagement metadata and preferences
     */
    private async getUserEngagementData(userId: string): Promise<UserEngagementData | null> {
        const { data, error } = await (supabase as any)
            .from('users')
            .select(`
        last_notification_sent,
        last_ai_chat_message,
        notification_touchpoints_today,
        quiet_hours,
        ai_chat_enabled,
        gym_visit_reminders,
        nutrition_reminders,
        workout_log_reminders,
        streak_protection_enabled,
        timezone
      `)
            .eq('id', userId)
            .single();

        if (error || !data) {
            console.error('[EngagementCoordinator] Failed to get user data:', error);
            return null;
        }

        return {
            lastNotificationSent: data.last_notification_sent ? new Date(data.last_notification_sent) : null,
            lastAiChatMessage: data.last_ai_chat_message ? new Date(data.last_ai_chat_message) : null,
            touchpointsToday: data.notification_touchpoints_today || 0,
            quietHours: data.quiet_hours || { start: '22:00', end: '07:00' },
            aiChatEnabled: data.ai_chat_enabled ?? true,
            gymVisitReminders: data.gym_visit_reminders ?? true,
            nutritionReminders: data.nutrition_reminders ?? true,
            workoutLogReminders: data.workout_log_reminders ?? true,
            streakProtectionEnabled: data.streak_protection_enabled ?? true,
            timezone: data.timezone || 'Africa/Nairobi',
        };
    }

    /**
     * Check if user can receive another message (anti-spam rules)
     */
    private async canSendMessage(
        userData: UserEngagementData,
        scenario: EngagementScenario
    ): Promise<{ allowed: boolean; reason?: string }> {
        // Rule 1: Max 7 touchpoints per day
        if (userData.touchpointsToday >= 7) {
            return { allowed: false, reason: 'Max daily touchpoints reached (7)' };
        }

        // Rule 2: Minimum 2 hours between any touchpoints (unless critical)
        const criticalScenarios: EngagementScenario[] = ['streak_danger', 'lapsed_7_days'];
        if (!criticalScenarios.includes(scenario)) {
            if (userData.lastNotificationSent) {
                const hoursSinceLastNotification =
                    (Date.now() - userData.lastNotificationSent.getTime()) / (1000 * 60 * 60);

                if (hoursSinceLastNotification < 2) {
                    return { allowed: false, reason: 'Too soon since last notification (< 2h)' };
                }
            }
        }

        // Rule 3: Respect quiet hours
        const now = new Date();
        const currentTime = format(now, 'HH:mm');
        const { start, end } = userData.quietHours;

        if (this.isInQuietHours(currentTime, start, end)) {
            return { allowed: false, reason: 'User is in quiet hours' };
        }

        return { allowed: true };
    }

    /**
     * Check if current time is within quiet hours
     */
    private isInQuietHours(current: string, start: string, end: string): boolean {
        // Handle cases where quiet hours span midnight (e.g., 22:00 to 07:00)
        if (start > end) {
            return current >= start || current <= end;
        }
        return current >= start && current <= end;
    }

    /**
     * Check if user has enabled this notification channel/type
     */
    private isChannelAllowed(
        scenario: EngagementScenario,
        channel: EngagementChannel,
        userData: UserEngagementData
    ): boolean {
        // Check AI Chat enabled
        if ((channel === 'ai_chat' || channel === 'both') && !userData.aiChatEnabled) {
            return false;
        }

        // Check scenario-specific preferences
        if (scenario.includes('gym') && !userData.gymVisitReminders) {
            return false;
        }

        if (scenario.includes('nutrition') && !userData.nutritionReminders) {
            return false;
        }

        if (scenario.includes('workout') && !userData.workoutLogReminders) {
            return false;
        }

        if (scenario.includes('streak') && !userData.streakProtectionEnabled) {
            return false;
        }

        return true;
    }

    /**
     * Log outreach attempt for analytics and spam prevention
     */
    async logOutreach(
        userId: string,
        channel: EngagementChannel,
        notificationType: string,
        template: string,
        context: Record<string, any> = {}
    ): Promise<void> {
        try {
            // Insert into notifications_sent
            const { error: insertError } = await (supabase as any)
                .from('notifications_sent')
                .insert({
                    user_id: userId,
                    notification_type: notificationType,
                    channel: channel === 'both' ? 'push' : channel, // Log primary channel
                    template_used: template,
                    context,
                    sent_at: new Date().toISOString(),
                    delivery_status: 'sent',
                });

            if (insertError) {
                console.error('[EngagementCoordinator] Failed to log notification:', insertError);
            }

            // Update user's touchpoint counter and last notification time
            const { error: updateError } = await (supabase as any)
                .from('users')
                .update({
                    last_notification_sent: new Date().toISOString(),
                    notification_touchpoints_today: (supabase as any).rpc('increment', {
                        row_id: userId,
                        column_name: 'notification_touchpoints_today'
                    }),
                })
                .eq('id', userId);

            if (updateError) {
                console.error('[EngagementCoordinator] Failed to update user stats:', updateError);
            }
        } catch (error) {
            console.error('[EngagementCoordinator] Error logging outreach:', error);
        }
    }

    /**
     * Update AI Chat timestamp when AI sends a message
     */
    async logAIChatMessage(userId: string): Promise<void> {
        try {
            await (supabase as any)
                .from('users')
                .update({
                    last_ai_chat_message: new Date().toISOString(),
                    notification_touchpoints_today: (supabase as any).rpc('increment', {
                        row_id: userId,
                        column_name: 'notification_touchpoints_today'
                    }),
                })
                .eq('id', userId);
        } catch (error) {
            console.error('[EngagementCoordinator] Error logging AI chat:', error);
        }
    }

    /**
     * Get user's touchpoint stats for today
     */
    async getTodaysTouchpoints(userId: string): Promise<number> {
        const { data } = await (supabase as any)
            .from('users')
            .select('notification_touchpoints_today')
            .eq('id', userId)
            .single();

        return (data as any)?.notification_touchpoints_today || 0;
    }

    /**
     * Check if user is currently in an active AI chat session
     * (used to pause push notifications during conversations)
     */
    async isInActiveAIChatSession(userId: string): Promise<boolean> {
        try {
            const { data } = await (supabase as any)
                .from('ai_chat_history')
                .select('created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!data) return false;

            // Consider session active if last message was within 10 minutes
            const lastMessageTime = new Date((data as any).created_at);
            const minutesSinceLastMessage = (Date.now() - lastMessageTime.getTime()) / (1000 * 60);

            return minutesSinceLastMessage < 10;
        } catch (error) {
            return false;
        }
    }
}

export const engagementCoordinator = new EngagementCoordinator();
