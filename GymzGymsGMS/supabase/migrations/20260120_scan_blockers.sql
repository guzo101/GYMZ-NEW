-- COMPREHENSIVE SCAN FOR SIGNUP BLOCKERS
-- Run this in Supabase SQL Editor to find the "hidden" cause.

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SCANNING FOR ALL TRIGGERS ON auth.users';
    RAISE NOTICE '========================================';
END $$;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_schema = 'auth' 
  AND event_object_table = 'users';

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SCANNING FOR ALL COLUMNS IN public.users';
    RAISE NOTICE '========================================';
END $$;

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users';

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SCANNING FOR ALL CONSTRAINTS ON public.users';
    RAISE NOTICE '========================================';
END $$;

SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
  AND conrelid = 'public.users'::regclass;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SCANNING FOR ALL TRIGGERS ON public.users';
    RAISE NOTICE '========================================';
END $$;

SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_schema = 'public' 
  AND event_object_table = 'users';
