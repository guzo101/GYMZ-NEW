import { supabase } from './supabase';
import { achievementService } from './achievementService';
import { DataMapper } from '../utils/dataMapper';

export const gamificationService = {
    async addXP(userId: string, points: number, actionType: string) {
        try {
            // 1. Log transaction
            await (supabase as any)
                .from('xp_transactions')
                .insert([DataMapper.toDb({
                    userId: userId,
                    points: points,
                    actionType: actionType
                })]);

            // 2. Update Leaderboard Data (Cache)
            const { data: lbRaw } = await (supabase as any)
                .from('leaderboard_data')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            const lb = DataMapper.fromDb(lbRaw);

            if (lb) {
                await (supabase as any)
                    .from('leaderboard_data')
                    .update(DataMapper.toDb({
                        totalPoints: lb.totalPoints + points,
                        weeklyPoints: lb.weeklyPoints + points,
                        lastUpdatedAt: new Date().toISOString()
                    }))
                    .eq('user_id', userId);
            } else {
                await (supabase as any)
                    .from('leaderboard_data')
                    .insert([DataMapper.toDb({
                        userId: userId,
                        totalPoints: points,
                        weeklyPoints: points,
                        rank: 999
                    })]);
            }

            // 3. Check for achievements based on action
            if (actionType === 'meal_logged') {
                await achievementService.checkAndUnlockAchievements(userId, 'nutrition_log');
            }
            if (actionType === 'workout_completed') {
                await achievementService.checkAndUnlockAchievements(userId, 'first_workout');
            }

            return true;
        } catch (error) {
            console.error('Gamification Error:', error);
            return false;
        }
    }
};
