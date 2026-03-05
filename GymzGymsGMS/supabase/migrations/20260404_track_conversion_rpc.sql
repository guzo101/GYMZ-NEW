-- ============================================================================
-- track_conversion RPC (stub) — prevents app crash when ProfileScreen calls it
-- The app calls supabase.rpc('track_conversion', {...}) but this RPC did not exist.
-- Creating a no-op stub so the call succeeds. Can be extended later for analytics.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_conversion(
    p_user_id UUID DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- No-op stub: accept params, return success. Prevents app crash.
    -- Future: insert into conversion_events or analytics table.
    RETURN jsonb_build_object('ok', true);
END;
$$;
