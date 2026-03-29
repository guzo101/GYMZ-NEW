/**
 * Retention Orchestrator (Background Job Service)
 * 
 * Coordinates all proactive engagement triggers.
 * Meant to be run as a scheduled job (e.g., every hour or via cloud functions).
 * 
 * Triggers:
 * - Missed gym day detection
 * - Post-workout followups
 * - Lapsed user re-engagement
 * - Streak protection
 * - Weekly progress recaps
 */

import { supabase } from './supabase';
import { gymRetentionService } from './gymRetentionService';
import { aiChatService } from './aiChatService';
import { streakService } from './streakService';
import { nutritionNotificationService } from './nutritionNotificationService';
import { format, startOfDay, subDays } from 'date-fns';

class RetentionOrchestrator {
    /**
     * Main orchestration function - run this on a schedule
     * Recommended: Every hour from 6am to 11pm
     */
    async runAllChecks(): Promise<void> {
        console.log(`[RetentionOrchestrator] Running retention checks at ${new Date().toISOString()}`);

        try {
            // Get all active users (not lapsed > 30 days)
            const activeUsers = await this.getActiveUsers();

            console.log(`[RetentionOrchestrator] Processing ${activeUsers.length} active users`);

            // Run checks in parallel for performance
            await Promise.allSettled([
                this.checkMissedGymDays(activeUsers),
                this.checkLapsedUsers(),
                this.checkStreakProtection(activeUsers),
                this.sendWeeklyRecaps(activeUsers),
            ]);

            console.log('[RetentionOrchestrator] All retention checks completed');
        } catch (error) {
            console.error('[RetentionOrchestrator] Error in retention checks:', error);
        }
    }

    /**
     * Check for users who missed their typical gym day
     * Run: Between 10am - 8pm
     */
    private async checkMissedGymDays(users: string[]): Promise<void> {
        const currentHour = new Date().getHours();

        // Only check during gym hours
        if (currentHour < 10 || currentHour > 20) {
            return;
        }

        console.log('[RetentionOrchestrator] Checking missed gym days...');

        for (const userId of users) {
            try {
                const missedGymDay = await gymRetentionService.detectMissedGymDay(userId);

                if (missedGymDay) {
                    // Send AI Chat proactive message
                    const day = format(new Date(), 'EEEE'); // "Monday", "Tuesday", etc.

                    await aiChatService.sendProactiveMessage({
                        userId,
                        scenario: 'missed_gym_day',
                        context: { day },
                    });

                    console.log(`[RetentionOrchestrator] Sent missed gym day message to user ${userId}`);
                }
            } catch (error) {
                console.error(`[RetentionOrchestrator] Error checking missed gym day for ${userId}:`, error);
            }
        }
    }

    /**
     * Re-engage lapsed users (2 days and 7 days)
     * Run: Between 9am - 7pm
     */
    private async checkLapsedUsers(): Promise<void> {
        const currentHour = new Date().getHours();

        // Only send during reasonable hours
        if (currentHour < 9 || currentHour > 19) {
            return;
        }

        console.log('[RetentionOrchestrator] Checking lapsed users...');

        // 2-day lapsed (gentle check-in)
        const lapsed2Days = await gymRetentionService.findLapsedMembers(2);

        for (const userId of lapsed2Days) {
            await aiChatService.sendProactiveMessage({
                userId,
                scenario: 'lapsed_2_days',
            });
        }

        console.log(`[RetentionOrchestrator] Sent 2-day lapsed messages to ${lapsed2Days.length} users`);

        // 7-day lapsed (stronger intervention)
        const lapsed7Days = await gymRetentionService.findLapsedMembers(7);

        for (const userId of lapsed7Days) {
            await aiChatService.sendProactiveMessage({
                userId,
                scenario: 'lapsed_7_days',
            });
        }

        console.log(`[RetentionOrchestrator] Sent 7-day lapsed messages to ${lapsed7Days.length} users`);
    }

    /**
     * Evening streak protection (8pm - 11:30pm)
     */
    private async checkStreakProtection(users: string[]): Promise<void> {
        const currentHour = new Date().getHours();

        // Only run in the evening
        if (currentHour < 20 || currentHour >= 23.5) {
            return;
        }

        console.log('[RetentionOrchestrator] Running streak protection checks...');

        for (const userId of users) {
            try {
                await nutritionNotificationService.checkStreakProtection(userId);
            } catch (error) {
                console.error(`[RetentionOrchestrator] Error in streak protection for ${userId}:`, error);
            }
        }
    }

    /**
     * Weekly progress recap (Friday evenings at 6pm)
     */
    private async sendWeeklyRecaps(users: string[]): Promise<void> {
        const day = new Date().getDay();
        const hour = new Date().getHours();

        // Only send on Friday (5) at 6pm (18)
        if (day !== 5 || hour !== 18) {
            return;
        }

        console.log('[RetentionOrchestrator] Sending weekly recaps...');

        for (const userId of users) {
            try {
                const gymStats = await gymRetentionService.getGymVisitStats(userId);
                const streakData = await streakService.getCurrentStreak(userId, 'nutrition_log');

                await aiChatService.sendProactiveMessage({
                    userId,
                    scenario: 'weekly_recap',
                    context: {
                        gym_visits_week: gymStats.visitsThisWeek,
                        log_days: streakData.currentStreak >= 7 ? 7 : streakData.currentStreak,
                        percent: gymStats.visitsThisWeek > 0 ? 100 : 0, // Placeholder for week-over-week comparison
                    },
                });

                console.log(`[RetentionOrchestrator] Sent weekly recap to user ${userId}`);
            } catch (error) {
                console.error(`[RetentionOrchestrator] Error sending weekly recap to ${userId}:`, error);
            }
        }
    }

    /**
     * Post-workout follow-up (triggered 90-120 min after gym check-in)
     * This would ideally use a queue system, but for now it's a scheduled check
     */
    async handlePostWorkoutFollowup(userId: string): Promise<void> {
        console.log(`[RetentionOrchestrator] Post-workout followup for ${userId}`);

        // Send AI Chat message for workout logging
        await aiChatService.sendProactiveMessage({
            userId,
            scenario: 'post_workout_log',
        });

        // Wait 10 minutes, then prompt for nutrition
        setTimeout(async () => {
            await aiChatService.sendProactiveMessage({
                userId,
                scenario: 'post_workout_nutrition',
            });
        }, 10 * 60 * 1000); // 10 minutes
    }

    /**
     * Get all active users (not lapsed > 30 days)
     */
    private async getActiveUsers(): Promise<string[]> {
        const thirtyDaysAgo = subDays(new Date(), 30);

        const { data } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'member')
            .or(`last_gym_visit.gte.${thirtyDaysAgo.toISOString()},created_at.gte.${thirtyDaysAgo.toISOString()}`);

        return (data || []).map((u: any) => u.id);
    }

    /**
     * Manual trigger for testing (call from admin panel)
     */
    async testProactiveMessage(userId: string, scenario: string): Promise<void> {
        console.log(`[RetentionOrchestrator] Testing ${scenario} for ${userId}`);

        await aiChatService.sendProactiveMessage({
            userId,
            scenario: scenario as any,
            context: {
                day: 'Monday',
                time: '7:00 AM',
                streak: 5,
                gym_visits_week: 3,
            },
        });
    }
}

export const retentionOrchestrator = new RetentionOrchestrator();
