# Database Fields Required for Check-In System

This document lists the database fields that are referenced in the Check-In System. Some of these fields may need to be added to your `users` table if they don't already exist.

## Required Fields

### User Identification

- `id` (string) - User's unique identifier
- `name` (string) - User's full name
- `email` (string) - User's email address
- `role` (string) - User role (should be "member" for members)

### QR Code

- `qr_code_string` (string, nullable) - QR code string associated with the user

### Photo

- `face_photo_url` (string, nullable) - URL to user's face photo
- `avatar_url` (string, nullable) - Fallback avatar URL

### Membership Information

- `membership_type` (string, nullable) - Type of membership plan
- `membership_plan` (string, nullable) - Alternative field for membership plan name
- `membership_status` (string, nullable) - Status: "active", "expired", "frozen", etc.
- `renewal_due_date` (date, nullable) - Primary expiry date
- `membership_expiry` (date, nullable) - Legacy expiry date (synced for backward compatibility)

### Payment Information

- `payment_status` (string, nullable) - Status: "completed", "pending", "failed", "rejected"
- `payment_overdue_days` (number, nullable) - Number of days payment is overdue

### Account Status

- `account_suspended` (boolean, nullable) - Whether account is suspended
- `account_banned` (boolean, nullable) - Whether account is banned
- `plan_frozen` (boolean, nullable) - Whether membership plan is frozen

### Trial Information

- `trial_status` (string, nullable) - Status: "active", "ended", "expired"

### Plan Start Date

- `plan_start_date` (date, nullable) - Date when plan becomes active

### Class Booking Requirements

- `required_class_booking` (boolean, nullable) - Whether user must book classes to access

## Recommended Database Migration

If these fields don't exist, you can add them with the following SQL (adjust based on your existing schema):

```sql
-- Add QR code field
ALTER TABLE users ADD COLUMN IF NOT EXISTS qr_code_string TEXT;

-- Add face photo field
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_photo_url TEXT;

-- Add membership fields (if not exist)
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_plan TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_expiry DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_frozen BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_start_date DATE;

-- Add payment status fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_overdue_days INTEGER DEFAULT 0;

-- Add account status fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_banned BOOLEAN DEFAULT FALSE;

-- Add trial status
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_status TEXT;

-- Add class booking requirement
ALTER TABLE users ADD COLUMN IF NOT EXISTS required_class_booking BOOLEAN DEFAULT FALSE;

-- Generate QR codes for existing users (optional)
-- UPDATE users SET qr_code_string = gen_random_uuid()::text WHERE qr_code_string IS NULL AND role = 'member';
```

## Notes

- The system will gracefully handle missing fields by using fallbacks or default values
- Fields like `membership_status` and `membership_type` are commonly used across the codebase
- The `qr_code_string` can be generated when users are created or updated
- Some fields like `payment_overdue_days` might be calculated fields rather than stored values
