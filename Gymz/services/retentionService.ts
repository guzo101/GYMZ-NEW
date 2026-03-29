import { supabase } from './supabase';
import { DataMapper } from '../utils/dataMapper';

export const RETENTION_EVENT_TYPES = {
    STREAK_RISK: 'streak_risk',
    MILESTONE: 'milestone',
    COMEBACK: 'comeback',
    PULSE_BOOST: 'pulse_boost',
} as const;

export const RETENTION_PRIORITY = {
    CRITICAL: 1, // iPhone Toast
    HIGH: 2,     // Duolingo card
    INFO: 3,     // Standard
} as const;

export interface RetentionEvent {
    id: string;
    userId: string;
    eventType: string;
    message: string;
    metadata: any;
    priority: number;
    triggeredAt: string;
    acknowledged: boolean;
}

export interface UserBehaviorMetrics {
    userId: string;
    pulseStreakCount: number;
    highestStreakCount: number;
    lastLogAt: string | null;
    primeMotivationTime: string | null;
    totalXp: number;
    consecutiveGymDays: number;
    recoveryShieldsRemaining: number;
    xpBoostExpiresAt: string | null;
    personalityDepthScore: number;
    lastTonalInteraction: 'hype' | 'guilt' | 'scientific';
    updatedAt: string;
}

// SANITIZATION LAYER removed in favor of DataMapper

export const retentionService = {
    async getUserMetrics(userId: string): Promise<UserBehaviorMetrics | null> {
        try {
            const { data, error } = await (supabase as any)
                .from('user_behavior_metrics')
                .select(`
                    user_id,
                    pulse_streak_count,
                    highest_streak_count,
                    last_log_at,
                    prime_motivation_time,
                    total_xp,
                    consecutive_gym_days,
                    recovery_shields_remaining,
                    xp_boost_expires_at,
                    personality_depth_score,
                    last_tonal_interaction,
                    updated_at
                `)
                .eq('user_id', userId)
                .maybeSingle();

            if (error) throw error;
            return data ? DataMapper.fromDb<UserBehaviorMetrics>(data) : null;
        } catch (error) {
            console.error('[Retention Service] Error fetching metrics:', error);
            return null;
        }
    },

    async getActiveEvents(userId: string): Promise<RetentionEvent[]> {
        try {
            const { data, error } = await (supabase as any)
                .from('retention_events')
                .select('*')
                .eq('user_id', userId)
                .eq('acknowledged', false)
                .order('priority', { ascending: true })
                .order('triggered_at', { ascending: false });

            if (error) throw error;
            return DataMapper.fromDb(data || []);
        } catch (error) {
            console.error('[Retention Service] Error fetching events:', error);
            return [];
        }
    },

    async acknowledgeEvent(eventId: string) {
        try {
            const { error } = await (supabase as any)
                .from('retention_events')
                .update(DataMapper.toDb({
                    acknowledged: true,
                    acknowledgedAt: new Date().toISOString()
                }) as any)
                .eq('id', eventId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('[Retention Service] Error acknowledging event:', error);
            return { success: false, error };
        }
    },

    async trackActivity(userId: string, type: 'meal' | 'workout') {
        try {
            const { data, error } = await (supabase as any).rpc('track_user_retention_activity', {
                p_user_id: userId,
                p_activity_type: type
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('[Retention Service] Error tracking activity:', error);
            return { success: false, error };
        }
    },

    /**
     * Coach Z's Dynamic Tone Generator
     */
    getCoachZTone(streak: number, priority: number = 3): { title: string, tone: 'hype' | 'guilt' | 'scientific' } {
        if (streak >= 14) return { title: "ELITE STATUS", tone: 'scientific' };
        if (streak >= 7) return { title: "PULSE MASTER", tone: 'hype' };
        if (priority === 1) return { title: "DO NOT FAIL", tone: 'guilt' };
        return { title: "COACH Z", tone: 'hype' };
    }
};
