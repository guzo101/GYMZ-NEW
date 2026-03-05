-- ============================================================================
-- LOCK DOWN: Set YOUR email as the only one who can invite gym admins
-- ============================================================================
-- Replace 'your@email.com' with your actual platform admin email, then run this.
-- After this, ONLY you can invite gym admins. Nobody else—not even other
-- platform_admins—can do it.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_config_platform_admin_only" ON public.platform_config;
CREATE POLICY "platform_config_platform_admin_only" ON public.platform_config
    FOR ALL USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

INSERT INTO public.platform_config (key, value, updated_at)
VALUES ('oac_invite_master_email', 'your@email.com', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
