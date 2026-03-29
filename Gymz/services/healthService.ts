import { supabase } from './supabase';
import { DataMapper } from '../utils/dataMapper';

export interface HealthLog {
    id?: string;
    userId: string;
    date: string;
    steps: number;
    sleepMinutes: number;
    activeMinutes: number;
    waterMl: number;
}

export const healthService = {
    /**
     * Fetch health log for a specific date
     */
    async getDailyLog(userId: string, date: string): Promise<HealthLog | null> {
        const { data, error } = await (supabase as any)
            .from('daily_health_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle();

        if (error) {
            console.error('[HealthService] Error fetching log:', error);
            return null;
        }
        return data ? DataMapper.fromDb<HealthLog>(data) : null;
    },

    /**
     * Update or insert health log for a specific date
     */
    async updateDailyLog(userId: string, updates: Partial<HealthLog>, date?: string): Promise<void> {
        const targetDate = date || new Date().toISOString().split('T')[0];

        const { error } = await (supabase as any)
            .from('daily_health_logs')
            .upsert(DataMapper.toDb({
                userId: userId,
                date: targetDate,
                ...updates,
                updatedAt: new Date().toISOString()
            }), { onConflict: 'user_id,date' });

        if (error) {
            console.error('[HealthService] Error updating log:', error);
            throw new Error(`daily_health_logs upsert failed: ${error.message}`);
        }
    },

    /**
     * Specialized: Update steps
     */
    async syncSteps(userId: string, steps: number): Promise<void> {
        await this.updateDailyLog(userId, { steps });
    },

    /**
     * Specialized: Log Sleep
     */
    async logSleep(userId: string, minutes: number): Promise<void> {
        await this.updateDailyLog(userId, { sleepMinutes: minutes });
    },

    /**
     * Specialized: Update Active Minutes
     */
    async syncActiveMinutes(userId: string, minutes: number): Promise<void> {
        await this.updateDailyLog(userId, { activeMinutes: minutes });
    }
};
