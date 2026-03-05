-- ============================================================================
-- GYMZ SECURITY HARDENING: UNIVERSAL UNIQUE ID ENFORCEMENT
-- Date: 2026-02-25
-- ============================================================================

BEGIN;

-- ─── 1. ENSURE UNIQUE_ID ON EVERY INSERT (PUBLIC.USERS) ──────────────────────
-- This ensures that even manual inserts (from GOS or scripts) get a professional ID
-- without needing to explicitly call the generator.

CREATE OR REPLACE FUNCTION public.ensure_user_unique_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.unique_id IS NULL OR NEW.unique_id = '' THEN
        NEW.unique_id := public.generate_gym_member_id(NEW.gym_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_user_unique_id ON public.users;
CREATE TRIGGER trg_ensure_user_unique_id
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_user_unique_id();

COMMIT;

NOTIFY pgrst, 'reload schema';
