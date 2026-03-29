import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { healthService } from './healthService';
import { nutritionService } from './nutritionService';
import { calculateBMR, calculateTDEE, calculateMacroSplit } from '../utils/healthMath';
import { DataMapper } from '../utils/dataMapper';

const CACHE_KEY_DASHBOARD = `dashboard_data_v1`;

export const dashboardService = {
    /**
     * PRE-ARM DASHBOARD CACHE
     * Fetches all critical dashboard data and stores it in AsyncStorage.
     */
    preArmDashboard: async (userId: string) => {
        if (!userId) return;

        console.log(`[DashboardService] Pre-arming cache for user: ${userId}`);
        const dateStr = format(new Date(), 'yyyy-MM-dd');

        try {
            const [turboResult, healthLogResult, waterIntakeResult] = await Promise.allSettled([
                (supabase as any).rpc('get_unified_app_data', { p_user_id: userId, p_date: dateStr }),
                healthService.getDailyLog(userId, dateStr),
                nutritionService.fetchWaterIntake(userId, dateStr)
            ]);

            if (turboResult.status === 'rejected' || (turboResult.value as any).error) {
                console.warn('[DashboardService] Turbo RPC failed during pre-arm');
                return;
            }

            const turboData = DataMapper.fromDb((turboResult.value as any).data);

            const turboProfile = turboData?.profile || null;
            const turboNutrition = turboData?.nutrition || { todayCalories: 0, todayWater: 0, logs: [] };
            const turboGamification = turboData?.gamification || { totalXp: 0, level: 1, rank: 0, totalPoints: 0 };
            const turboFitness = turboData?.fitness || { todayMinutes: 0, workoutCount: 0 };
            const turboCalendar = turboData?.calendar || [];

            turboFitness.attendance = turboFitness.attendance || { streak: 0, weeklyCount: 0 };

            const nutritionLogs = turboNutrition.logs || [];
            const todayWater = (waterIntakeResult.status === 'fulfilled' ? waterIntakeResult.value : 0) || turboNutrition.todayWater || 0;

            // --- SSOT GOAL EXTRACTION ---
            let goals = turboFitness.activeGoal;

            if (!goals && turboProfile?.weight && turboProfile?.height && turboProfile?.age) {
                console.log('[DashboardService] Cache Pre-arm Goal Fallback (Computation)...');
                const bmr = calculateBMR(
                    Number(turboProfile.weight),
                    Number(turboProfile.height),
                    Number(turboProfile.age),
                    (turboProfile.gender as any) || 'male'
                );

                let activityKey: any = 'MODERATELY_ACTIVE';
                const intensity = turboProfile.workoutIntensity || 'moderate';
                if (intensity === 'low') activityKey = 'LIGHTLY_ACTIVE';
                if (intensity === 'high') activityKey = 'VERY_ACTIVE';

                const tdee = calculateTDEE(bmr, activityKey);
                const objective = turboProfile.goal || 'recomp';

                let targetCalories = tdee;
                if (objective === 'lose_weight' || objective === 'weight_loss') targetCalories -= 500;
                if (objective === 'build_muscle' || objective === 'muscle_gain') targetCalories += 300;
                targetCalories = Math.max(1200, targetCalories);

                const macros = calculateMacroSplit(targetCalories, objective, Number(turboProfile.weight));

                goals = {
                    userId: userId,
                    dailyCalorieGoal: targetCalories,
                    dailyProteinGoal: macros.protein,
                    dailyCarbsGoal: macros.carbs,
                    dailyFatsGoal: macros.fat,
                    date: dateStr
                };
            }

            if (!goals) {
                goals = {
                    userId: userId,
                    dailyCalorieGoal: 0,
                    dailyProteinGoal: 0,
                    dailyCarbsGoal: 0,
                    dailyFatsGoal: 0,
                    date: dateStr
                };
            }

            const dStats = {
                calories: turboNutrition.todayCalories,
                water: todayWater,
                activeMinutes: turboFitness.todayMinutes || 0,
                protein: nutritionLogs.reduce((sum: number, log: any) => sum + (log.protein || 0), 0),
                carbs: nutritionLogs.reduce((sum: number, log: any) => sum + (log.carbs || 0), 0),
                fats: nutritionLogs.reduce((sum: number, log: any) => sum + (log.fats || 0), 0),
                bmi: Number(turboProfile?.calculatedBmi) || 0,
                goals: {
                    dailyCalorieGoal: goals.dailyCalorieGoal || 0,
                    dailyProteinGoal: goals.dailyProteinGoal || 0,
                    dailyCarbsGoal: goals.dailyCarbsGoal || 0,
                    dailyFatsGoal: goals.dailyFatsGoal || 0,
                },
                steps: Number(turboProfile?.lastRecordedSteps) || 0
            };

            const cacheData = {
                xp: turboGamification?.totalXp,
                level: turboGamification?.level,
                dailyStats: dStats,
                workoutCount: turboFitness?.workoutCount,
                personalTimetable: turboCalendar?.slice(0, 3) || [],
                profile: turboData?.profile, // Keep raw-ish but mapped
                attendanceStats: {
                    streak: turboFitness?.attendance?.streak || 0,
                    weeklyCount: turboFitness?.attendance?.weeklyCount || 0
                }
            };

            await AsyncStorage.setItem(`${CACHE_KEY_DASHBOARD}_${userId}`, JSON.stringify(cacheData));
            console.log('[DashboardService] ✅ Cache armed successfully');

        } catch (e) {
            console.warn('[DashboardService] Cache arming failed:', e);
        }
    }
};
