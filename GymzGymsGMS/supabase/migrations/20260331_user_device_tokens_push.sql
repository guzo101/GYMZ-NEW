-- ============================================================================
-- GYMZ: User device tokens for push notifications
-- Date: 2026-03-31
-- Purpose: Store Expo push tokens so GMS can send push notifications to members.
-- ============================================================================

-- Table: user_device_tokens
CREATE TABLE IF NOT EXISTS public.user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_device_tokens_user_token_unique UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id ON public.user_device_tokens(user_id);

-- RLS
ALTER TABLE public.user_device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens (insert/update/delete)
DROP POLICY IF EXISTS "Users manage own device tokens" ON public.user_device_tokens;
CREATE POLICY "Users manage own device tokens"
  ON public.user_device_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Gym admins can SELECT tokens for their gym members (for sending push)
DROP POLICY IF EXISTS "Gym admins view member device tokens" ON public.user_device_tokens;
CREATE POLICY "Gym admins view member device tokens"
  ON public.user_device_tokens
  FOR SELECT
  USING (
    public.is_gym_admin((SELECT gym_id FROM public.users WHERE id = user_id))
  );

-- Service role can do everything (for edge functions)
-- (service_role bypasses RLS by default)
