/**
 * Gym Retention Service
 * 
 * Tracks gym visits, detects user patterns, and identifies lapsed members.
 * Core service for gym retention mechanics.
 */

import { supabase } from './supabase';
import { format, startOfWeek, startOfDay, differenceInDays, subDays } from 'date-fns';

interface GymVisitData {
    userId: string;
    gymId: string;
    checkinTime: Date;
}

interface GymSchedule {
    typicalDays: number[]; // 0=Sunday, 6=Saturday
    typicalTime: string | null; // "06:00" format
    averageVisitsPerWeek: number;
}

interface GymVisitStats {
    totalVisits: number;
    visitsThisWeek: number;
    visitsThisMonth: number;
    lastVisit: Date | null;
    daysSinceLastVisit: number;


    averageVisitsPerWeek: number;
}

class GymRetentionService {
    /**
     * Log gym check-in and trigger post-workout workflows
     */
    async logGymVisit(userId: string, gymId: string): Promise<{ success: boolean; message: string }> {
        try {
            const { error: insertError } = await (supabase as any)
                .from('attendance')
                .insert({
                    user_id: userId,
                    checkin_time: new Date().toISOString(),
                    status: 'approved',
                });

            if (insertError) {
                console.error('[GymRetentionService] Failed to log visit:', insertError);
                return { success: false, message: 'Failed to log gym visit' };
            }

            // Update user's last_gym_visit and total_gym_visits
            const { error: updateError } = await (supabase as any).rpc('increment_gym_visits', {
                p_user_id: userId
            });

            if (updateError) {
                console.error('[GymRetentionService] Failed to update user stats:', updateError);
            }

            // Schedule post-workout follow-ups (90 min delay)
            await this.schedulePostWorkoutPrompts(userId);

            // Update user's gym schedule detection
            await this.detectGymSchedule(userId);

            return { success: true, message: 'Gym visit logged successfully!' };
        } catch (error) {
            console.error('[GymRetentionService] Error logging gym visit:', error);
            return { success: false, message: 'An error occurred' };
        }
    }

    /**
     * Detect user's typical gym schedule using ML/pattern detection
     */
    async detectGymSchedule(userId: string): Promise<GymSchedule> {
        try {
            // Get last 30 days of gym visits
            const thirtyDaysAgo = subDays(new Date(), 30);

            const { data: visits } = await (supabase as any)
                .from('attendance')
                .select('checkin_time')
                .eq('user_id', userId)
                .gte('checkin_time', thirtyDaysAgo.toISOString())
                .order('checkin_time', { ascending: false });

            if (!visits || visits.length < 3) {
                // Not enough data to detect pattern
                return {
                    typicalDays: [],
                    typicalTime: null,
                    averageVisitsPerWeek: 0,
                };
            }

            // Detect typical days of week
            const dayFrequency: Record<number, number> = {};
            const timesList: string[] = [];

            visits.forEach((visit: any) => {
                const visitDate = new Date(visit.checkin_time);
                const dayOfWeek = visitDate.getDay(); // 0-6
                const timeOfDay = format(visitDate, 'HH:mm');

                dayFrequency[dayOfWeek] = (dayFrequency[dayOfWeek] || 0) + 1;
                timesList.push(timeOfDay);
            });

            // Find days where user goes more than 25% of the time
            const totalVisits = visits.length;
            const typicalDays = Object.keys(dayFrequency)
                .map(Number)
                .filter(day => dayFrequency[day] / totalVisits >= 0.25)
                .sort((a, b) => a - b);

            // Calculate typical time (median time)
            const typicalTime = this.calculateMedianTime(timesList);

            // Calculate average visits per week
            const weeks = 4.3; // ~30 days
            const averageVisitsPerWeek = totalVisits / weeks;

            // Update user's profile with detected schedule
            await (supabase as any)
                .from('users')
                .update({
                    typical_gym_days: typicalDays,
                    typical_gym_time: typicalTime,
                })
                .eq('id', userId);

            return {
                typicalDays,
                typicalTime,
                averageVisitsPerWeek,
            };
        } catch (error) {
            console.error('[GymRetentionService] Error detecting schedule:', error);
            return {
                typicalDays: [],
                typicalTime: null,
                averageVisitsPerWeek: 0,
            };
        }
    }

    /**
     * Check if user missed their typical gym day
     */
    async detectMissedGymDay(userId: string): Promise<boolean> {
        try {
            const { data: user } = await (supabase as any)
                .from('users')
                .select('typical_gym_days, timezone')
                .eq('id', userId)
                .single();

            if (!user || !user.typical_gym_days || user.typical_gym_days.length === 0) {
                return false; // No pattern established
            }

            const today = new Date();
            const todayDayOfWeek = today.getDay();

            // Check if today is a typical gym day
            if (!user.typical_gym_days.includes(todayDayOfWeek)) {
                return false; // Not a typical gym day
            }

            // Check if user already checked in today
            const checkedInToday = await this.checkedInToday(userId);

            return !checkedInToday; // Missed if haven't checked in yet
        } catch (error) {
            console.error('[GymRetentionService] Error detecting missed day:', error);
            return false;
        }
    }

    /**
     * Find lapsed members (7+ days since last visit)
     */
    async findLapsedMembers(daysSinceVisit: number = 7): Promise<string[]> {
        try {
            const cutoffDate = subDays(new Date(), daysSinceVisit);

            const { data: lapsedUsers } = await (supabase as any)
                .from('users')
                .select('id')
                .or(`last_gym_visit.is.null,last_gym_visit.lt.${cutoffDate.toISOString()}`)
                .eq('role', 'member');

            return (lapsedUsers || []).map((u: any) => u.id);
        } catch (error) {
            console.error('[GymRetentionService] Error finding lapsed members:', error);
            return [];
        }
    }

    /**
     * Get gym visit statistics for a user
     */
    async getGymVisitStats(userId: string): Promise<GymVisitStats> {
        try {
            const today = startOfDay(new Date());
            const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

            // Get all visits
            const { data: allVisits } = await (supabase as any)
                .from('attendance')
                .select('checkin_time')
                .eq('user_id', userId)
                .order('checkin_time', { ascending: false });

            const totalVisits = allVisits?.length || 0;

            // This week
            const visitsThisWeek = allVisits?.filter((v: any) =>
                new Date(v.checkin_time) >= weekStart
            ).length || 0;

            // This month
            const visitsThisMonth = allVisits?.filter((v: any) =>
                new Date(v.checkin_time) >= monthStart
            ).length || 0;

            // Last visit
            const lastVisit = allVisits && allVisits.length > 0
                ? new Date(allVisits[0].checkin_time)
                : null;

            // Days since last visit
            const daysSinceLastVisit = lastVisit
                ? differenceInDays(new Date(), lastVisit)
                : 999;

            // Average visits per week (last 30 days)
            const thirtyDaysAgo = subDays(new Date(), 30);
            const recentVisits = allVisits?.filter((v: any) =>
                new Date(v.checkin_time) >= thirtyDaysAgo
            ).length || 0;
            const averageVisitsPerWeek = recentVisits / 4.3; // ~4.3 weeks in 30 days

            return {
                totalVisits,
                visitsThisWeek,
                visitsThisMonth,
                lastVisit,
                daysSinceLastVisit,
                averageVisitsPerWeek: Math.round(averageVisitsPerWeek * 10) / 10,
            };
        } catch (error) {
            console.error('[GymRetentionService] Error getting stats:', error);
            return {
                totalVisits: 0,
                visitsThisWeek: 0,
                visitsThisMonth: 0,
                lastVisit: null,
                daysSinceLastVisit: 999,
                averageVisitsPerWeek: 0,
            };
        }
    }

    /**
     * Schedule post-workout notification prompts
     */
    private async schedulePostWorkoutPrompts(userId: string): Promise<void> {
        // This would integrate with your notification scheduler
        // For now, we'll just log the intent
        console.log(`[GymRetentionService] Scheduling post-workout prompts for user ${userId}`);

        // In production, you would:
        // 1. Schedule push notification for 90 min from now (workout logging)
        // 2. Schedule AI Chat follow-up for 100 min from now
        // Implementation depends on your background job system
    }

    /**
     * Check if user checked in to gym today
     */
    private async checkedInToday(userId: string): Promise<boolean> {
        const today = startOfDay(new Date());

        const { data } = await (supabase as any)
            .from('attendance')
            .select('id')
            .eq('user_id', userId)
            .gte('checkin_time', today.toISOString())
            .limit(1);

        return (data?.length || 0) > 0;
    }

    /**
     * Calculate median time from list of times
     */
    private calculateMedianTime(times: string[]): string | null {
        if (times.length === 0) return null;

        // Convert times to minutes since midnight for sorting
        const minutesList = times.map(time => {
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
        }).sort((a, b) => a - b);

        // Get median
        const midIndex = Math.floor(minutesList.length / 2);
        const medianMinutes = minutesList.length % 2 === 0
            ? Math.round((minutesList[midIndex - 1] + minutesList[midIndex]) / 2)
            : minutesList[midIndex];

        // Convert back to HH:mm format
        const hours = Math.floor(medianMinutes / 60);
        const minutes = medianMinutes % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
}

export const gymRetentionService = new GymRetentionService();
