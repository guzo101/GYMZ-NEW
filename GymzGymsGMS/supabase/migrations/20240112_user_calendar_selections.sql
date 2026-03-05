-- Migration: Create User Calendar Selections Table
-- This table stores which gym classes or events a user has added to their personal calendar.

CREATE TABLE IF NOT EXISTS user_calendar_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES gym_class_schedules(id) ON DELETE CASCADE,
  event_id UUID REFERENCES gym_events(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure that exactly one of schedule_id or event_id is provided
  CONSTRAINT one_target_selection CHECK (
    (schedule_id IS NOT NULL AND event_id IS NULL) OR
    (schedule_id IS NULL AND event_id IS NOT NULL)
  )
);

-- Unique constraints to prevent duplicate selections for the same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_schedule_selection ON user_calendar_selections (user_id, schedule_id) WHERE schedule_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_event_selection ON user_calendar_selections (user_id, event_id) WHERE event_id IS NOT NULL;

-- Enable RLS
ALTER TABLE user_calendar_selections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own selections
CREATE POLICY "Users can view their own selections"
ON user_calendar_selections
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own selections
CREATE POLICY "Users can insert their own selections"
ON user_calendar_selections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own selections
CREATE POLICY "Users can delete their own selections"
ON user_calendar_selections
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all selections (for GMS dashboard)
CREATE POLICY "Admins can view all selections"
ON user_calendar_selections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE public.users.id = auth.uid()
    AND public.users.role = 'admin'
  )
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_user_calendar_selections_user_id ON user_calendar_selections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_calendar_selections_schedule_id ON user_calendar_selections(schedule_id);
CREATE INDEX IF NOT EXISTS idx_user_calendar_selections_event_id ON user_calendar_selections(event_id);

-- Add comments for documentation
COMMENT ON TABLE user_calendar_selections IS 'Stores user-specific selections for their personal gym calendar';
COMMENT ON COLUMN user_calendar_selections.user_id IS 'The user who made the selection';
COMMENT ON COLUMN user_calendar_selections.schedule_id IS 'The specific class schedule selected';
COMMENT ON COLUMN user_calendar_selections.event_id IS 'The specific gym event selected';
