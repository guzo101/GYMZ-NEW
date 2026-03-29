/**
 * Streak Service
 * 
 * Simplified streak tracking focused on habit formation (no gamification).
 * Tracks nutrition logging and gym visit streaks without XP, points, or badges.
 */

import { supabase } from './supabase';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { DataMapper } from '../utils/dataMapper';

export type StreakType = 'nutrition_log' | 'gym_visit' | 'check_in';

interface StreakData {
    userId: string;
    streakType: StreakType;
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: Date | null;
    streakStartDate: Date | null;
}

interface StreakCheckResult {
    maintained: boolean;
    newStreak: number;
    milestone?: number; // 7, 14, 30, 50, 100
    broken: boolean;
}

class StreakService {
    /**
     * Check and update user's daily logging streak
     */
    async checkDailyLoggingStreak(userId: string): Promise<StreakCheckResult> {
        try {
            // Get current streak data
            const streakData = await this.getCurrentStreak(userId, 'nutrition_log');
            const today = startOfDay(new Date());

            // Check if user logged anything today
            const loggedToday = await this.hasLoggedToday(userId);

            if (loggedToday) {
                // User logged - maintain or increment streak
                if (!streakData.lastActivityDate) {
                    // First ever log
                    return await this.startStreak(userId, 'nutrition_log');
                }

                const lastActivityDay = startOfDay(streakData.lastActivityDate);
                const daysSinceLastActivity = differenceInDays(today, lastActivityDay);

                if (daysSinceLastActivity === 0) {
                    // Already logged today - no change
                    return {
                        maintained: true,
                        newStreak: streakData.currentStreak,
                        broken: false,
                    };
                } else if (daysSinceLastActivity === 1) {
                    // Logged yesterday and today - increment streak
                    const newStreak = streakData.currentStreak + 1;
                    await this.updateStreak(userId, 'nutrition_log', newStreak, today);

                    // Check for milestone
                    const milestone = this.checkMilestone(newStreak);

                    return {
                        maintained: true,
                        newStreak,
                        milestone,
                        broken: false,
                    };
                } else {
                    // Gap in logging - streak broken, start new streak
                    return await this.startStreak(userId, 'nutrition_log');
                }
            } else {
                // User hasn't logged today yet
                if (!streakData.lastActivityDate) {
                    return {
                        maintained: false,
                        newStreak: 0,
                        broken: false,
                    };
                }

                const lastActivityDay = startOfDay(streakData.lastActivityDate);
                const daysSinceLastActivity = differenceInDays(today, lastActivityDay);

                if (daysSinceLastActivity >= 2) {
                    // Streak is already broken (missed yesterday)
                    return {
                        maintained: false,
                        newStreak: 0,
                        broken: true,
                    };
                }

                // Still have time to log today
                return {
                    maintained: false,
                    newStreak: streakData.currentStreak,
                    broken: false,
                };
            }
        } catch (error) {
            console.error('[StreakService] Error checking daily streak:', error);
            return { maintained: false, newStreak: 0, broken: false };
        }
    }

    /**
     * Update streak when user logs (nutrition or workout)
     */
    async updateStreakOnLog(userId: string, type: StreakType): Promise<void> {
        const today = startOfDay(new Date());
        const streakData = await this.getCurrentStreak(userId, type);

        if (!streakData.lastActivityDate) {
            // First log ever
            await this.startStreak(userId, type);
            return;
        }

        const lastActivityDay = startOfDay(streakData.lastActivityDate);
        const daysSinceLastActivity = differenceInDays(today, lastActivityDay);

        if (daysSinceLastActivity === 0) {
            // Already logged today - no streak change
            return;
        } else if (daysSinceLastActivity === 1) {
            // Consecutive day - increment streak
            const newStreak = streakData.currentStreak + 1;
            await this.updateStreak(userId, type, newStreak, today);
        } else {
            // Gap - start new streak
            await this.startStreak(userId, type);
        }
    }

    /**
     * Get current streak for a user
     */
    async getCurrentStreak(userId: string, type: StreakType): Promise<StreakData> {
        const { data, error } = await (supabase as any)
            .from('user_streaks')
            .select('*')
            .eq('user_id', userId)
            .eq('streak_type', type)
            .single();

        if (error || !data) {
            return {
                userId,
                streakType: type,
                currentStreak: 0,
                longestStreak: 0,
                lastActivityDate: null,
                streakStartDate: null,
            };
        }

        const mapped = DataMapper.fromDb(data);

        return {
            userId: mapped.userId,
            streakType: mapped.streakType,
            currentStreak: mapped.currentStreak || 0,
            longestStreak: mapped.longestStreak || 0,
            lastActivityDate: mapped.lastActivityDate ? new Date(mapped.lastActivityDate) : null,
            streakStartDate: mapped.streakStartDate ? new Date(mapped.streakStartDate) : null,
        };
    }

    /**
     * Check for streak milestones (7, 14, 30, 50, 100 days)
     */
    private checkMilestone(streak: number): number | undefined {
        const milestones = [7, 14, 30, 50, 100];
        return milestones.includes(streak) ? streak : undefined;
    }

    /**
     * Start a new streak (day 1)
     */
    private async startStreak(userId: string, type: StreakType): Promise<StreakCheckResult> {
        const today = startOfDay(new Date());

        const { error } = await (supabase as any)
            .from('user_streaks')
            .upsert(DataMapper.toDb({
                userId: userId,
                streakType: type,
                currentStreak: 1,
                lastActivityDate: format(today, 'yyyy-MM-dd'),
                streakStartDate: format(today, 'yyyy-MM-dd'),
            }));

        if (error) {
            console.error('[StreakService] Error starting streak:', error);
        }

        return {
            maintained: true,
            newStreak: 1,
            broken: false,
        };
    }

    /**
     * Update existing streak
     */
    private async updateStreak(
        userId: string,
        type: StreakType,
        newStreak: number,
        activityDate: Date
    ): Promise<void> {
        const { data: existingData } = await (supabase as any)
            .from('user_streaks')
            .select('longest_streak')
            .eq('user_id', userId)
            .eq('streak_type', type)
            .single();

        const longestStreak = Math.max(newStreak, existingData?.longest_streak || 0);

        const { error } = await (supabase as any)
            .from('user_streaks')
            .upsert(DataMapper.toDb({
                userId: userId,
                streakType: type,
                currentStreak: newStreak,
                longestStreak: longestStreak,
                lastActivityDate: format(activityDate, 'yyyy-MM-dd'),
            }));

        if (error) {
            console.error('[StreakService] Error updating streak:', error);
        }
    }

    /**
     * Check if user has logged anything today
     */
    private async hasLoggedToday(userId: string): Promise<boolean> {
        const today = format(new Date(), 'yyyy-MM-dd');

        // Check daily_logs table for any nutrition or workout entries
        const { data, error } = await (supabase as any)
            .from('daily_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('log_date', today)
            .limit(1);

        if (error) {
            console.error('[StreakService] Error checking daily logs:', error);
            return false;
        }

        return (data?.length || 0) > 0;
    }

    /**
     * Evening streak protection check
     * Returns true if user is in danger of breaking streak
     */
    async isStreakInDanger(userId: string): Promise<boolean> {
        const streakData = await this.getCurrentStreak(userId, 'nutrition_log');

        // No streak to protect
        if (streakData.currentStreak === 0) {
            return false;
        }

        // Check if logged today
        const loggedToday = await this.hasLoggedToday(userId);

        // Streak in danger if they have a streak but haven't logged today
        return !loggedToday && streakData.currentStreak > 0;
    }

    /**
     * Get all streak milestones user has achieved
     */
    async getStreakMilestones(userId: string, type: StreakType): Promise<number[]> {
        const streakData = await this.getCurrentStreak(userId, type);
        const allMilestones = [7, 14, 30, 50, 100];

        return allMilestones.filter(m => streakData.longestStreak >= m);
    }

    /**
     * Handle gym visit streak (different from logging streak)
     */
    async updateGymVisitStreak(userId: string): Promise<void> {
        // Gym visits count as streak if user goes 3+ times per week
        // This is different from daily logging streak

        const today = startOfDay(new Date());
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);

        const { data: recentVisits } = await (supabase as any)
            .from('attendance')
            .select('checkin_time')
            .eq('user_id', userId)
            .gte('checkin_time', weekStart.toISOString())
            .order('checkin_time', { ascending: false });

        const visitsThisWeek = recentVisits?.length || 0;

        // Update gym_visit streak if 3+ visits this week
        if (visitsThisWeek >= 3) {
            await this.updateStreakOnLog(userId, 'gym_visit');
        }
    }
}

export const streakService = new StreakService();
