-- Migration: Upgrade Notifications System
-- Goal: Zero ambiguity, real-time sync, and ranking logic

-- 1. Ensure columns exist and have correct types
DO $$ 
BEGIN
    -- Add priority column (1=Critical, 2=Urgent, 3=Standard, 4=Info)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'priority') THEN
        ALTER TABLE notifications ADD COLUMN priority INTEGER DEFAULT 3;
    END IF;

    -- Add status column (unread, read, acknowledged)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'status') THEN
        ALTER TABLE notifications ADD COLUMN status TEXT DEFAULT 'unread';
    END IF;

    -- Add platform_origin column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'platform_origin') THEN
        ALTER TABLE notifications ADD COLUMN platform_origin TEXT;
    END IF;

    -- Add acknowledged_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'acknowledged_at') THEN
        ALTER TABLE notifications ADD COLUMN acknowledged_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Standardize created_at if it's not TIMESTAMP WITH TIME ZONE
    -- (Assuming it might be TIMESTAMP or TEXT in some versions)
    -- ALTER TABLE notifications ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at::TIMESTAMP WITH TIME ZONE;
END $$;

-- 2. Update existing data to match new status if needed
UPDATE notifications SET status = 'read' WHERE is_read = true AND status = 'unread';
UPDATE notifications SET status = 'unread' WHERE (is_read = false OR is_read IS NULL) AND status = 'unread';

-- 3. Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id OR (user_id IS NULL AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'));

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" 
ON notifications FOR UPDATE 
USING (auth.uid() = user_id OR (user_id IS NULL AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'));

-- 5. Helper Function for Priority Ranking
CREATE OR REPLACE FUNCTION get_notification_priority(p_type TEXT) 
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE 
        WHEN p_type LIKE '%fail%' OR p_type LIKE '%alert%' OR p_type LIKE '%critical%' THEN 1
        WHEN p_type LIKE '%pending%' OR p_type LIKE '%rejection%' THEN 2
        WHEN p_type LIKE '%approved%' OR p_type LIKE '%completed%' THEN 3
        ELSE 4
    END;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to automatically set priority if not provided
CREATE OR REPLACE FUNCTION set_notification_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.priority IS NULL THEN
        NEW.priority := get_notification_priority(NEW.type);
    END IF;
    
    IF NEW.created_at IS NULL THEN
        NEW.created_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_notification_defaults ON notifications;
CREATE TRIGGER tr_set_notification_defaults
BEFORE INSERT ON notifications
FOR EACH ROW
EXECUTE FUNCTION set_notification_defaults();
