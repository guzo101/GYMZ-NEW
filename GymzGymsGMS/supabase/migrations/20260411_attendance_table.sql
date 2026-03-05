-- Migration: Create/ensure attendance table for member app check-in
-- App uses "attendance" with check_in_time (not attendance_logs with checkin_time)
-- Date: 2026-04-11

CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'checked_in',
    location_verified BOOLEAN DEFAULT false,
    qr_verified BOOLEAN DEFAULT false,
    date DATE NOT NULL,
    duration_minutes INTEGER,
    notes TEXT,
    effort_level INTEGER,
    focus_area TEXT,
    gym_id UUID REFERENCES public.gyms(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist (in case table was created by older migration)
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'checked_in';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT false;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS qr_verified BOOLEAN DEFAULT false;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS effort_level INTEGER;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS focus_area TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id);

CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in_time ON public.attendance(check_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date DESC);

UPDATE public.attendance a SET gym_id = u.gym_id FROM public.users u WHERE a.user_id = u.id AND a.gym_id IS NULL;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Members can select and insert their own attendance
DROP POLICY IF EXISTS "members_attendance_select" ON public.attendance;
CREATE POLICY "members_attendance_select"
    ON public.attendance FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "members_attendance_insert" ON public.attendance;
CREATE POLICY "members_attendance_insert"
    ON public.attendance FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "members_attendance_update" ON public.attendance;
CREATE POLICY "members_attendance_update"
    ON public.attendance FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins can view their gym's attendance
DROP POLICY IF EXISTS "gym_admins_attendance_select" ON public.attendance;
CREATE POLICY "gym_admins_attendance_select"
    ON public.attendance FOR SELECT
    USING (public.is_gym_admin(gym_id));

COMMENT ON TABLE public.attendance IS 'Member gym check-ins (app uses check_in_time)';

NOTIFY pgrst, 'reload schema';
