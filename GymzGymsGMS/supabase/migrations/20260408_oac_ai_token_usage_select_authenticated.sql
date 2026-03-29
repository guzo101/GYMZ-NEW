-- ============================================================================
-- OAC: Ensure Token Analytics can read ai_token_usage
-- Token usage from AI coach (member AI chat) is written to ai_token_usage;
-- OAC only shows it when RLS allows SELECT. If the OAC app sends requests
-- as anon (e.g. session not attached to Supabase client), is_platform_admin()
-- is false and no rows are returned. This policy lets the anon role read
-- ai_token_usage so the Token Analytics page can show data. Restrict or
-- remove if you need to lock down token data to authenticated platform admins only.
-- Date: 2026-04-08
-- ============================================================================

DROP POLICY IF EXISTS "oac_anon_select_ai_token_usage" ON public.ai_token_usage;
CREATE POLICY "oac_anon_select_ai_token_usage"
ON public.ai_token_usage
FOR SELECT
TO anon
USING (true);
