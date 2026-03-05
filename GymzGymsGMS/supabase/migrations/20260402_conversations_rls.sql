-- RLS for conversations table (AI Chat)
-- Enables: members to read/write own; admins to read/write all (for AI Chat tests and admin chat)

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Members: view and insert their own messages
DROP POLICY IF EXISTS "Members view own conversations" ON public.conversations;
CREATE POLICY "Members view own conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members insert own messages" ON public.conversations;
CREATE POLICY "Members insert own messages"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins: full access (view all, insert for any member - needed for AI Chat tests and admin chat)
DROP POLICY IF EXISTS "Admins manage all conversations" ON public.conversations;
CREATE POLICY "Admins manage all conversations"
ON public.conversations FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
