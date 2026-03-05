-- ============================================================================
-- Community Chat: Photos & Reactions (WhatsApp-like)
-- Date: 2026-04-06
-- ============================================================================

BEGIN;

-- ─── 1. Add image_url to notice_board ──────────────────────────────────────
ALTER TABLE public.notice_board ADD COLUMN IF NOT EXISTS image_url TEXT;
COMMENT ON COLUMN public.notice_board.image_url IS 'Optional image attachment URL (Supabase Storage)';

-- Allow content to be empty for image-only messages
ALTER TABLE public.notice_board ALTER COLUMN content DROP NOT NULL;
-- Backfill empty content for any future image-only rows
UPDATE public.notice_board SET content = '' WHERE content IS NULL;
ALTER TABLE public.notice_board ALTER COLUMN content SET DEFAULT '';

-- ─── 2. Create notice_board_reactions table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notice_board_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.notice_board(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_notice_board_reactions_message ON public.notice_board_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_notice_board_reactions_user ON public.notice_board_reactions(user_id);

ALTER TABLE public.notice_board_reactions ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see reactions on messages they can see; can add/update/remove own
CREATE POLICY "notice_board_reactions_select"
ON public.notice_board_reactions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "notice_board_reactions_insert"
ON public.notice_board_reactions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notice_board_reactions_update"
ON public.notice_board_reactions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notice_board_reactions_delete"
ON public.notice_board_reactions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ─── 3. Storage bucket for community chat images ───────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-chat',
  'community-chat',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policies for community-chat bucket
DROP POLICY IF EXISTS "Authenticated upload community chat" ON storage.objects;
CREATE POLICY "Authenticated upload community chat"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'community-chat');

DROP POLICY IF EXISTS "Public read community chat" ON storage.objects;
CREATE POLICY "Public read community chat"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'community-chat');

DROP POLICY IF EXISTS "Authenticated delete own community chat" ON storage.objects;
CREATE POLICY "Authenticated delete own community chat"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'community-chat');

COMMIT;

NOTIFY pgrst, 'reload schema';
