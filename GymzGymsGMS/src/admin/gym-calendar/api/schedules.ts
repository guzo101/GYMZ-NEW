/**
 * API functions for Class Schedule CRUD operations
 * Handles all interactions with the gym_class_schedules table
 */

import { supabase } from "@/integrations/supabase/client";

export interface ClassSchedule {
  id: string;
  class_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  room: string | null;
  slots_available: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  gym_classes?: {
    id: string;
    name: string;
    description: string | null;
    difficulty: string | null;
    trainer_name: string | null;
    duration_minutes: number;
  };
}

export interface CreateScheduleData {
  class_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  room?: string;
  slots_available: number;
}

export interface UpdateScheduleData extends Partial<CreateScheduleData> { }

/**
 * Get all schedules with class information
 */
export async function getAllSchedules(): Promise<ClassSchedule[]> {
  const { data, error } = await supabase
    .from("gym_class_schedules")
    .select(`
      *,
      gym_classes (
        id,
        name,
        description,
        difficulty,
        trainer_name,
        duration_minutes
      )
    `)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching schedules:", error);
    throw new Error(`Failed to fetch schedules: ${error.message}`);
  }

  return data || [];
}

/**
 * Get schedules for a specific date
 */
export async function getSchedulesByDate(date: string): Promise<ClassSchedule[]> {
  const { data, error } = await supabase
    .from("gym_class_schedules")
    .select(`
      *,
      gym_classes (
        id,
        name,
        description,
        difficulty,
        trainer_name,
        duration_minutes
      )
    `)
    .eq("date", date)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching schedules by date:", error);
    throw new Error(`Failed to fetch schedules: ${error.message}`);
  }

  return data || [];
}

/**
 * Get schedules for a date range
 */
export async function getSchedulesByDateRange(
  startDate: string,
  endDate: string
): Promise<ClassSchedule[]> {
  const { data, error } = await supabase
    .from("gym_class_schedules")
    .select(`
      *,
      gym_classes (
        id,
        name,
        description,
        difficulty,
        trainer_name,
        duration_minutes
      )
    `)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching schedules by date range:", error);
    throw new Error(`Failed to fetch schedules: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single schedule by ID
 */
export async function getScheduleById(id: string): Promise<ClassSchedule | null> {
  const { data, error } = await supabase
    .from("gym_class_schedules")
    .select(`
      *,
      gym_classes (
        id,
        name,
        description,
        difficulty,
        trainer_name,
        duration_minutes
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching schedule:", error);
    throw new Error(`Failed to fetch schedule: ${error.message}`);
  }

  return data;
}

/**
 * Create a new schedule
 */
export async function createSchedule(
  scheduleData: CreateScheduleData
): Promise<ClassSchedule> {
  // Validate time range
  if (scheduleData.end_time <= scheduleData.start_time) {
    throw new Error("End time must be after start time");
  }

  // Validate date is not in the past
  const scheduleDate = new Date(scheduleData.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (scheduleDate < today) {
    throw new Error("Cannot schedule classes in the past");
  }

  const { data, error } = await supabase
    .from("gym_class_schedules")
    .insert([scheduleData])
    .select(`
      *,
      gym_classes (
        id,
        name,
        description,
        difficulty,
        trainer_name,
        duration_minutes
      )
    `)
    .single();

  if (error) {
    console.error("Error creating schedule:", error);
    throw new Error(`Failed to create schedule: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing schedule
 */
export async function updateSchedule(
  id: string,
  scheduleData: UpdateScheduleData
): Promise<ClassSchedule> {
  // Validate time range if both times are provided
  if (
    scheduleData.start_time &&
    scheduleData.end_time &&
    scheduleData.end_time <= scheduleData.start_time
  ) {
    throw new Error("End time must be after start time");
  }

  // Validate date is not in the past if date is being updated
  if (scheduleData.date) {
    const scheduleDate = new Date(scheduleData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (scheduleDate < today) {
      throw new Error("Cannot schedule classes in the past");
    }
  }

  const { data, error } = await supabase
    .from("gym_class_schedules")
    .update(scheduleData)
    .eq("id", id)
    .select(`
      *,
      gym_classes (
        id,
        name,
        description,
        difficulty,
        trainer_name,
        duration_minutes
      )
    `)
    .single();

  if (error) {
    console.error("Error updating schedule:", error);
    throw new Error(`Failed to update schedule: ${error.message}`);
  }

  return data;
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from("gym_class_schedules")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting schedule:", error);
    throw new Error(`Failed to delete schedule: ${error.message}`);
  }
}

/**
 * Check for time conflicts in a room
 */
export async function checkTimeConflict(
  date: string,
  startTime: string,
  endTime: string,
  room: string | null,
  excludeScheduleId?: string
): Promise<boolean> {
  let query = supabase
    .from("gym_class_schedules")
    .select("id")
    .eq("date", date)
    .or(
      `and(start_time.lt.${endTime},end_time.gt.${startTime})`
    );

  if (room) {
    query = query.eq("room", room);
  }

  if (excludeScheduleId) {
    query = query.neq("id", excludeScheduleId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error checking time conflict:", error);
    return false; // Assume no conflict if check fails
  }

  return (data?.length || 0) > 0;
}

/**
 * Publish a schedule to the calendar (make it visible)
 * Checks for conflicts before publishing
 */
export async function publishSchedule(id: string): Promise<{ success: boolean; conflict?: ClassSchedule }> {
  // First, get the schedule details
  const schedule = await getScheduleById(id);
  if (!schedule) {
    throw new Error("Schedule not found");
  }

  // Check for time conflicts with other published schedules
  const { data: conflictingSchedules, error } = await supabase
    .from("gym_class_schedules")
    .select(`
      *,
      gym_classes (
        id,
        name,
        description,
        difficulty,
        trainer_name,
        duration_minutes
      )
    `)
    .eq("date", schedule.date)
    .eq("is_published", true)
    .neq("id", id);

  if (error) {
    console.error("Error checking for conflicts:", error);
    throw new Error(`Failed to check for conflicts: ${error.message}`);
  }

  // Check for time overlaps
  const hasConflict = (conflictingSchedules || []).some((existing) => {
    // Check if times overlap
    const scheduleStart = schedule.start_time;
    const scheduleEnd = schedule.end_time;
    const existingStart = existing.start_time;
    const existingEnd = existing.end_time;

    // If same room, check for time overlap
    if (schedule.room && existing.room && schedule.room === existing.room) {
      return scheduleStart < existingEnd && scheduleEnd > existingStart;
    }

    return false;
  });

  if (hasConflict) {
    const conflictingSchedule = (conflictingSchedules || []).find((existing) => {
      const scheduleStart = schedule.start_time;
      const scheduleEnd = schedule.end_time;
      const existingStart = existing.start_time;
      const existingEnd = existing.end_time;

      if (schedule.room && existing.room && schedule.room === existing.room) {
        return scheduleStart < existingEnd && scheduleEnd > existingStart;
      }

      return false;
    });

    return {
      success: false,
      conflict: conflictingSchedule,
    };
  }

  // No conflicts, publish the schedule
  const { error: updateError } = await supabase
    .from("gym_class_schedules")
    .update({ is_published: true })
    .eq("id", id);

  if (updateError) {
    console.error("Error publishing schedule:", updateError);
    throw new Error(`Failed to publish schedule: ${updateError.message}`);
  }

  return { success: true };
}

/**
 * Unpublish a schedule from the calendar (hide it)
 */
export async function unpublishSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from("gym_class_schedules")
    .update({ is_published: false })
    .eq("id", id);

  if (error) {
    console.error("Error unpublishing schedule:", error);
    throw new Error(`Failed to unpublish schedule: ${error.message}`);
  }
}

