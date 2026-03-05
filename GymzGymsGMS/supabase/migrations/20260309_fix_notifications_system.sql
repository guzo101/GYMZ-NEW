-- ============================================================================
-- GYMZ: FIX NOTIFICATIONS SYSTEM (ADMIN + USER)
-- Date: 2026-03-09
-- Root causes identified:
--   1. handle_new_user no longer creates member_signup notifications (20260305 removed it)
--   2. No INSERT policy for gym admins on notifications (only SELECT/UPDATE)
--   3. Member notification RLS uses is_fully_onboarded() - blocks users who have
--      unique_id but haven't completed calibration (e.g. just approved)
-- ============================================================================

BEGIN;

-- ─── 1. RESTORE member_signup NOTIFICATION IN handle_new_user ─────────────────
-- 20260305_restore_ultimate_signup_failsafe overwrote handle_new_user and removed
-- the member_signup notification. Restore it so admins get notified on new signups.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
AS $body$
DECLARE
    v_gym_id UUID;
    v_name TEXT;
    v_role TEXT;
    v_final_id TEXT;
    v_gym_exists BOOLEAN;
BEGIN
    BEGIN
        -- A. SAFE GYM RESOLUTION
        BEGIN
            v_gym_id := (NEW.raw_user_meta_data->>'gym_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_gym_id := NULL;
        END;

        IF v_gym_id IS NULL THEN
            SELECT gc.gym_id INTO v_gym_id
            FROM public.gym_contacts gc
            WHERE gc.email = NEW.email
              AND gc.is_active = true
            LIMIT 1;
        END IF;

        IF v_gym_id IS NOT NULL THEN
            SELECT EXISTS (SELECT 1 FROM public.gyms WHERE id = v_gym_id) INTO v_gym_exists;
            IF NOT v_gym_exists THEN 
                v_gym_id := NULL; 
            END IF;
        END IF;

        -- B. METADATA RESOLUTION
        v_name := COALESCE(
            NEW.raw_user_meta_data->>'name', 
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1), 
            'User'
        );

        v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');

        -- C. PROFESSIONAL ID GENERATION
        IF v_gym_id IS NOT NULL THEN
            BEGIN
                v_final_id := public.generate_gym_member_id(v_gym_id);
            EXCEPTION WHEN OTHERS THEN
                v_final_id := NULL;
            END;
        ELSE
            v_final_id := NULL;
        END IF;

        -- D. ATOMIC UPSERT
        INSERT INTO public.users (
            id, email, name, first_name, last_name, role, gym_id, unique_id,
            status, membership_status, marketing_consent, marketing_consent_date, created_at
        )
        VALUES (
            NEW.id, NEW.email, v_name,
            NEW.raw_user_meta_data->>'first_name',
            NEW.raw_user_meta_data->>'last_name',
            v_role, v_gym_id, v_final_id,
            'active',
            CASE WHEN v_gym_id IS NULL THEN 'unassigned' ELSE 'New' END,
            COALESCE((NEW.raw_user_meta_data->>'marketing_consent')::BOOLEAN, false),
            (NEW.raw_user_meta_data->>'marketing_consent_date')::TIMESTAMPTZ,
            NEW.created_at
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = COALESCE(public.users.name, EXCLUDED.name),
            first_name = COALESCE(public.users.first_name, EXCLUDED.first_name),
            last_name = COALESCE(public.users.last_name, EXCLUDED.last_name),
            updated_at = NOW();

        -- E. [RESTORED] Admin notification for new member signups
        IF v_role = 'member' AND v_gym_id IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id, gym_id, type, message, priority, is_read, status, action_url, action_label
            ) VALUES (
                NULL,
                v_gym_id,
                'member_signup',
                'New member registered: ' || v_name,
                3,
                FALSE,
                'unread',
                '/members?search=' || NEW.id,
                'View Member'
            );
        END IF;

    EXCEPTION WHEN OTHERS THEN
        BEGIN
            INSERT INTO public.users (id, email, role, status, membership_status)
            VALUES (NEW.id, NEW.email, 'member', 'active', 'unassigned')
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END;

    RETURN NEW;
END;
$body$ LANGUAGE plpgsql;


-- ─── 2. ADD INSERT POLICY FOR GYM ADMINS ON NOTIFICATIONS ────────────────────
-- Gym admins need to INSERT notifications (e.g. approval/rejection from Finances.tsx).
-- Currently only SELECT and UPDATE exist; inserts fail with RLS.
DROP POLICY IF EXISTS "Gym admins insert their gym notifications" ON public.notifications;
CREATE POLICY "Gym admins insert their gym notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR (auth.uid() = user_id AND public.has_valid_member_id())  -- Members can notify themselves
    OR (public.is_gym_admin(gym_id) AND gym_id IS NOT NULL)    -- Admin notifications
    OR (user_id IS NOT NULL AND public.is_gym_admin(
        (SELECT gym_id FROM public.users WHERE id = user_id)
    ))  -- Admin inserting for member in their gym
);


-- ─── 3. FIX MEMBER NOTIFICATION RLS: use has_valid_member_id() not is_fully_onboarded() ─
-- Users who are approved (have unique_id) but haven't completed calibration yet
-- must be able to read their "payment approved" notification.
-- is_fully_onboarded() blocks them; has_valid_member_id() allows them.
DROP POLICY IF EXISTS "onboarded_notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "onboarded_notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "member_notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "member_notifications_update" ON public.notifications;

CREATE POLICY "member_notifications_select"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id AND public.has_valid_member_id());

CREATE POLICY "member_notifications_update"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id AND public.has_valid_member_id())
WITH CHECK (auth.uid() = user_id AND public.has_valid_member_id());


COMMIT;

NOTIFY pgrst, 'reload schema';
