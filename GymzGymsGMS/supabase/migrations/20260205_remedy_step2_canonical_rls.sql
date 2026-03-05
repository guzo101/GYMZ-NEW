-- ================================================================================
-- REMEDY STEP 2: The Great Policy Clear-out & Canonical Application
-- ================================================================================

BEGIN;

-- 1. NUCLEAR CLEAR-OUT: Drop all existing policies in public schema
-- This ensures no "zombie" or overlapping policies remain.
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. ENABLE RLS ON ALL TABLES
-- Safety net to ensure every table is protected by default.
DO $$ 
DECLARE 
    tab record;
BEGIN
    FOR tab IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tab.tablename);
    END LOOP;
END $$;

-- 3. APPLY CANONICAL POLICIES (DEFENSIVE)

-- [public.users]
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users') THEN
        CREATE POLICY "table_users_select_owner" ON public.users FOR SELECT USING (auth.uid() = id);
        CREATE POLICY "table_users_manage_admin" ON public.users FOR ALL USING (public.is_admin());
    END IF;
END $$;

-- [public.payments]
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payments') THEN
        CREATE POLICY "table_payments_insert_member" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = member_id);
        CREATE POLICY "table_payments_select_owner" ON public.payments FOR SELECT USING (auth.uid() = user_id OR auth.uid() = member_id);
        CREATE POLICY "table_payments_manage_admin" ON public.payments FOR ALL USING (public.is_admin());
    END IF;
END $$;

-- [public.subscriptions]
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscriptions') THEN
        CREATE POLICY "table_subscriptions_select_owner" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "table_subscriptions_manage_admin" ON public.subscriptions FOR ALL USING (public.is_admin());
    END IF;
END $$;

-- [public.membership_tiers]
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'membership_tiers') THEN
        CREATE POLICY "table_membership_tiers_select_everyone" ON public.membership_tiers FOR SELECT TO authenticated, anon USING (true);
        CREATE POLICY "table_membership_tiers_manage_admin" ON public.membership_tiers FOR ALL USING (public.is_admin());
    END IF;
END $$;

-- [public.user_level_system]
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_level_system') THEN
        CREATE POLICY "table_levels_select_owner" ON public.user_level_system FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "table_levels_manage_admin" ON public.user_level_system FOR ALL USING (public.is_admin());
    END IF;
END $$;

-- [public.rooms / tribes]
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'rooms') THEN
        CREATE POLICY "table_rooms_select_everyone" ON public.rooms FOR SELECT USING (true);
        CREATE POLICY "table_rooms_manage_admin" ON public.rooms FOR ALL USING (public.is_admin());
    END IF;
END $$;

-- [public.daily_nutrition_logs]
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'daily_nutrition_logs') THEN
        CREATE POLICY "table_nutrition_select_owner" ON public.daily_nutrition_logs FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "table_nutrition_insert_owner" ON public.daily_nutrition_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "table_nutrition_update_owner" ON public.daily_nutrition_logs FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "table_nutrition_manage_admin" ON public.daily_nutrition_logs FOR ALL USING (public.is_admin());
    END IF;
END $$;

-- [public.app_settings / settings]
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'app_settings') THEN
        CREATE POLICY "table_settings_select_public" ON public.app_settings FOR SELECT USING (true);
        CREATE POLICY "table_settings_manage_admin" ON public.app_settings FOR ALL USING (public.is_admin());
    ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'settings') THEN
        CREATE POLICY "table_settings_select_public" ON public.settings FOR SELECT USING (true);
        CREATE POLICY "table_settings_manage_admin" ON public.settings FOR ALL USING (public.is_admin());
    END IF;
END $$;

-- [public.admin_audit_logs]
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_audit_logs') THEN
        CREATE POLICY "table_audit_select_admin" ON public.admin_audit_logs FOR SELECT USING (public.is_admin());
        CREATE POLICY "table_audit_insert_admin" ON public.admin_audit_logs FOR INSERT WITH CHECK (public.is_admin());
    ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'audit_logs') THEN
        CREATE POLICY "table_audit_select_admin" ON public.audit_logs FOR SELECT USING (public.is_admin());
        CREATE POLICY "table_audit_insert_admin" ON public.audit_logs FOR INSERT WITH CHECK (public.is_admin());
    END IF;
END $$;

-- 4. FINAL PERMISSIONS
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

COMMIT;
