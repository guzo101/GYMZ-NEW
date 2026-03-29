import { supabase } from './supabase';
import { DataMapper } from '../utils/dataMapper';

export interface LeaderboardUser {
    userId: string;
    name: string;
    avatarUrl: string;
    totalPoints: number;
    rank: number;
    accessMode: 'gym_access' | 'event_access';
}

export const leaderboardService = {
    async fetchGlobalLeaderboard(limit = 20) {
        try {
            // In a real app, we might use the leaderboard_data cache table
            // or perform a complex aggregation. Let's use leaderboard_data
            // and join it with users to get real information.

            const { data, error } = await (supabase as any)
                .from('leaderboard_data')
                .select(`
                    user_id,
                    total_points,
                    weekly_points,
                    rank,
                    users!id (
                        name,
                        avatar_url,
                        access_mode
                    )
                `)
                .order('total_points', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return (data || []).map((item: any, index: number) => {
                const mapped = DataMapper.fromDb(item);
                const user = DataMapper.fromDb(item.users);
                return {
                    userId: mapped.userId,
                    name: user?.name || 'Gymz Member',
                    avatarUrl: user?.avatarUrl,
                    totalPoints: mapped.totalPoints,
                    rank: index + 1,
                    accessMode: user?.accessMode || 'gym_access'
                };
            });
        } catch (error) {
            console.error('Leaderboard fetch error:', error);
            return [];
        }
    },

    async getUserRank(userId: string) {
        const { data, error } = await (supabase as any)
            .from('leaderboard_data')
            .select('rank, total_points')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) return null;
        return DataMapper.fromDb<any>(data);
    }
};
