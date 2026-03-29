import { supabase } from './supabase';
import { DataMapper } from '../utils/dataMapper';

export interface TribeAchievement {
    id: string;
    userId: string;
    tribeId: string;
    achievementType: string;
    unlockedAt: string;
}

export interface AchievementDefinition {
    type: string;
    name: string;
    description: string;
    icon: string;
    checkCondition: (stats: any) => boolean;
}

/**
 * Achievement types and their unlock conditions
 */
export const achievementDefinitions: AchievementDefinition[] = [
    {
        type: 'seven_day_streak',
        name: '7-Day Warrior',
        description: 'Complete workouts 7 days in a row',
        icon: 'fire',
        checkCondition: (stats) => stats.currentStreak >= 7,
    },
    {
        type: 'consistent_member',
        name: 'Consistency King',
        description: 'Complete 4+ workouts per week for 4 weeks',
        icon: 'crown',
        checkCondition: (stats) => stats.fourWeekAverage >= 4,
    },
    {
        type: 'motivator',
        name: 'Team Motivator',
        description: 'Post 10+ encouraging comments',
        icon: 'heart-multiple',
        checkCondition: (stats) => stats.commentsCount >= 10,
    },
    {
        type: 'active_sharer',
        name: 'Progress Champion',
        description: 'Share workout progress 20 times',
        icon: 'trophy-variant',
        checkCondition: (stats) => stats.progressShares >= 20,
    },
    {
        type: 'early_bird',
        name: 'Early Bird',
        description: 'Complete 10 workouts before 7 AM',
        icon: 'weather-sunset-up',
        checkCondition: (stats) => stats.earlyWorkouts >= 10,
    },
];

export const achievementService = {
    /**
     * Check and unlock achievements for a user in a tribe
     */
    async checkAndUnlockAchievements(userId: string, tribeId: string) {
        try {
            // Fetch user stats
            const stats = await this.getUserStats(userId, tribeId);

            // Get already unlocked achievements
            const { data: unlockedRaw } = await (supabase as any)
                .from('room_achievements')
                .select('achievement_type')
                .eq('user_id', userId)
                .eq('room_id', tribeId);

            const unlocked = DataMapper.fromDb(unlockedRaw || []);
            const unlockedTypes = new Set(unlocked.map((a: any) => a.achievementType));

            // Check each achievement
            const newlyUnlocked = [];
            for (const achievement of achievementDefinitions) {
                if (!unlockedTypes.has(achievement.type) && achievement.checkCondition(stats)) {
                    // Unlock achievement
                    const { error } = await (supabase as any)
                        .from('room_achievements')
                        .insert([DataMapper.toDb({
                            userId: userId,
                            roomId: tribeId,
                            achievementType: achievement.type,
                        })]);

                    if (!error) {
                        newlyUnlocked.push(achievement);
                    }
                }
            }

            return newlyUnlocked;
        } catch (error) {
            console.error('[AchievementService] Error checking achievements:', error);
            return [];
        }
    },

    /**
     * Get user statistics for achievement checking
     */
    async getUserStats(userId: string, tribeId: string) {
        // Calculate streak
        const { data: workoutsRaw } = await (supabase as any)
            .from('workout_sessions')
            .select('completed_at')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(100);

        const workouts = DataMapper.fromDb(workoutsRaw || []);

        let currentStreak = 0;
        if (workouts && workouts.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let checkDate = new Date(today);
            for (const workout of workouts) {
                const workoutDate = new Date(workout.completedAt);
                workoutDate.setHours(0, 0, 0, 0);

                if (workoutDate.getTime() === checkDate.getTime()) {
                    currentStreak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else if (workoutDate.getTime() < checkDate.getTime()) {
                    break;
                }
            }
        }

        // Count progress shares
        const { count: progressShares } = await (supabase as any)
            .from('room_posts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('room_id', tribeId)
            .eq('type', 'progress');

        // Count comments
        const { count: commentsCount } = await (supabase as any)
            .from('room_post_comments')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Calculate 4-week average
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

        const { data: recentWorkoutsRaw } = await (supabase as any)
            .from('workout_sessions')
            .select('completed_at')
            .eq('user_id', userId)
            .gte('completed_at', fourWeeksAgo.toISOString());

        const recentWorkouts = DataMapper.fromDb(recentWorkoutsRaw || []);
        const fourWeekAverage = recentWorkouts.length / 4;

        // Count early morning workouts
        const earlyWorkouts = workouts.filter((w: any) => {
            const hour = new Date(w.completedAt).getHours();
            return hour < 7;
        }).length || 0;

        return {
            currentStreak,
            progressShares: progressShares || 0,
            commentsCount: commentsCount || 0,
            fourWeekAverage,
            earlyWorkouts,
        };
    },

    /**
     * Fetch unlocked achievements for a user in a tribe
     */
    async getUserAchievements(userId: string, tribeId: string): Promise<TribeAchievement[]> {
        const { data, error } = await (supabase as any)
            .from('room_achievements')
            .select('*')
            .eq('user_id', userId)
            .eq('room_id', tribeId);

        if (error) {
            console.error('[AchievementService] Error fetching achievements:', error);
            return [];
        }

        return DataMapper.fromDb(data || []);
    },
};
