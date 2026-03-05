-- Migration: Create Events table for Gym Calendar
-- This migration creates the events table for admin-created calendar events

-- Create Events table
CREATE TABLE IF NOT EXISTS gym_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  event_type TEXT, -- e.g., "Holiday", "Maintenance", "Special Event", "Workshop"
  color TEXT DEFAULT '#3b82f6', -- Hex color for calendar display
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_gym_events_date ON gym_events(event_date);
CREATE INDEX IF NOT EXISTS idx_gym_events_created_by ON gym_events(created_by);

-- Add comments for documentation
COMMENT ON TABLE gym_events IS 'Stores calendar events created by admins (holidays, maintenance, special events, etc.)';
COMMENT ON COLUMN gym_events.event_type IS 'Type of event (Holiday, Maintenance, Special Event, Workshop, etc.)';
COMMENT ON COLUMN gym_events.color IS 'Hex color code for calendar display';

