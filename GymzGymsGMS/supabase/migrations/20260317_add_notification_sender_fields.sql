-- Migration: Add sender fields to notifications (admin attribution)
-- Purpose: Allow notifications to be explicitly "from" an admin/staff/AI/system.

DO $$
BEGIN
  -- Columns
  ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

  ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS sender_type TEXT;

  ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS sender_name TEXT;

  -- Constraint (allow NULL for backwards compatibility)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_sender_type_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_sender_type_check
      CHECK (
        sender_type IS NULL OR sender_type IN ('admin', 'staff', 'system', 'ai', 'member')
      );
  END IF;

  -- Helpful index for analytics / filtering
  CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON public.notifications(sender_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_sender_type ON public.notifications(sender_type);
END $$;

NOTIFY pgrst, 'reload schema';

