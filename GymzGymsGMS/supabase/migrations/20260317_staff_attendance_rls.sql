-- ============================================================================
-- FIX: Staff check-ins not appearing in attendance analytics
-- Date: 2026-03-17
--
-- Facts observed in codebase:
-- - Admin/staff dashboard reads from `attendance` and `attendance_logs`
-- - Admin check-in flow writes to `attendance_logs`
-- - Existing RLS policies on `attendance` / `attendance_logs` primarily use
--   `public.is_gym_admin(gym_id)` (role in admin/super_admin/owner), which
--   excludes `staff`. This can block:
--   - INSERT into `attendance_logs` when staff performs a check-in
--   - SELECT from `attendance` / `attendance_logs` for staff dashboard analytics
--
-- This migration adds explicit staff-scoped policies:
-- - Staff can SELECT gym attendance rows for their gym
-- - Staff can INSERT attendance_logs for their gym (to record check-ins)
--
-- Security: staff is still gym-scoped (must belong to gym_id), and members are
-- not granted broader access.
-- ============================================================================

BEGIN;

-- Helper predicate inline: "current user is staff"
-- (No function creation needed; keeps migration minimal.)

-- ────────────────────────────────────────────────────────────────────────────
-- attendance_logs: allow staff SELECT + INSERT for their gym
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gym staff view their gym attendance logs" ON public.attendance_logs;
CREATE POLICY "Gym staff view their gym attendance logs"
  ON public.attendance_logs
  FOR SELECT
  USING (
    public.user_belongs_to_gym(gym_id)
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'staff'
    )
  );

DROP POLICY IF EXISTS "Gym staff insert attendance logs" ON public.attendance_logs;
CREATE POLICY "Gym staff insert attendance logs"
  ON public.attendance_logs
  FOR INSERT
  WITH CHECK (
    public.user_belongs_to_gym(gym_id)
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'staff'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- attendance: allow staff SELECT for their gym (member app writes here)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gym staff view their gym attendance" ON public.attendance;
CREATE POLICY "Gym staff view their gym attendance"
  ON public.attendance
  FOR SELECT
  USING (
    public.user_belongs_to_gym(gym_id)
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'staff'
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';

