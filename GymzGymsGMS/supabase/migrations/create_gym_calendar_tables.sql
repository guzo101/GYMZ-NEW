-- Migration: Create Gym Calendar System Tables
-- This migration creates the Classes and ClassSchedule tables for the gym calendar feature

-- Create Classes table
CREATE TABLE IF NOT EXISTS gym_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  difficulty TEXT,
  trainer_name TEXT,
  duration_minutes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ClassSchedule table
CREATE TABLE IF NOT EXISTS gym_class_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES gym_classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  slots_available INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_date CHECK (date >= CURRENT_DATE)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_gym_class_schedules_class_id ON gym_class_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_gym_class_schedules_date ON gym_class_schedules(date);
CREATE INDEX IF NOT EXISTS idx_gym_class_schedules_date_time ON gym_class_schedules(date, start_time);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to auto-update updated_at
CREATE TRIGGER update_gym_classes_updated_at
  BEFORE UPDATE ON gym_classes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gym_class_schedules_updated_at
  BEFORE UPDATE ON gym_class_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE gym_classes IS 'Stores gym class definitions (e.g., Yoga, HIIT, Cardio)';
COMMENT ON TABLE gym_class_schedules IS 'Stores scheduled instances of gym classes with specific dates and times';
COMMENT ON COLUMN gym_classes.difficulty IS 'Class difficulty level (e.g., Beginner, Intermediate, Advanced)';
COMMENT ON COLUMN gym_class_schedules.slots_available IS 'Number of available spots for booking';

