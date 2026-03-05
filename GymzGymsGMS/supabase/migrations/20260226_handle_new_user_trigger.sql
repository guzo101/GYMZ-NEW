-- ============================================================================
-- GYMZ: handle_new_user TRIGGER — FOR SUPABASE FUNCTIONS EDITOR ONLY
-- Instructions:
--   1. Go to Supabase Dashboard → Database → Functions
--   2. Find "handle_new_user" and click Edit
--   3. Replace the entire function body with the content below
--   4. Save
-- ============================================================================
-- NOTE: Do NOT run this in SQL Editor. Use the Functions GUI editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gym_id UUID;
    v_name TEXT;
    v_role TEXT;
    v_member_id TEXT;
    v_year TEXT;
    v_prefix TEXT;
    v_random_part TEXT;
    v_final_id TEXT;
    v_exists BOOLEAN;
BEGIN
    -- ── Resolve gym_id ────────────────────────────────────────────────────────
    -- Priority 1: Passed explicitly at signup (deep-link or future feature)
    v_gym_id := (NEW.raw_user_meta_data->>'gym_id')::UUID;

    -- Priority 2: Owner invited via OAC (gym_contacts table)
    IF v_gym_id IS NULL THEN
        SELECT gc.gym_id INTO v_gym_id
        FROM public.gym_contacts gc
        WHERE gc.email = NEW.email
          AND gc.is_active = true
        LIMIT 1;
    END IF;

    -- Priority 3: Default to The Sweat Factory (canonical gym)
    v_gym_id := COALESCE(v_gym_id, '66874288-028a-495b-b98a-ceddf94876b6'::UUID);

    -- ── Resolve name and role ──────────────────────────────────────────────────
    v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'User');
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');

    -- ── Generate randomized Member ID: [PREFIX][YY][4digits][1letter] ─────────
    -- Example: SF264852A
    SELECT UPPER(SUBSTRING(name, 1, 2)) INTO v_prefix FROM public.gyms WHERE id = v_gym_id;
    v_prefix := COALESCE(v_prefix, 'GY');
    v_year := to_char(CURRENT_DATE, 'YY');

    v_exists := TRUE;
    WHILE v_exists LOOP
        v_random_part := LPAD(floor(random() * 10000)::text, 4, '0')
                         || chr(65 + floor(random() * 26)::int);
        v_final_id := v_prefix || v_year || v_random_part;
        SELECT EXISTS (SELECT 1 FROM public.users WHERE unique_id = v_final_id) INTO v_exists;
    END LOOP;

    -- ── Insert public user record ──────────────────────────────────────────────
    INSERT INTO public.users (
        id, email, name, role, gym_id, unique_id, created_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        v_name,
        v_role,
        v_gym_id,
        v_final_id,
        NEW.created_at
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        role = COALESCE(EXCLUDED.role, public.users.role),
        gym_id = COALESCE(EXCLUDED.gym_id, public.users.gym_id),
        updated_at = NOW();

    RETURN NEW;
END;
$$;
