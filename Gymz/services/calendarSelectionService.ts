/**
 * Service for User Calendar Selections (Mobile App)
 * Handles all interactions with the user_calendar_selections table
 */

import { supabase } from './supabase';

export interface UserCalendarSelection {
    id: string;
    user_id: string;
    schedule_id: string | null;
    event_id: string | null;
    created_at: string;
}

export const calendarSelectionService = {
    /**
     * Get all calendar selections for a user
     */
    async getUserCalendarSelections(userId: string): Promise<UserCalendarSelection[]> {
        const { data, error } = await supabase
            .from("user_calendar_selections")
            .select("*")
            .eq("user_id", userId);

        if (error) {
            console.error("[Calendar Selection] Error fetching:", error);
            throw error;
        }

        return data || [];
    },

    /**
     * Add a selection to the user's personal calendar
     */
    async addCalendarSelection(
        userId: string,
        targetId: string,
        type: 'schedule' | 'event'
    ): Promise<UserCalendarSelection> {
        const insertData: any = {
            user_id: userId,
        };

        if (type === 'schedule') {
            insertData.schedule_id = targetId;
        } else {
            insertData.event_id = targetId;
        }

        // @ts-ignore
        const { data, error } = await (supabase
            .from("user_calendar_selections")
            .insert([insertData] as any))
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return data as any;
            }
            console.error("[Calendar Selection] Error adding:", error);
            throw error;
        }

        return data;
    },

    /**
     * Remove a selection from the user's personal calendar
     */
    async removeCalendarSelection(
        userId: string,
        targetId: string,
        type: 'schedule' | 'event'
    ): Promise<void> {
        let query = supabase
            .from("user_calendar_selections")
            .delete()
            .eq("user_id", userId);

        if (type === 'schedule') {
            query = query.eq("schedule_id", targetId);
        } else {
            query = query.eq("event_id", targetId);
        }

        const { error } = await query;

        if (error) {
            console.error("[Calendar Selection] Error removing:", error);
            throw error;
        }
    },

    /**
     * Toggle a selection
     */
    async toggleSelection(
        userId: string,
        targetId: string,
        type: 'schedule' | 'event',
        currentSelections: UserCalendarSelection[]
    ): Promise<boolean> {
        const isSelected = type === 'schedule'
            ? currentSelections.some(s => s.schedule_id === targetId)
            : currentSelections.some(s => s.event_id === targetId);

        if (isSelected) {
            await this.removeCalendarSelection(userId, targetId, type);
            return false; // Removed
        } else {
            await this.addCalendarSelection(userId, targetId, type);
            return true; // Added
        }
    }
};
