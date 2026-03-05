/**
 * API functions for User Calendar Selections
 * Handles all interactions with the user_calendar_selections table
 */

import { supabase } from "@/integrations/supabase/client";

export interface UserCalendarSelection {
    id: string;
    user_id: string;
    schedule_id: string | null;
    event_id: string | null;
    created_at: string;
}

/**
 * Get all calendar selections for a user
 */
export async function getUserCalendarSelections(userId: string): Promise<UserCalendarSelection[]> {
    const { data, error } = await supabase
        .from("user_calendar_selections")
        .select("*")
        .eq("user_id", userId);

    if (error) {
        console.error("Error fetching user calendar selections:", error);
        throw new Error(`Failed to fetch selections: ${error.message}`);
    }

    return data || [];
}

/**
 * Add a selection to the user's personal calendar
 */
export async function addCalendarSelection(
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

    const { data, error } = await supabase
        .from("user_calendar_selections")
        .insert([insertData])
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            // Unique constraint violation, already selected
            return data as any;
        }
        console.error("Error adding calendar selection:", error);
        throw new Error(`Failed to add selection: ${error.message}`);
    }

    return data;
}

/**
 * Remove a selection from the user's personal calendar
 */
export async function removeCalendarSelection(
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
        console.error("Error removing calendar selection:", error);
        throw new Error(`Failed to remove selection: ${error.message}`);
    }
}

/**
 * Toggle a selection (add if missing, remove if present)
 */
export async function toggleCalendarSelection(
    userId: string,
    targetId: string,
    type: 'schedule' | 'event',
    currentSelections: UserCalendarSelection[]
): Promise<boolean> {
    const isSelected = type === 'schedule'
        ? currentSelections.some(s => s.schedule_id === targetId)
        : currentSelections.some(s => s.event_id === targetId);

    if (isSelected) {
        await removeCalendarSelection(userId, targetId, type);
        return false; // Removed
    } else {
        await addCalendarSelection(userId, targetId, type);
        return true; // Added
    }
}
