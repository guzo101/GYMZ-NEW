-- Migration: Create gym_class_bookings table
-- This migration creates a bookings table for gym class schedules

CREATE TABLE IF NOT EXISTS gym_class_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES gym_class_schedules(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, schedule_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_gym_class_bookings_user_id ON gym_class_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_class_bookings_schedule_id ON gym_class_bookings(schedule_id);

-- Add comments for documentation
COMMENT ON TABLE gym_class_bookings IS 'Stores member bookings for scheduled gym classes';
COMMENT ON COLUMN gym_class_bookings.schedule_id IS 'References gym_class_schedules table';

