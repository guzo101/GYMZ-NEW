-- ============================================================================
-- OAC Token Analytics: allow platform_admin to read users (name, email)
-- So the Token Analytics page can show who used tokens when embedding
-- ai_token_usage with users(name, email). Without this, RLS on users blocks
-- the embed and coach/member chat usage rows may not show user names.
-- Date: 2026-04-07
-- ============================================================================

-- Platform admins need SELECT on public.users to display user names in
-- Token Analytics (ai_token_usage join to users). Existing policies only
-- allow auth.uid() = id or is_gym_admin(gym_id), so platform_admin could
-- not read member rows.
CREATE POLICY "platform_admin_users_select"
ON public.users FOR SELECT
USING (public.is_platform_admin());
