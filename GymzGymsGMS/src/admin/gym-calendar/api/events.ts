/**
 * API functions for Gym Events CRUD operations
 * Handles all interactions with the events table
 */

import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";

export interface GymEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string; // ISO String
  endDate: string | null; // ISO String
  startTime?: string | null; // HH:mm (derived)
  endTime?: string | null; // HH:mm (derived)
  location: string | null;
  eventType: string | null;
  color: string;
  capacity?: number | null;
  rsvpCount?: number;
  imageUrl?: string | null;
  isActive: boolean;
  gymId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateEventData {
  title: string;
  description?: string;
  eventDate: string; // ISO String
  endDate?: string; // ISO String
  location?: string;
  eventType?: string;
  color?: string;
  capacity?: number;
  imageUrl?: string;
  isActive?: boolean;
  gymId: string;
}

export interface UpdateEventData extends Partial<CreateEventData> { }

/**
 * Helper to add derived time fields for legacy components
 */
function addDerivedTimes(event: GymEvent): GymEvent {
  const date = new Date(event.eventDate);
  event.startTime = formatTime(date);

  if (event.endDate) {
    event.endTime = formatTime(new Date(event.endDate));
  }

  return event;
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Get all events for a gym
 */
export async function getAllEvents(gymId: string): Promise<GymEvent[]> {
  if (!gymId) throw new Error("Gym ID is required to fetch events");

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("gym_id", gymId)
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Error fetching events:", error);
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  const events = DataMapper.fromDb<GymEvent[]>(data || []);
  return events.map(addDerivedTimes);
}

/**
 * Get events for a specific date
 */
export async function getEventsByDate(dateStr: string, gymId: string): Promise<GymEvent[]> {
  // dateStr is YYYY-MM-DD
  const startOfDay = `${dateStr}T00:00:00Z`;
  const endOfDay = `${dateStr}T23:59:59Z`;

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("gym_id", gymId)
    .gte("event_date", startOfDay)
    .lte("event_date", endOfDay)
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Error fetching events by date:", error);
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  const events = DataMapper.fromDb<GymEvent[]>(data || []);
  return events.map(addDerivedTimes);
}

/**
 * Get events for a date range
 */
export async function getEventsByDateRange(
  startDate: string,
  endDate: string,
  gymId: string
): Promise<GymEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("gym_id", gymId)
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Error fetching events by date range:", error);
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  const events = DataMapper.fromDb<GymEvent[]>(data || []);
  return events.map(addDerivedTimes);
}

/**
 * Get a single event by ID
 */
export async function getEventById(id: string): Promise<GymEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching event:", error);
    throw new Error(`Failed to fetch event: ${error.message}`);
  }

  const event = DataMapper.fromDb<GymEvent>(data);
  return event ? addDerivedTimes(event) : null;
}

/**
 * Create a new event
 */
export async function createEvent(eventData: CreateEventData, userId?: string): Promise<GymEvent> {
  const payload = DataMapper.toDb({
    ...eventData,
    createdBy: userId || null,
    isActive: eventData.isActive ?? true,
  });

  const { data, error } = await supabase
    .from("events")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Error creating event:", error);
    throw new Error(`Failed to create event: ${error.message}`);
  }

  const event = DataMapper.fromDb<GymEvent>(data);
  return addDerivedTimes(event);
}

/**
 * Update an existing event
 */
export async function updateEvent(
  id: string,
  eventData: UpdateEventData
): Promise<GymEvent> {
  const payload = DataMapper.toDb({
    ...eventData,
    updatedAt: new Date().toISOString(),
  });

  const { data, error } = await supabase
    .from("events")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating event:", error);
    throw new Error(`Failed to update event: ${error.message}`);
  }

  const event = DataMapper.fromDb<GymEvent>(data);
  return addDerivedTimes(event);
}

/**
 * Delete an event
 */
export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    console.error("Error deleting event:", error);
    throw new Error(`Failed to delete event: ${error.message}`);
  }
}

