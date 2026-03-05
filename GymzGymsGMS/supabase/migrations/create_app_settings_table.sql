-- Create app_settings table for admin configuration
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  -- General
  app_name TEXT,
  app_description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  website TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT 'ZMW',
  timezone TEXT DEFAULT 'Africa/Lusaka',
  
  -- Membership & Pricing
  default_membership_duration INTEGER DEFAULT 1,
  membership_renewal_reminder_days INTEGER DEFAULT 7,
  allow_tips BOOLEAN DEFAULT true,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  late_fee_percentage DECIMAL(5,2) DEFAULT 5,
  
  -- Class & Booking
  max_class_capacity INTEGER DEFAULT 30,
  booking_advance_days INTEGER DEFAULT 30,
  cancellation_hours INTEGER DEFAULT 24,
  waitlist_enabled BOOLEAN DEFAULT true,
  auto_waitlist_booking BOOLEAN DEFAULT false,
  allow_walk_ins BOOLEAN DEFAULT true,
  
  -- Operating Hours
  monday_open TEXT DEFAULT '06:00',
  monday_close TEXT DEFAULT '22:00',
  tuesday_open TEXT DEFAULT '06:00',
  tuesday_close TEXT DEFAULT '22:00',
  wednesday_open TEXT DEFAULT '06:00',
  wednesday_close TEXT DEFAULT '22:00',
  thursday_open TEXT DEFAULT '06:00',
  thursday_close TEXT DEFAULT '22:00',
  friday_open TEXT DEFAULT '06:00',
  friday_close TEXT DEFAULT '22:00',
  saturday_open TEXT DEFAULT '08:00',
  saturday_close TEXT DEFAULT '20:00',
  sunday_open TEXT DEFAULT '09:00',
  sunday_close TEXT DEFAULT '18:00',
  
  -- Payment Methods
  accept_cash BOOLEAN DEFAULT true,
  accept_mobile_money BOOLEAN DEFAULT true,
  accept_bank_transfer BOOLEAN DEFAULT true,
  accept_card BOOLEAN DEFAULT false,
  
  -- Notifications
  email_notifications_enabled BOOLEAN DEFAULT true,
  sms_notifications_enabled BOOLEAN DEFAULT false,
  notify_class_reminders BOOLEAN DEFAULT true,
  notify_payment_reminders BOOLEAN DEFAULT true,
  notify_class_cancellations BOOLEAN DEFAULT true,
  notify_new_classes BOOLEAN DEFAULT true,
  
  -- System
  maintenance_mode BOOLEAN DEFAULT false,
  allow_registrations BOOLEAN DEFAULT true,
  require_email_verification BOOLEAN DEFAULT false,
  session_timeout_minutes INTEGER DEFAULT 60,
  
  -- Security
  password_min_length INTEGER DEFAULT 8,
  require_strong_password BOOLEAN DEFAULT false,
  two_factor_enabled BOOLEAN DEFAULT false,
  login_attempt_limit INTEGER DEFAULT 5,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to ensure only one settings row
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_single_row ON app_settings((1));

-- Add RLS policies (admin only access)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view app_settings"
  ON app_settings FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can update app_settings"
  ON app_settings FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can insert app_settings"
  ON app_settings FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');





