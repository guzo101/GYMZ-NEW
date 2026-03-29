/**
 * Progress Report Service
 * 
 * Generates milestone reports (Day 7, Day 14) to provide proof of value.
 * This is a critical retention mechanism for the "plateau breaker" persona.
 */

import { supabase } from './supabase';
import { progressService } from './progressService';
import { differenceInDays, startOfDay } from 'date-fns';

export interface ProgressReport {
    dayNumber: number;
    title: string;
    message: string;
    stats: {
        avgProtein: number;
        avgCalories: number;
        daysLogged: number;
        weightDelta: number | null;
        consistencyScore: number;
    };
}

export const progressReportService = {
    /**
     * Checks if a user is currently at a milestone day (7 or 14) 
     * and should see a progress report.
     */
    async getActiveMilestone(userId: string): Promise<number | null> {
        const { data, error } = await (supabase as any)
            .from('users')
            .select('created_at')
            .eq('id', userId)
            .single();

        if (error || !data) return null;

        const createdAt = new Date(data.created_at);
        const today = startOfDay(new Date());
        const daysSinceSignup = differenceInDays(today, startOfDay(createdAt));

        // Milestones: 7 days and 14 days
        if (daysSinceSignup === 7 || daysSinceSignup === 14) {
            return daysSinceSignup;
        }

        return null;
    },

    /**
     * Generates a comprehensive report for the specified milestone
     */
    async generateReport(userId: string, dayNumber: number): Promise<ProgressReport | null> {
        // Fetch last 7 days of data
        const calorieHistory = await progressService.getCalorieHistory(userId, 7);
        const bodyMetrics = await progressService.getBodyMetrics(userId, 7);
        const activeGoal = await progressService.getActiveGoal(userId);

        if (calorieHistory.length === 0) return null;

        const proteinGoal = activeGoal?.dailyProteinGoal || 0;
        const totalProtein = calorieHistory.reduce((sum, d) => sum + (d.totalProtein || 0), 0);
        const totalCalories = calorieHistory.reduce((sum, d) => sum + (d.totalCalories || 0), 0);
        const daysLogged = calorieHistory.length;
        const avgProtein = Math.round(totalProtein / daysLogged);
        const avgCalories = Math.round(totalCalories / daysLogged);

        // Calculate consistency (how close to protein goal)
        const proteinHits = calorieHistory.filter(d => (d.totalProtein || 0) >= proteinGoal * 0.8).length;
        const consistencyScore = Math.round((proteinHits / 7) * 100);

        // Calculate weight delta
        let weightDelta: number | null = null;
        if (bodyMetrics.length >= 2) {
            weightDelta = Math.round((bodyMetrics[bodyMetrics.length - 1].weight - bodyMetrics[0].weight) * 10) / 10;
        }

        const title = dayNumber === 7 ? "Week 1: Foundations Set! 🏗️" : "Week 2: Momentum Built! 🚀";
        const message = dayNumber === 7
            ? "You've survived the hardest week. Your consistency is building the new you. Look at your stats below!"
            : "14 days deep! You're breaking through the plateau. Your data shows undeniable progress. Keep going!";

        return {
            dayNumber,
            title,
            message,
            stats: {
                avgProtein,
                avgCalories,
                daysLogged,
                weightDelta,
                consistencyScore
            }
        };
    }
};
