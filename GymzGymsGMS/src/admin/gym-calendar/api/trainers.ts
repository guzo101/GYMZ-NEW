/**
 * API functions for fetching trainers/staff
 * Handles fetching available trainers from the staff table
 */

import { supabase } from "@/integrations/supabase/client";

export interface Trainer {
  id: string;
  name: string;
  role: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
}

/**
 * Get all active trainers/staff members
 */
export async function getAllTrainers(): Promise<Trainer[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, role, department, email, phone, status")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching trainers:", error);
    throw new Error(`Failed to fetch trainers: ${error.message}`);
  }

  // Filter to only active staff if status field exists
  return (data || []).filter(
    (trainer) => !trainer.status || trainer.status === "Active"
  );
}

