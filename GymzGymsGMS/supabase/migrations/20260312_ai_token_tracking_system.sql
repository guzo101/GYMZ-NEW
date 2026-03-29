-- ============================================================================
-- AI TOKEN USAGE TRACKING SYSTEM
-- Central tables for platform-wide AI token monitoring and control (OAC).
-- Date: 2026-03-12
-- ============================================================================

-- ─── 1. ai_token_usage (one record per AI request) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_token_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    feature_type TEXT NOT NULL CHECK (feature_type IN (
        'AI_CHAT', 'COMMUNITY_CHAT', 'FOOD_SCAN', 'AI_COACH', 'NUTRITION_AI', 'OTHER'
    )),
    tokens_input INTEGER NOT NULL DEFAULT 0,
    tokens_output INTEGER NOT NULL DEFAULT 0,
    tokens_total INTEGER NOT NULL DEFAULT 0,
    model_used TEXT,
    request_cost_usd NUMERIC(12, 6) DEFAULT 0,
    user_gender TEXT,
    user_age_group TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created_at ON public.ai_token_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_gym_id ON public.ai_token_usage(gym_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_id ON public.ai_token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_feature_type ON public.ai_token_usage(feature_type);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_gym_created ON public.ai_token_usage(gym_id, created_at DESC);

COMMENT ON TABLE public.ai_token_usage IS 'One record per AI request; used for OAC token analytics and cost tracking.';

-- ─── 2. ai_token_usage_summary (monthly aggregation per gym) ──────────────────
CREATE TABLE IF NOT EXISTS public.ai_token_usage_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    total_tokens_used BIGINT NOT NULL DEFAULT 0,
    total_cost_usd NUMERIC(14, 4) NOT NULL DEFAULT 0,
    total_requests INTEGER NOT NULL DEFAULT 0,
    tokens_by_feature JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(gym_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_ai_token_summary_gym_year_month ON public.ai_token_usage_summary(gym_id, year, month);
CREATE INDEX IF NOT EXISTS idx_ai_token_summary_year_month ON public.ai_token_usage_summary(year, month);

COMMENT ON TABLE public.ai_token_usage_summary IS 'Monthly per-gym token aggregates for fast OAC dashboard queries.';

-- ─── 3. ai_token_limits (per-gym / per-feature controls) ───────────────────
CREATE TABLE IF NOT EXISTS public.ai_token_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE,
    feature_type TEXT CHECK (feature_type IN (
        'AI_CHAT', 'COMMUNITY_CHAT', 'FOOD_SCAN', 'AI_COACH', 'NUTRITION_AI', 'OTHER', 'ALL'
    )),
    daily_token_limit BIGINT,
    user_daily_limit BIGINT,
    cooldown_seconds INTEGER DEFAULT 0,
    is_feature_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(gym_id, feature_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_token_limits_gym ON public.ai_token_limits(gym_id);

COMMENT ON TABLE public.ai_token_limits IS 'Platform admin token caps and cooldowns per gym/feature (OAC).';

-- ─── 4. ai_token_balance (platform token accounting) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_token_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tokens_purchased BIGINT NOT NULL DEFAULT 0,
    purchase_cost_usd NUMERIC(14, 4) DEFAULT 0,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    tokens_used_total BIGINT NOT NULL DEFAULT 0,
    tokens_remaining BIGINT GENERATED ALWAYS AS (GREATEST(0, tokens_purchased - tokens_used_total)) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_token_balance_purchased_at ON public.ai_token_balance(purchased_at DESC);

COMMENT ON TABLE public.ai_token_balance IS 'Platform-level token purchases and consumed total; one row per purchase or running balance.';

-- Optional: single running balance row (update in app or trigger). We use multiple rows for audit; dashboard can sum.
-- For "current balance" we will use: (SELECT SUM(tokens_purchased) - (SELECT COALESCE(SUM(tokens_total),0) FROM ai_token_usage)) in dashboard.

-- ─── 5. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_token_usage_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_token_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_token_balance ENABLE ROW LEVEL SECURITY;

-- ai_token_usage: service_role and backend insert; platform_admin read all
DROP POLICY IF EXISTS "platform_admin_ai_token_usage_all" ON public.ai_token_usage;
CREATE POLICY "platform_admin_ai_token_usage_all"
ON public.ai_token_usage FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- Allow inserts from authenticated (gym app / edge functions) for their own gym context; platform_admin can do anything
DROP POLICY IF EXISTS "service_insert_ai_token_usage" ON public.ai_token_usage;
CREATE POLICY "service_insert_ai_token_usage"
ON public.ai_token_usage FOR INSERT
WITH CHECK (true);

-- ai_token_usage_summary: platform admin only (read/update for refresh)
DROP POLICY IF EXISTS "platform_admin_ai_token_summary_all" ON public.ai_token_usage_summary;
CREATE POLICY "platform_admin_ai_token_summary_all"
ON public.ai_token_usage_summary FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- Summary is written by refresh_ai_token_usage_summary (SECURITY DEFINER). No open policy.

-- ai_token_limits: platform admin manage; gym admins read their gym only
DROP POLICY IF EXISTS "platform_admin_ai_token_limits_all" ON public.ai_token_limits;
CREATE POLICY "platform_admin_ai_token_limits_all"
ON public.ai_token_limits FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "gym_admin_ai_token_limits_select" ON public.ai_token_limits;
CREATE POLICY "gym_admin_ai_token_limits_select"
ON public.ai_token_limits FOR SELECT
USING (public.is_gym_admin(gym_id));

-- ai_token_balance: platform admin only
DROP POLICY IF EXISTS "platform_admin_ai_token_balance_all" ON public.ai_token_balance;
CREATE POLICY "platform_admin_ai_token_balance_all"
ON public.ai_token_balance FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- ─── 6. Function: derive age_group from users.age ───────────────────────────
CREATE OR REPLACE FUNCTION public.user_age_group_from_age(p_age INTEGER)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN p_age IS NULL THEN NULL
        WHEN p_age < 18 THEN 'under_18'
        WHEN p_age BETWEEN 18 AND 24 THEN '18_24'
        WHEN p_age BETWEEN 25 AND 34 THEN '25_34'
        WHEN p_age BETWEEN 35 AND 44 THEN '35_44'
        WHEN p_age BETWEEN 45 AND 54 THEN '45_54'
        WHEN p_age >= 55 THEN '55_plus'
        ELSE 'unknown'
    END;
$$;

-- ─── 7. Function: refresh monthly summary for a gym/month ─────────────────────
CREATE OR REPLACE FUNCTION public.refresh_ai_token_usage_summary(
    p_gym_id UUID,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tokens BIGINT;
    v_cost NUMERIC;
    v_requests INTEGER;
    v_by_feature JSONB;
BEGIN
    SELECT COALESCE(SUM(tokens_total), 0), COALESCE(SUM(request_cost_usd), 0), COUNT(*)
    INTO v_tokens, v_cost, v_requests
    FROM public.ai_token_usage
    WHERE gym_id = p_gym_id
      AND EXTRACT(YEAR FROM created_at) = p_year
      AND EXTRACT(MONTH FROM created_at) = p_month;

    SELECT COALESCE(jsonb_object_agg(feature_type, data), '{}'::jsonb) INTO v_by_feature
    FROM (
        SELECT feature_type,
               jsonb_build_object('tokens', SUM(tokens_total), 'requests', COUNT(*), 'cost_usd', COALESCE(SUM(request_cost_usd), 0)) AS data
        FROM public.ai_token_usage
        WHERE gym_id = p_gym_id
          AND EXTRACT(YEAR FROM created_at) = p_year
          AND EXTRACT(MONTH FROM created_at) = p_month
        GROUP BY feature_type
    ) s;

    INSERT INTO public.ai_token_usage_summary (gym_id, month, year, total_tokens_used, total_cost_usd, total_requests, tokens_by_feature, updated_at)
    VALUES (p_gym_id, p_month, p_year, v_tokens, v_cost, v_requests, COALESCE(v_by_feature, '{}'), NOW())
    ON CONFLICT (gym_id, year, month) DO UPDATE SET
        total_tokens_used = EXCLUDED.total_tokens_used,
        total_cost_usd = EXCLUDED.total_cost_usd,
        total_requests = EXCLUDED.total_requests,
        tokens_by_feature = EXCLUDED.tokens_by_feature,
        updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_ai_token_usage_summary(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_ai_token_usage_summary(UUID, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.refresh_ai_token_usage_summary IS 'Aggregates ai_token_usage for a gym/month into ai_token_usage_summary.';

-- ─── 8. RPC: platform all-time token total (for OAC balance card) ─────────────
CREATE OR REPLACE FUNCTION public.get_ai_token_usage_totals()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
    v_total BIGINT;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RETURN jsonb_build_object('total_tokens_used', 0);
    END IF;
    SELECT COALESCE(SUM(tokens_total), 0) INTO v_total FROM public.ai_token_usage;
    RETURN jsonb_build_object('total_tokens_used', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_token_usage_totals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_token_usage_totals() TO service_role;
