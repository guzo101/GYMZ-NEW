/**
 * API functions for Gym Classes CRUD operations
 * Handles all interactions with the gym_classes table
 */

import { supabase } from "@/integrations/supabase/client";

export interface GymClass {
  id: string;
  name: string;
  description: string | null;
  difficulty: string | null;
  trainer_name: string | null;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface CreateClassData {
  name: string;
  description?: string;
  difficulty?: string;
  trainer_name?: string;
  duration_minutes: number;
}

export interface UpdateClassData extends Partial<CreateClassData> {}

/**
 * Get all gym classes
 */
export async function getAllClasses(): Promise<GymClass[]> {
  const { data, error } = await supabase
    .from("gym_classes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching classes:", error);
    throw new Error(`Failed to fetch classes: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single class by ID
 */
export async function getClassById(id: string): Promise<GymClass | null> {
  const { data, error } = await supabase
    .from("gym_classes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching class:", error);
    throw new Error(`Failed to fetch class: ${error.message}`);
  }

  return data;
}

/**
 * Create a new gym class
 */
export async function createClass(classData: CreateClassData): Promise<GymClass> {
  const { data, error } = await supabase
    .from("gym_classes")
    .insert([classData])
    .select()
    .single();

  if (error) {
    console.error("Error creating class:", error);
    throw new Error(`Failed to create class: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing gym class
 */
export async function updateClass(
  id: string,
  classData: UpdateClassData
): Promise<GymClass> {
  const { data, error } = await supabase
    .from("gym_classes")
    .update(classData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating class:", error);
    throw new Error(`Failed to update class: ${error.message}`);
  }

  return data;
}

/**
 * Delete a gym class (will cascade delete schedules)
 */
export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from("gym_classes").delete().eq("id", id);

  if (error) {
    console.error("Error deleting class:", error);
    throw new Error(`Failed to delete class: ${error.message}`);
  }
}

