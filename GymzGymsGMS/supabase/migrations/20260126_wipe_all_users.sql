-- ==========================================
-- WIPE ALL USERS (NUCLEAR OPTION)
-- ==========================================

-- 1. DELETE ALL USERS
-- This removes every single record from the public.users table.
-- Due to Foreign Key constraints (ON DELETE CASCADE), this should also wipe:
-- - room_members
-- - room_posts
-- - workout_sessions
-- - etc.
DELETE FROM public.users;

-- 2. (Optional) CLEAN UP ORPHANED ROOMS
-- If rooms are not set to cascade delete when admin_id is removed (or if admin_id is nullable),
-- you might want to clear them too to start truly fresh.
DELETE FROM public.rooms;

-- 3. NOTIFY
NOTIFY pgrst, 'reload schema';
