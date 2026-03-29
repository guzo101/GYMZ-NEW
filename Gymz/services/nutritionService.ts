import { supabase } from './supabase';
import { gamificationService } from './gamificationService';
import { calculateBMR, calculateTDEE, calculateMacroSplit } from '../utils/healthMath';
import { DataMapper } from '../utils/dataMapper';

export interface NutritionLog {
    logId?: string;
    userId: string;
    foodName: string;
    quantity: number;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    fiber?: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    loggedAt: string;
    barcodeScanned?: boolean;
    imageUrl?: string;
}

export interface MacroTargets {
    targetId?: string;
    userId: string;
    dailyCalorieGoal: number;
    dailyProteinGoal: number;
    dailyCarbsGoal: number;
    dailyFatsGoal: number;
    dailyFiberGoal: number;
    date: string;
}

// SANITIZATION LAYER removed in favor of DataMapper

export const nutritionService = {
    async fetchDailyLogs(userId: string, date: string): Promise<NutritionLog[]> {
        const startOfDay = `${date}T00:00:00Z`;
        const endOfDay = `${date}T23:59:59Z`;

        const { data, error } = await (supabase as any)
            .from('daily_nutrition_logs')
            .select('*')
            .eq('user_id', userId)
            .gte('logged_at', startOfDay)
            .lte('logged_at', endOfDay)
            .order('logged_at', { ascending: true });

        if (error) {
            console.error('Error fetching nutrition logs:', error);
            throw error;
        }

        return DataMapper.fromDb(data || []);
    },

    async logMeal(meal: NutritionLog): Promise<NutritionLog> {
        const { data, error } = await (supabase as any)
            .from('daily_nutrition_logs')
            .insert([DataMapper.toDb(meal)])
            .select()
            .single();

        if (error) {
            console.error('Error logging meal:', error);
            throw error;
        }

        // Grant XP for logging nutrition (Legacy gamification)
        await gamificationService.addXP(meal.userId, 50, 'meal_logged');

        // Trigger Retention Engine Tracking (New System)
        try {
            const { retentionService } = await import('./retentionService');
            await retentionService.trackActivity(meal.userId, 'meal');
        } catch (e) {
            console.warn('[NutritionService] Retention tracking failed:', e);
        }

        return DataMapper.fromDb(data);
    },

    async getMacroTargets(userId: string, date: string): Promise<MacroTargets | null> {
        // SSOT Enforcement: We pull from user_fitness_goals, which is managed by the Medical Engine.
        // We ignore the 'date' parameter because goals are persistent until recalculated.
        // If historical goals are needed, that would be in a separate snapshot table.
        const { data, error } = await (supabase as any)
            .from('user_fitness_goals')
            .select(`
                daily_calorie_goal,
                daily_protein_goal,
                daily_carbs_goal,
                daily_fats_goal,
                daily_fiber_goal
            `)
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            console.error('[NutritionService] SSOT Fetch Error:', error);
            throw error;
        }

        if (!data) return null;

        return DataMapper.fromDb({
            ...data,
            userId: userId,
            date: date
        });
    },

    async deleteLog(logId: string): Promise<void> {
        const { error } = await (supabase as any)
            .from('daily_nutrition_logs')
            .delete()
            .eq('log_id', logId);

        if (error) {
            console.error('Error deleting nutrition log:', error);
            throw error;
        }
    },

    async fetchWaterIntake(userId: string, date: string): Promise<number> {
        console.log(`[NutritionService] Fetching water for ${userId} on ${date}`);

        const [modernResult, legacyResult] = await Promise.allSettled([
            (supabase as any).from('water_logs').select('amount').eq('user_id', userId).eq('date', date),
            (supabase as any).from('daily_nutrition_logs').select('quantity')
                .eq('user_id', userId)
                .eq('food_name', 'Water Intake')
                .gte('logged_at', `${date}T00:00:00Z`)
                .lte('logged_at', `${date}T23:59:59Z`)
        ]);

        let total = 0;

        if (modernResult.status === 'fulfilled' && !modernResult.value.error) {
            const data = modernResult.value.data;
            total += data?.reduce((sum: number, row: any) => sum + (Number(row.amount) || 0), 0) || 0;
        }

        if (legacyResult.status === 'fulfilled' && !legacyResult.value.error) {
            const data = legacyResult.value.data;
            total += data?.reduce((sum: number, row: any) => sum + (Number(row.quantity) || 0), 0) || 0;
        }

        return total;
    },

    async logWaterIntake(userId: string, amount: number, date: string): Promise<void> {
        const row = {
            user_id: userId,
            amount: amount,
            date: date
        };

        // Try modern path first
        const { error } = await (supabase as any)
            .from('water_logs')
            .insert([DataMapper.toDb({
                userId: userId,
                amount: amount,
                date: date
            })]);

        if (error) {
            console.warn(`[NutritionService] water_logs write failed (Code: ${error.code}). Falling back to legacy logs.`, error.message);

            // FAILOVER: Record to daily_nutrition_logs
            const legacyRow: NutritionLog = {
                userId: userId,
                foodName: 'Water Intake',
                quantity: amount,
                calories: 0,
                protein: 0,
                carbs: 0,
                fats: 0,
                mealType: 'snack',
                loggedAt: new Date().toISOString()
            };
            await this.logMeal(legacyRow);
        }
    },

    /**
     * Interconnects health metrics with nutrition targets.
     * Calculates personalized Calories and Macros based on profile.
     */
    async syncNutritionTargets(userId: string): Promise<any> {
        console.log(`[NutritionService] Personalizing targets for: ${userId}`);

        // 1. Fetch latest profile
        const { data: profileRaw, error: pError } = await (supabase as any)
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        const profile = DataMapper.fromDb(profileRaw);

        if (pError || !profile) {
            console.error('[NutritionService] Profile fetch failed:', pError);
            return null;
        }

        // 2. Extract metrics and check both top-level columns AND nested metadata (matches Dashboard SSOT logic)
        const weight = Number(profile.weight ?? profile.metadata?.weight) || 0;
        const height = Number(profile.height ?? profile.metadata?.height) || 0;
        const age = Number(profile.age ?? profile.metadata?.age) || 0;
        const gender = (profile.gender || profile.metadata?.gender || '').toLowerCase();
        const goal = profile.primaryObjective || profile.goal || profile.metadata?.fitnessGoal || 'recomp';
        const workoutIntensity = profile.workoutIntensity || profile.metadata?.workoutIntensity;

        if (!weight || !height || !age || !gender || (gender !== 'male' && gender !== 'female')) {
            console.warn('[NutritionService] Real metrics missing or invalid for user:', { userId, weight, height, age, gender });
            return null; // Skip calculation if real data is absent or basic gender is unknown
        }

        // 3. Calculate BMR & TDEE
        const bmr = calculateBMR(weight, height, age, gender);
        let activityKey: any = 'MODERATELY_ACTIVE';
        if (workoutIntensity === 'low') activityKey = 'LIGHTLY_ACTIVE';
        if (workoutIntensity === 'high') activityKey = 'VERY_ACTIVE';
        if (workoutIntensity === 'extreme') activityKey = 'EXTREMELY_ACTIVE';

        const tdee = calculateTDEE(bmr, activityKey);

        // 4. Adjust Calories based on Goal
        let targetCalories = tdee;
        if (goal === 'lose_weight' || goal === 'weight_loss') targetCalories -= 500;
        if (goal === 'build_muscle' || goal === 'muscle_gain') targetCalories += 300;
        targetCalories = Math.max(1200, targetCalories);

        // 5. Calculate Macros
        const macros = calculateMacroSplit(targetCalories, goal, weight);
        // Fiber target aligned with calories (14g per 1000 kcal), clamped for practical range.
        const dailyFiberGoal = Math.min(45, Math.max(25, Math.round((targetCalories / 1000) * 14)));

        // 6. Update user_fitness_goals (or daily targets if preferred, but user_fitness_goals is the "Interconnected" baseline)
        // REQUIRES: unique_user_active_goal UNIQUE (user_id, is_active) — see migration 20260313
        const updates = {
            userId: userId,
            gymId: profile.gymId ?? null,
            goalType: goal,
            dailyCalorieGoal: targetCalories,
            dailyProteinGoal: macros.protein,
            dailyCarbsGoal: macros.carbs,
            dailyFatsGoal: macros.fat,
            dailyFiberGoal,
            isActive: true,
            updatedAt: new Date().toISOString()
        };

        console.log('[NutritionService] UPSERTing goals:', updates);

        const { data, error } = await (supabase as any)
            .from('user_fitness_goals')
            .upsert(DataMapper.toDb(updates), {
                onConflict: 'user_id, is_active',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error) {
            console.error('[NutritionService] Goal update failed (SSOT sync):', error.message || error);
            return null;
        }

        console.log('[NutritionService] ✅ Sync Success. Database confirmed target:', data.daily_calorie_goal);
        return data;
    }
};
