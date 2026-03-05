-- Quick fix: Update notification triggers to set created_at explicitly
-- Run this in your Supabase SQL Editor to fix new notifications showing wrong timestamps

-- Update the payment INSERT trigger function
CREATE OR REPLACE FUNCTION notify_admin_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  currency_format TEXT;
BEGIN
  -- Fetch user name if user_id exists
  IF NEW.user_id IS NOT NULL THEN
    SELECT name INTO user_name
    FROM users
    WHERE id = NEW.user_id;
  END IF;
  
  -- Format currency (ZMW)
  currency_format := NEW.amount::TEXT || ' ZMW';
  
  -- Create notification for admin WITH created_at
  INSERT INTO notifications (
    message,
    user_id,
    type,
    payment_id,
    created_at
  ) VALUES (
    COALESCE(
      'Payment of ' || currency_format || ' from ' || COALESCE(user_name, 'Member') || 
      CASE 
        WHEN NEW.status = 'pending_approval' OR NEW.status = 'pending' THEN ' - Awaiting approval'
        WHEN NEW.status = 'completed' THEN ' - Completed'
        ELSE ''
      END,
      'New payment of ' || currency_format || ' received'
    ),
    NEW.user_id,
    'payment',
    NEW.id,
    NOW()  -- ← THIS IS THE FIX: Explicitly set current timestamp
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
