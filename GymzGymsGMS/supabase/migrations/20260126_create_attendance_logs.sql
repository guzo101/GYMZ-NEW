-- Migration: Create attendance_logs table
-- This table will store a history of all successful member check-ins

CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    checkin_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    status TEXT DEFAULT 'approved',
    membership_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can view all attendance logs"
ON public.attendance_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can insert attendance logs"
ON public.attendance_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Member policies (members can view their own logs)
CREATE POLICY "Members can view their own attendance logs"
ON public.attendance_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_id ON public.attendance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_checkin_time ON public.attendance_logs(checkin_time DESC);

-- Add comment
COMMENT ON TABLE public.attendance_logs IS 'History of member gym check-ins for trend analysis';
