import { supabase } from './supabase';
import { gamificationService } from './gamificationService';
import { DataMapper } from '../utils/dataMapper';

export interface WorkoutLog {
    exerciseName: string;
    sets: number;
    reps: number;
    weight: number;
    duration: number;
    intensityLevel: string;
    formScore?: number;
    userId: string;
    completedAt?: string;
}

export const workoutService = {
    async logWorkout(log: WorkoutLog) {
        try {
            // 1. Insert Workout Session
            const { data: session, error: workoutError } = await (supabase as any)
                .from('workout_sessions')
                .insert([DataMapper.toDb(log)])
                .select()
                .single();

            if (workoutError) throw workoutError;

            // 2. Grant XP via logical service
            let points = 100;
            if (log.intensityLevel === 'High') points += 50;
            if (log.duration > 45) points += 50;

            await gamificationService.addXP(log.userId, points, 'workout_completed');

            return { session: DataMapper.fromDb(session), points };
        } catch (error) {
            console.error('Error logging workout:', error);
            throw error;
        }
    },

    async fetchRecentWorkouts(userId: string, limit = 5) {
        const { data, error } = await (supabase as any)
            .from('workout_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return DataMapper.fromDb(data);
    }
};
