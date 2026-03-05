# Payment Approval Flow & Disconnect Investigation

## Overview

When an admin approves a payment in GMS, the member in the app should immediately get access (move from Pending Approval to the main app). This document describes the flow and common failure points.

## Flow

1. **Member** submits payment in app → `payments` row created with `user_id`, `member_id`, `status: pending`
2. **Admin** sees notification, clicks, approves in GMS
3. **GMS** calls `activate_subscription_from_payment` RPC with `p_payment_id`
4. **RPC** does:
   - Updates `payments` → `status: completed`, `payment_status: completed`
   - Inserts `ledger_entries` (credit + debit)
   - Inserts/extends `subscriptions` row
   - **Updates `users`** → `membership_status: 'Active'`, `membership_expiry`, `payment_status: completed`
5. **App** receives update via:
   - Real-time: `users` table UPDATE (filter: `id=eq.{user.id}`)
   - Backup: `payments` table UPDATE (filter: `user_id=eq.{user.id}`) → triggers `refreshUser()`
   - Polling: PendingApprovalScreen polls `refreshUser()` every 10 seconds

## Common Failure Points

### 1. Payment has no `user_id` or `member_id`

- **Symptom**: GMS approval bails out with "Cannot Approve" toast
- **Fix**: GMS now uses `user_id || member_id`. Ensure app payment insert includes both.

### 2. RPC fails silently

- **membership_tiers**: RPC looks up tier by `membership_type`, `description`, or `price_zmw`. Falls back to `Basic`. If `Basic` tier missing, INSERT fails.
- **subscriptions/ledger**: Foreign key or constraint violations
- **Check**: GMS shows "Activation Error" toast with `activationResult.error`

### 3. Real-time not propagating

- Supabase Realtime must be enabled for `users` and `payments` tables
- RLS must allow the member to SELECT their own row
- **Backup**: App now listens to `payments` table; when status → completed, calls `refreshUser()`

### 4. App cache stale

- User stored in AsyncStorage. `refreshUser()` fetches fresh profile and overwrites.
- **Subscription override**: `fetchProfile` checks `subscriptions` table; if active subscription exists, overrides `membershipStatus` to `Active` even if `users.membership_status` is stale.

### 5. `gym_id` on payments

- Payments from app may have `gym_id: null`. GMS Finances filters by `gym_id`, so such payments might not appear in the list. They still appear in notifications (created by trigger with `payment_id`). Approval from notification works.

## Debugging

1. **Check payment row**: `SELECT id, user_id, member_id, status, payment_status FROM payments WHERE id = '<payment_id>'`
2. **Check user after approval**: `SELECT id, membership_status, membership_expiry FROM users WHERE id = '<user_id>'`
3. **Check subscription**: `SELECT * FROM subscriptions WHERE user_id = '<user_id>' ORDER BY ends_at DESC LIMIT 1`
4. **GMS console**: Look for `[GMS Approve] Error:` or activation success toast
5. **App console**: Look for `[useAuth] Payment approved — refreshing profile` or `[useAuth] Real-time profile update`
