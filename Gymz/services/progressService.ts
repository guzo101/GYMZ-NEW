import { supabase } from './supabase';
import { startOfWeek, startOfMonth, subDays, format } from 'date-fns';

export interface BodyMetric {
    id: string;
    userId: string;
    date: string;
    weight: number;
    bodyFatPercentage?: number;
    muscleMass?: number;
    waistCircumference?: number;
    chestCircumference?: number;
    armCircumference?: number;
    hipCircumference?: number;
    notes?: string;
}

export interface FitnessGoal {
    id: string;
    userId: string;
    goalType: 'lose_weight' | 'build_muscle' | 'recomp' | 'maintenance';
    targetWeight?: number;
    targetBodyFat?: number;
    targetDate?: string;
    startingWeight?: number;
    startingBodyFat?: number;
    startingDate: string;
    weeklyWorkoutGoal: number;
    dailyCalorieGoal: number;
    dailyProteinGoal: number;
    dailyCarbsGoal: number;
    dailyFatsGoal: number;
    isActive: boolean;
}

export interface DailyCalorieSummary {
    id: string;
    userId: string;
    date: string;
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFats: number;
    totalFiber: number;
    caloriesBurned: number;
    netCalories: number;
    mealCount: number;
}

export interface UserStreak {
    id: string;
    userId: string;
    streakType: 'workout' | 'nutrition_log' | 'check_in' | 'water_intake' | 'class_attendance';
    currentStreak: number;
    longestStreak: number;
    lastActivityDate?: string;
    streakStartDate?: string;
}

export interface ExerciseProgress {
    id: string;
    userId: string;
    exerciseName: string;
    date: string;
    maxWeight?: number;
    totalVolume?: number;
    totalReps?: number;
    totalSets?: number;
    averageRepsPerSet?: number;
    oneRepMax?: number;
}

export interface AchievementBadge {
    id: string;
    badgeName: string;
    badgeDescription: string;
    badgeIcon: string;
    badgeCategory: 'workout' | 'nutrition' | 'streak' | 'social' | 'milestone' | 'strength';
    requirementType: string;
    requirementValue: number;
    xpReward: number;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
    gradientColors: string[];
}

export interface UserBadgeProgress {
    id: string;
    userId: string;
    badgeId: string;
    currentProgress: number;
    isUnlocked: boolean;
    unlockedAt?: string;
    badge?: AchievementBadge;
}

export interface UserLevel {
    id: string;
    userId: string;
    currentLevel: number;
    currentXp: number;
    totalXp: number;
    xpToNextLevel: number;
    levelTitle: string;
}

export interface WeeklySummary {
    id: string;
    userId: string;
    weekStartDate: string;
    totalWorkouts: number;
    totalWorkoutDuration: number;
    avgDailyCalories: number;
    avgWeight?: number;
    totalCaloriesLogged: number;
    totalClassesAttended: number;
    totalXpEarned: number;
    totalVolumeLifted: number;
}


// ── SANITIZATION LAYER (Absolute Harmony Standard) ─────────────────────────

export const mapBodyMetric = (data: any): BodyMetric => ({
    id: data.id,
    userId: data.user_id,
    date: data.date,
    weight: data.weight,
    bodyFatPercentage: data.body_fat_percentage,
    muscleMass: data.muscle_mass,
    waistCircumference: data.waist_circumference,
    chestCircumference: data.chest_circumference,
    armCircumference: data.arm_circumference,
    hipCircumference: data.hip_circumference,
    notes: data.notes,
});

export const mapFitnessGoal = (data: any): FitnessGoal => ({
    id: data.id,
    userId: data.user_id,
    goalType: data.goal_type,
    targetWeight: data.target_weight,
    targetBodyFat: data.target_body_fat,
    targetDate: data.target_date,
    startingWeight: data.starting_weight,
    startingBodyFat: data.starting_body_fat,
    startingDate: data.starting_date,
    weeklyWorkoutGoal: data.weekly_workout_goal,
    dailyCalorieGoal: data.daily_calorie_goal,
    dailyProteinGoal: data.daily_protein_goal,
    dailyCarbsGoal: data.daily_carbs_goal,
    dailyFatsGoal: data.daily_fats_goal,
    isActive: data.is_active,
});

export const mapDailyCalorieSummary = (data: any): DailyCalorieSummary => ({
    id: data.id,
    userId: data.userId,
    date: data.date,
    totalCalories: data.totalCalories,
    totalProtein: data.totalProtein,
    totalCarbs: data.totalCarbs,
    totalFats: data.totalFats,
    totalFiber: data.totalFiber,
    caloriesBurned: data.caloriesBurned,
    netCalories: data.netCalories,
    mealCount: data.mealCount,
});

export const mapUserStreak = (data: any): UserStreak => ({
    id: data.id,
    userId: data.user_id,
    streakType: data.streak_type,
    currentStreak: data.current_streak,
    longestStreak: data.longest_streak,
    lastActivityDate: data.last_activity_date,
    streakStartDate: data.streak_start_date,
});

export const mapExerciseProgress = (data: any): ExerciseProgress => ({
    id: data.id,
    userId: data.user_id,
    exerciseName: data.exercise_name,
    date: data.date,
    maxWeight: data.max_weight,
    totalVolume: data.total_volume,
    totalReps: data.total_reps,
    totalSets: data.total_sets,
    averageRepsPerSet: data.average_reps_per_set,
    oneRepMax: data.one_rep_max,
});

export const mapAchievementBadge = (data: any): AchievementBadge => ({
    id: data.id,
    badgeName: data.badge_name,
    badgeDescription: data.badge_description,
    badgeIcon: data.badge_icon,
    badgeCategory: data.badge_category,
    requirementType: data.requirement_type,
    requirementValue: data.requirement_value,
    xpReward: data.xp_reward,
    tier: data.tier,
    gradientColors: data.gradient_colors,
});

export const mapUserBadgeProgress = (data: any): UserBadgeProgress => ({
    id: data.id,
    userId: data.user_id,
    badgeId: data.badge_id,
    currentProgress: data.current_progress,
    isUnlocked: data.is_unlocked,
    unlockedAt: data.unlocked_at,
    badge: data.badge ? mapAchievementBadge(data.badge) : undefined,
});

export const mapUserLevel = (data: any): UserLevel => ({
    id: data.id,
    userId: data.user_id,
    currentLevel: data.current_level,
    currentXp: data.current_xp,
    totalXp: data.total_xp,
    xpToNextLevel: data.xp_to_next_level,
    levelTitle: data.level_title,
});

export const mapWeeklySummary = (data: any): WeeklySummary => ({
    id: data.id,
    userId: data.user_id,
    weekStartDate: data.week_start_date,
    totalWorkouts: data.total_workouts,
    totalWorkoutDuration: data.total_workout_duration,
    avgDailyCalories: data.avg_daily_calories,
    avgWeight: data.avg_weight,
    totalCaloriesLogged: data.total_calories_logged,
    totalClassesAttended: data.total_classes_attended,
    totalXpEarned: data.total_xp_earned,
    totalVolumeLifted: data.total_volume_lifted,
});

export const mapSnapshot = (data: any) => ({
    id: data.id,
    userId: data.user_id,
    imageUrl: data.image_url,
    date: data.date,
    weight: data.weight,
    notes: data.notes,
    createdAt: data.created_at,
});

class ProgressService {
    // =====================================================
    // BODY METRICS
    // =====================================================

    async getBodyMetrics(userId: string, days: number = 365): Promise<BodyMetric[]> {
        const startDate = subDays(new Date(), days).toISOString().split('T')[0];

        const { data, error } = await (supabase as any)
            .from('body_metrics')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startDate)
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching body metrics:', error);
            return [];
        }

        return (data || []).map(mapBodyMetric);
    }

    async addBodyMetric(userId: string, metric: Partial<BodyMetric>): Promise<BodyMetric | null> {
        const row = {
            user_id: userId,
            date: metric.date || new Date().toISOString().split('T')[0],
            weight: metric.weight,
            body_fat_percentage: metric.bodyFatPercentage,
            muscle_mass: metric.muscleMass,
            waist_circumference: metric.waistCircumference,
            chest_circumference: metric.chestCircumference,
            arm_circumference: metric.armCircumference,
            hip_circumference: metric.hipCircumference,
            notes: metric.notes,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await (supabase as any)
            .from('body_metrics')
            .upsert(row, {
                onConflict: 'user_id, date',
                ignoreDuplicates: false,
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding body metric:', error);
            return null;
        }

        return mapBodyMetric(data);
    }

    async getLatestWeight(userId: string): Promise<number | null> {
        const { data, error } = await (supabase as any)
            .from('body_metrics')
            .select('weight')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return null;
        return data.weight;
    }

    // =====================================================
    // FITNESS GOALS
    // =====================================================

    async getActiveGoal(userId: string): Promise<FitnessGoal | null> {
        const { data, error } = await (supabase as any)
            .from('user_fitness_goals')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return null;
        return mapFitnessGoal(data);
    }

    async createGoal(userId: string, goal: Partial<FitnessGoal>): Promise<FitnessGoal | null> {
        // Deactivate existing goals
        await (supabase as any)
            .from('user_fitness_goals')
            .update({ is_active: false })
            .eq('user_id', userId);

        const { data, error } = await (supabase as any)
            .from('user_fitness_goals')
            .insert({
                user_id: userId,
                goal_type: goal.goalType,
                target_weight: goal.targetWeight,
                target_body_fat: goal.targetBodyFat,
                target_date: goal.targetDate,
                starting_weight: goal.startingWeight,
                starting_body_fat: goal.startingBodyFat,
                starting_date: goal.startingDate,
                weekly_workout_goal: goal.weeklyWorkoutGoal,
                daily_calorie_goal: goal.dailyCalorieGoal,
                daily_protein_goal: goal.dailyProteinGoal,
                daily_carbs_goal: goal.dailyCarbsGoal,
                daily_fats_goal: goal.dailyFatsGoal,
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating goal:', error);
            return null;
        }

        return mapFitnessGoal(data);
    }

    // =====================================================
    // CALORIE TRACKING
    // =====================================================

    private async aggregateNutritionLogs(userId: string, startDate: string, endDate: string): Promise<DailyCalorieSummary[]> {
        const { data: logs, error } = await (supabase as any)
            .from('daily_nutrition_logs')
            .select('logged_at, calories, protein, carbs, fats, fiber')
            .eq('user_id', userId)
            .gte('logged_at', `${startDate}T00:00:00Z`)
            .lte('logged_at', `${endDate}T23:59:59Z`);

        if (error) {
            console.error('[progressService] Error fetching logs for daily map:', error);
            return [];
        }

        const dailyMap = new Map<string, DailyCalorieSummary>();

        (logs || []).forEach((log: any) => {
            if (!log.logged_at) return;
            const dateStr = Array.isArray(log.logged_at) ? log.logged_at[0] : log.logged_at;
            const date = dateStr.split('T')[0];

            if (!dailyMap.has(date)) {
                dailyMap.set(date, {
                    id: `${userId}-${date}`,
                    userId: userId,
                    date: date,
                    totalCalories: 0,
                    totalProtein: 0,
                    totalCarbs: 0,
                    totalFats: 0,
                    totalFiber: 0,
                    caloriesBurned: 0,
                    netCalories: 0,
                    mealCount: 0
                });
            }

            const summary = dailyMap.get(date)!;
            summary.totalCalories += Number(log.calories) || 0;
            summary.totalProtein += Number(log.protein) || 0;
            summary.totalCarbs += Number(log.carbs) || 0;
            summary.totalFats += Number(log.fats) || 0;
            summary.totalFiber += Number(log.fiber) || 0;
            summary.mealCount += 1;
            summary.netCalories = summary.totalCalories - summary.caloriesBurned;
        });

        return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    async getTodayCalories(userId: string): Promise<DailyCalorieSummary | null> {
        const today = new Date().toISOString().split('T')[0];
        const summaries = await this.aggregateNutritionLogs(userId, today, today);
        return summaries.length > 0 ? summaries[0] : null;
    }

    async getCalorieHistory(userId: string, days: number = 30): Promise<DailyCalorieSummary[]> {
        const endDay = new Date().toISOString().split('T')[0];
        const startDate = subDays(new Date(), days).toISOString().split('T')[0];
        return this.aggregateNutritionLogs(userId, startDate, endDay);
    }

    // =====================================================
    // STREAKS
    // =====================================================

    async getStreaks(userId: string): Promise<UserStreak[]> {
        const { data, error } = await (supabase as any)
            .from('user_streaks')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching streaks:', error);
            return [];
        }

        return (data || []).map(mapUserStreak);
    }

    async getWorkoutStreak(userId: string): Promise<UserStreak | null> {
        const { data, error } = await (supabase as any)
            .from('user_streaks')
            .select('*')
            .eq('user_id', userId)
            .eq('streak_type', 'workout')
            .single();

        if (error || !data) return null;
        return mapUserStreak(data);
    }

    // =====================================================
    // EXERCISE PROGRESS
    // =====================================================

    async getExerciseProgress(userId: string, exerciseName: string, days: number = 90): Promise<ExerciseProgress[]> {
        const startDate = subDays(new Date(), days).toISOString().split('T')[0];

        const { data, error } = await (supabase as any)
            .from('exercise_progress')
            .select('*')
            .eq('user_id', userId)
            .eq('exercise_name', exerciseName)
            .gte('date', startDate)
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching exercise progress:', error);
            return [];
        }

        return (data || []).map(mapExerciseProgress);
    }

    async getTopExercises(userId: string, limit: number = 5): Promise<ExerciseProgress[]> {
        const { data, error } = await (supabase as any)
            .from('exercise_progress')
            .select('*')
            .eq('user_id', userId)
            .order('max_weight', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching top exercises:', error);
            return [];
        }

        return (data || []).map(mapExerciseProgress);
    }

    // =====================================================
    // BADGES & ACHIEVEMENTS
    // =====================================================

    async getAllBadges(): Promise<AchievementBadge[]> {
        try {
            const { data, error } = await (supabase as any)
                .from('achievement_badges')
                .select('*')
                .eq('is_active', true)
                .order('tier', { ascending: true });

            if (error) {
                console.warn('[ProgressService] Error fetching badges:', error.message);
                return [];
            }

            return (data || []).map(mapAchievementBadge);
        } catch (err) {
            console.error('[ProgressService] Fatal error in getAllBadges:', err);
            return [];
        }
    }

    async getUserBadgeProgress(userId: string): Promise<UserBadgeProgress[]> {
        try {
            const { data, error } = await (supabase as any)
                .from('user_badge_progress')
                .select(`
                    *,
                    badge:achievement_badges(*)
                `)
                .eq('user_id', userId)
                .order('unlocked_at', { ascending: false, nullsFirst: false });

            if (error) {
                console.warn('[ProgressService] Error fetching user badge progress:', error.message);
                return [];
            }

            return (data || []).map(mapUserBadgeProgress);
        } catch (err) {
            console.error('[ProgressService] Fatal error in getUserBadgeProgress:', err);
            return [];
        }
    }

    async getUnlockedBadges(userId: string, limit?: number): Promise<UserBadgeProgress[]> {
        try {
            let query = (supabase as any)
                .from('user_badge_progress')
                .select(`
                    *,
                    badge:achievement_badges(*)
                `)
                .eq('user_id', userId)
                .eq('is_unlocked', true)
                .order('unlocked_at', { ascending: false });

            if (limit) {
                query = query.limit(limit);
            }

            const { data, error } = await query;

            if (error) {
                if (error.message?.includes('schema cache')) {
                    return [];
                }
                console.warn('[ProgressService] Error fetching unlocked badges:', error.message);
                return [];
            }

            return (data || []).map(mapUserBadgeProgress);
        } catch (err) {
            console.error('[ProgressService] Fatal error in getUnlockedBadges:', err);
            return [];
        }
    }

    async getInProgressBadges(userId: string): Promise<UserBadgeProgress[]> {
        try {
            const { data, error } = await (supabase as any)
                .from('user_badge_progress')
                .select(`
                    *,
                    badge:achievement_badges(*)
                `)
                .eq('user_id', userId)
                .eq('is_unlocked', false)
                .gt('current_progress', 0)
                .order('current_progress', { ascending: false });

            if (error) {
                if (error.message?.includes('schema cache')) {
                    // Suppress warning if table is just not available in the current Supabase environment
                    return [];
                }
                console.warn('[ProgressService] Error fetching in-progress badges:', error.message);
                return [];
            }

            return (data || []).map(mapUserBadgeProgress);
        } catch (err) {
            console.error('[ProgressService] Fatal error in getInProgressBadges:', err);
            return [];
        }
    }

    // =====================================================
    // USER LEVEL
    // =====================================================

    async getUserLevel(userId: string): Promise<UserLevel | null> {
        try {
            const { data, error } = await (supabase as any)
                .from('user_level_system')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                return this.initializeUserLevel(userId);
            }

            return mapUserLevel(data);
        } catch (err) {
            console.error('[ProgressService] Error in getUserLevel:', err);
            return null;
        }
    }

    async initializeUserLevel(userId: string): Promise<UserLevel | null> {
        try {
            console.log('[ProgressService] Initializing level for:', userId);
            const { data, error } = await (supabase as any)
                .from('user_level_system')
                .insert({
                    user_id: userId,
                    current_level: 1,
                    current_xp: 0,
                    total_xp: 0,
                    xp_to_next_level: 100,
                    level_title: 'Beginner',
                })
                .select()
                .single();

            if (error) {
                // Return null if RLS or unique constraint prevents the insert
                return null;
            }

            return mapUserLevel(data);
        } catch (err) {
            console.error('[ProgressService] Fatal error in initializeUserLevel:', err);
            return null;
        }
    }

    // =====================================================
    // WEEKLY SUMMARY
    // =====================================================

    async getWeeklySummary(userId: string, weekStartDate?: string): Promise<WeeklySummary | null> {
        const weekStart = weekStartDate || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

        const { data, error } = await (supabase as any)
            .from('weekly_progress_summary')
            .select('*')
            .eq('user_id', userId)
            .eq('week_start_date', weekStart)
            .single();

        if (error || !data) return null;
        return mapWeeklySummary(data);
    }

    async getRecentWeeklySummaries(userId: string, weeks: number = 4): Promise<WeeklySummary[]> {
        const { data, error } = await (supabase as any)
            .from('weekly_progress_summary')
            .select('*')
            .eq('user_id', userId)
            .order('week_start_date', { ascending: false })
            .limit(weeks);

        if (error) {
            console.error('Error fetching weekly summaries:', error);
            return [];
        }

        return (data || []).map(mapWeeklySummary);
    }

    // =====================================================
    // COMPREHENSIVE PROGRESS DATA
    // =====================================================

    async getComprehensiveProgress(userId: string) {
        const [
            bodyMetrics,
            activeGoal,
            todayCalories,
            streaks,
            userLevel,
            unlockedBadges,
            inProgressBadges,
            calorieHistory,
            weeklySummary,
        ] = await Promise.all([
            this.getIntegratedWeightHistory(userId),
            this.getActiveGoal(userId),
            this.getTodayCalories(userId),
            this.getStreaks(userId),
            this.getUserLevel(userId),
            this.getUnlockedBadges(userId, 10),
            this.getInProgressBadges(userId),
            this.getCalorieHistory(userId, 365),
            this.getWeeklySummary(userId),
        ]);

        return {
            bodyMetrics,
            activeGoal,
            todayCalories,
            streaks,
            userLevel,
            unlockedBadges,
            inProgressBadges,
            calorieHistory,
            weeklySummary,
        };
    }

    // =====================================================
    // WEEK-OVER-WEEK COMPARISON (Plateau-Breaker Feature)
    // =====================================================

    async getWeekOverWeekComparison(userId: string): Promise<{
        thisWeek: { avgCalories: number; avgProtein: number; daysLogged: number; proteinHitRate: number };
        lastWeek: { avgCalories: number; avgProtein: number; daysLogged: number; proteinHitRate: number };
        weightDelta: number | null;
        isImproving: boolean;
    }> {
        const today = new Date();
        const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
        const lastWeekStart = subDays(thisWeekStart, 7);
        const lastWeekEnd = subDays(thisWeekStart, 1);

        const calorieHistory = await this.getCalorieHistory(userId, 14);
        const bodyMetrics = await this.getBodyMetrics(userId, 14);
        const activeGoal = await this.getActiveGoal(userId);

        const proteinGoal = activeGoal?.dailyProteinGoal || 0;

        const thisWeekData = calorieHistory.filter(d => {
            const date = new Date(d.date);
            return date >= thisWeekStart && date <= today;
        });

        const lastWeekData = calorieHistory.filter(d => {
            const date = new Date(d.date);
            return date >= lastWeekStart && date <= lastWeekEnd;
        });

        const calcStats = (data: DailyCalorieSummary[]) => {
            if (data.length === 0) return { avgCalories: 0, avgProtein: 0, daysLogged: 0, proteinHitRate: 0 };
            const totalCalories = data.reduce((sum, d) => sum + (d.totalCalories || 0), 0);
            const totalProtein = data.reduce((sum, d) => sum + (d.totalProtein || 0), 0);
            const proteinHits = data.filter(d => (d.totalProtein || 0) >= (proteinGoal || 0) * 0.8).length;
            return {
                avgCalories: Math.round(totalCalories / data.length),
                avgProtein: Math.round(totalProtein / data.length),
                daysLogged: data.length,
                proteinHitRate: Math.round((proteinHits / data.length) * 100),
            };
        };

        const thisWeekStats = calcStats(thisWeekData);
        const lastWeekStats = calcStats(lastWeekData);

        const thisWeekWeight = bodyMetrics.filter(m => new Date(m.date) >= thisWeekStart);
        const lastWeekWeight = bodyMetrics.filter(m => {
            const date = new Date(m.date);
            return date >= lastWeekStart && date < thisWeekStart;
        });

        let weightDelta: number | null = null;
        if (thisWeekWeight.length > 0 && lastWeekWeight.length > 0) {
            const latestThisWeek = thisWeekWeight[thisWeekWeight.length - 1].weight;
            const latestLastWeek = lastWeekWeight[lastWeekWeight.length - 1].weight;
            weightDelta = Math.round((latestThisWeek - latestLastWeek) * 10) / 10;
        }

        const isImproving = thisWeekStats.proteinHitRate >= lastWeekStats.proteinHitRate &&
            thisWeekStats.daysLogged >= lastWeekStats.daysLogged;

        return {
            thisWeek: thisWeekStats,
            lastWeek: lastWeekStats,
            weightDelta,
            isImproving,
        };
    }

    // =====================================================
    // USER SNAPSHOTS
    // =====================================================

    async getSnapshots(userId: string): Promise<any[]> {
        const { data, error } = await (supabase as any)
            .from('user_snapshots')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching snapshots:', error);
            return [];
        }

        return (data || []).map(mapSnapshot);
    }

    async addSnapshot(userId: string, snapshot: { imageUrl: string; date: string; weight?: number; notes?: string }): Promise<any | null> {
        const { data, error } = await (supabase as any)
            .from('user_snapshots')
            .insert({
                user_id: userId,
                image_url: snapshot.imageUrl,
                date: snapshot.date,
                weight: snapshot.weight,
                notes: snapshot.notes
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding snapshot:', error);
            return null;
        }

        return mapSnapshot(data);
    }

    async deleteSnapshot(snapshotId: string): Promise<boolean> {
        const { error } = await (supabase as any)
            .from('user_snapshots')
            .delete()
            .eq('id', snapshotId);

        if (error) {
            console.error('Error deleting snapshot:', error);
            return false;
        }

        return true;
    }

    async updateSnapshot(snapshotId: string, updates: { weight?: number; notes?: string; date?: string }): Promise<any | null> {
        const { data, error } = await (supabase as any)
            .from('user_snapshots')
            .update(updates)
            .eq('id', snapshotId)
            .select()
            .single();

        if (error) {
            console.error('Error updating snapshot:', error);
            return null;
        }

        return mapSnapshot(data);
    }

    // =====================================================
    // INTEGRATED WEIGHT HISTORY
    // =====================================================

    async getIntegratedWeightHistory(userId: string): Promise<any[]> {
        try {
            const [
                { data: bodyMetrics },
                { data: goals },
                { data: snapshots },
                { data: userData }
            ] = await Promise.all([
                (supabase as any).from('body_metrics').select('weight, date').eq('user_id', userId),
                (supabase as any).from('user_fitness_goals').select('starting_weight, starting_date').eq('user_id', userId),
                (supabase as any).from('user_snapshots').select('weight, date').eq('user_id', userId).not('weight', 'is', null),
                (supabase as any).from('users').select('weight, created_at').eq('id', userId).single()
            ]);

            const allPoints: { date: Date; weight: number; source: string }[] = [];

            if (bodyMetrics) {
                bodyMetrics.forEach((m: any) => {
                    allPoints.push({ date: new Date(m.date), weight: Number(m.weight), source: 'metric' });
                });
            }

            if (goals) {
                goals.forEach((g: any) => {
                    if (g.starting_weight && g.starting_date) {
                        allPoints.push({ date: new Date(g.starting_date), weight: Number(g.starting_weight), source: 'goal' });
                    }
                });
            }

            if (snapshots) {
                snapshots.forEach((s: any) => {
                    if (s.weight && s.date) {
                        allPoints.push({ date: new Date(s.date), weight: Number(s.weight), source: 'snapshot' });
                    }
                });
            }

            if (userData && userData.weight && userData.created_at) {
                allPoints.push({ date: new Date(userData.created_at), weight: Number(userData.weight), source: 'profile' });
            }

            if (allPoints.length === 0) return [];

            allPoints.sort((a, b) => a.date.getTime() - b.date.getTime());

            const dailyMap = new Map<string, { date: Date; weight: number; source: string }>();
            const sourcePriority = { metric: 4, goal: 3, snapshot: 2, profile: 1 } as any;

            allPoints.forEach(p => {
                const dayKey = p.date.toISOString().split('T')[0];
                const existing = dailyMap.get(dayKey);
                if (!existing || sourcePriority[p.source] > sourcePriority[existing.source]) {
                    dailyMap.set(dayKey, p);
                }
            });

            return Array.from(dailyMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

        } catch (error) {
            console.error('[ProgressService] Error integrating weight history:', error);
            return [];
        }
    }
}

export const progressService = new ProgressService();
