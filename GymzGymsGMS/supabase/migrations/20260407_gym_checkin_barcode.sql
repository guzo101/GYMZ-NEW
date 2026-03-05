-- Migration: Gym Check-in Barcode for Self-Service Member Verification
-- Members scan the admin barcode at gym entrance to self-check-in
-- Date: 2026-04-07
-- Note: Uses only built-in PostgreSQL functions (no pgcrypto) for Supabase compatibility

-- ─── 1. gym_checkin_barcodes table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_checkin_barcodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(gym_id)
);

CREATE INDEX IF NOT EXISTS idx_gym_checkin_barcodes_gym ON public.gym_checkin_barcodes(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_checkin_barcodes_code ON public.gym_checkin_barcodes(code);
CREATE INDEX IF NOT EXISTS idx_gym_checkin_barcodes_expires ON public.gym_checkin_barcodes(expires_at);

ALTER TABLE public.gym_checkin_barcodes ENABLE ROW LEVEL SECURITY;

-- Admins manage their gym's barcode
DROP POLICY IF EXISTS "gym_admins_manage_checkin_barcodes" ON public.gym_checkin_barcodes;
CREATE POLICY "gym_admins_manage_checkin_barcodes"
    ON public.gym_checkin_barcodes FOR ALL
    USING (public.is_gym_admin(gym_id))
    WITH CHECK (public.is_gym_admin(gym_id));

-- Members need to verify (read) barcodes via RPC only; no direct SELECT policy for members

COMMENT ON TABLE public.gym_checkin_barcodes IS 'Codes displayed at gym entrance for member self-check-in. Format: gymz_gym_checkin:{gym_id}:{code}';

-- ─── 2. RPC: Generate or refresh gym check-in barcode ─────────────────────
CREATE OR REPLACE FUNCTION public.generate_gym_checkin_barcode(p_gym_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code TEXT;
    v_expires_at TIMESTAMPTZ;
    v_qr_string TEXT;
BEGIN
    IF NOT public.is_gym_admin(p_gym_id) THEN
        RAISE EXCEPTION 'Not authorized to generate barcode for this gym';
    END IF;

    -- Code valid for 24 hours (rotate daily)
    -- Use built-in md5+random (no pgcrypto) for Supabase compatibility
    v_expires_at := date_trunc('day', NOW() + INTERVAL '1 day');
    v_code := md5(random()::text || clock_timestamp()::text);

    INSERT INTO public.gym_checkin_barcodes (gym_id, code, expires_at)
    VALUES (p_gym_id, v_code, v_expires_at)
    ON CONFLICT (gym_id) DO UPDATE
    SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at;

    v_qr_string := 'gymz_gym_checkin:' || p_gym_id::TEXT || ':' || v_code;

    RETURN jsonb_build_object(
        'code', v_code,
        'qr_string', v_qr_string,
        'expires_at', v_expires_at
    );
END;
$$;

-- ─── 3. RPC: Verify gym check-in barcode (called by member app) ───────────
CREATE OR REPLACE FUNCTION public.verify_gym_checkin_barcode(p_scanned_string TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_parts TEXT[];
    v_gym_id UUID;
    v_code TEXT;
    v_row RECORD;
BEGIN
    IF p_scanned_string IS NULL OR trim(p_scanned_string) = '' THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Empty scan');
    END IF;

    IF p_scanned_string NOT LIKE 'gymz_gym_checkin:%' THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Invalid barcode format');
    END IF;

    v_parts := string_to_array(p_scanned_string, ':');
    IF array_length(v_parts, 1) < 3 THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Invalid barcode format');
    END IF;

    BEGIN
        v_gym_id := (v_parts[2])::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Invalid gym ID in barcode');
    END;

    v_code := v_parts[3];

    SELECT * INTO v_row
    FROM public.gym_checkin_barcodes
    WHERE gym_id = v_gym_id AND code = v_code AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Invalid or expired barcode');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'gym_id', v_gym_id,
        'reason', 'Valid gym check-in barcode'
    );
END;
$$;
