# GYMZ Notifications System — Audit, Root Causes & Fixes

**Date:** 2026-03-09  
**Status:** Phase 1 & 2 complete. Phase 3 proposed.

---

## 1. Current Notification Pipeline (Architecture)

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ADMIN NOTIFICATIONS (user_id = NULL)                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  [Event]                    [Creation]                    [Visibility]           │
│                                                                                  │
│  • Member signup     →  handle_new_user trigger   →  DB INSERT (gym_id set)     │
│  • Payment submitted →  notify_admin_on_new_payment → DB INSERT (gym_id set)    │
│  • Admin approves    →  notifyPaymentApproved()    →  GymzGymsGMS createNotification    │
│  • Admin rejects     →  notifyPaymentRejected()   →  GymzGymsGMS createNotification    │
│                                                                                  │
│  RLS: is_gym_admin(gym_id) — admin sees only rows where gym_id matches         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        USER NOTIFICATIONS (user_id = member_id)                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  [Event]                    [Creation]                    [Visibility]           │
│                                                                                  │
│  • Payment approved  →  notifyPaymentApproved()    →  GymzGymsGMS createNotification    │
│  • Payment rejected  →  notifyPaymentRejected()    →  GymzGymsGMS createNotification    │
│  • Payment pending   →  createNotification()      →  MemberPayments / App      │
│  • Admin sends msg   →  db.from("notifications")   →  Members.tsx               │
│                                                                                  │
│  RLS: auth.uid() = user_id AND has_valid_member_id() — member sees own only     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND CONSUMPTION                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  GymzGymsGMS (Admin):  useNotifications hook → Layout.tsx bell → RLS filters by gym   │
│  GymzGymsGMS (Member): useNotifications hook → MemberLayout.tsx bell                    │
│  Mobile App:  databaseNotificationService + realtime on payments                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Root Causes Identified

### 2.1 Why Admins Do Not Receive Notifications

| Root Cause | Location | Fix |
| ------------ | ---------- | ----- |
| **handle_new_user no longer creates member_signup** | `20260305_restore_ultimate_signup_failsafe.sql` overwrote `handle_new_user` and removed the notification INSERT | Restore member_signup INSERT in handle_new_user |
| **GymzGymsGMS createNotification omits gym_id for admin notifications** | `notifications.ts` + `Finances.tsx`, `Layout.tsx` | Pass `gym_id` when creating admin notifications |
| **Admin notifications with gym_id=NULL invisible** | RLS: `is_gym_admin(gym_id)` — NULL fails | Ensure gym_id is always set for admin notifications |
| **No INSERT policy for gym admins** | notifications RLS had SELECT/UPDATE only | Add INSERT policy for gym admins |
| **useNotifications only treated role "admin"** | `useNotifications.ts` checked `user.role === "admin"` | Include `owner` and `super_admin` |

### 2.2 Why Users Do Not Receive Notifications

| Root Cause | Location | Fix |
| ------------ | ---------- | ----- |
| **Member RLS used is_fully_onboarded()** — Users with unique_id but not yet calibrated could not read notifications | `20260302_enforce_full_onboarding_gate.sql` | Use `has_valid_member_id()` instead |
| **GymzGymsGMS createNotification for members** | Worked when INSERT policy existed | Add INSERT policy allowing admin to insert for members in their gym |

---

## 3. Exact Code/SQL Changes Made

### 3.1 Migration: `20260309_fix_notifications_system.sql`

1. **Restore member_signup in handle_new_user**  
   - Re-add INSERT into `notifications` when `v_role = 'member'` and `v_gym_id IS NOT NULL`.

2. **Add INSERT policy for notifications**
   - Service role: full access
   - Members: can insert for themselves (`auth.uid() = user_id`)
   - Gym admins: can insert admin notifications (`gym_id` set) or member notifications (member in their gym)

3. **Relax member notification RLS**
   - Replace `onboarded_notifications_*` (which used `is_fully_onboarded()`) with `member_notifications_*` using `has_valid_member_id()`.

### 3.2 `GymzGymsGMS/src/lib/notifications.ts`

- Add `gym_id` to `createNotification` payload.
- Add `gym_id` to `notifyPaymentApproved` and `notifyPaymentRejected`.
- Pass `gym_id` for admin notifications.

### 3.3 `GymzGymsGMS/src/pages/Finances.tsx`

- Pass `gym_id: user?.gymId` to `notifyPaymentApproved` and `notifyPaymentRejected`.

### 3.4 `GymzGymsGMS/src/components/Layout.tsx`

- Pass `gym_id: user?.gymId` to `notifyPaymentApproved` and `notifyPaymentRejected`.

### 3.5 `GymzGymsGMS/src/hooks/useNotifications.ts`

- Treat `admin`, `owner`, and `super_admin` as admin roles for notification queries and realtime filters.

---

## 4. Test Scenarios (Verification Checklist)

| Scenario | Expected | How to Verify |
| ---------- | ---------- | --------------- |
| **Payment submitted** | Admin sees "New payment of X from Y" | 1. Member submits payment. 2. Admin opens GymzGymsGMS, checks bell. 3. Notification appears. |
| **Admin approves payment** | Member sees "Your payment has been approved!" | 1. Admin approves in Finances. 2. Member opens app/GymzGymsGMS member portal. 3. Notification appears. |
| **Admin rejects payment** | Member sees rejection message | 1. Admin rejects in Finances. 2. Member checks notifications. |
| **New member signup** | Admin sees "New member registered: X" | 1. New user signs up with gym_id in metadata. 2. Admin checks bell. |
| **Gym ID issued** | User can read notifications after approval | 1. Admin approves. 2. User has unique_id. 3. User can read approval notification before calibration. |

---

## 5. Phase 3: Proposed Improved Architecture

After the current system is stable, consider:

### 5.1 Reliability

- **RPC for notification creation**  
  Use a `create_notification` RPC with `SECURITY DEFINER` instead of direct INSERT. Ensures correct `gym_id` and bypasses RLS for trusted server logic.

- **Database triggers for critical events**  
  Keep payment_pending and member_signup in triggers. Add approval/rejection notifications via trigger on `payments` UPDATE (status → completed/failed) instead of GymzGymsGMS client calls.

### 5.2 Observability

- **notification_delivery_log**  
  Table: `notification_id`, `channel` (in_app | push | email), `delivered_at`, `error`.

- **Admin dashboard**  
  Show delivery rates, failures, and retries.

### 5.3 Retry & Queues

- **Edge function + queue**  
  On INSERT into `notifications`, enqueue push/email delivery. Retry with backoff on failure.

### 5.4 Push Delivery (Future)

- **Device tokens**  
  Store in `user_device_tokens` (user_id, token, platform, updated_at).

- **Expo Push / FCM**  
  Use edge function to send push when notification is created.

### 5.5 Scope & Independence

- **Per-gym admin targeting**  
  All admin notifications must have `gym_id` set.

- **Works without UI**  
  Triggers and RPCs run server-side; delivery does not depend on GymzGymsGMS being open.

---

## 6. Files Modified

| File | Change |
| ------ | -------- |
| `GymzGymsGMS/supabase/migrations/20260309_fix_notifications_system.sql` | New migration |
| `GymzGymsGMS/supabase/migrations/20260310_fix_payment_notification_visibility.sql` | Backfill orphaned notifications, harden trigger |
| `GymzGymsGMS/supabase/migrations/20260311_notifications_all_admins.sql` | Backfill admin gym_id, platform admins (gym_id NULL) see all |
| `GymzGymsGMS/src/lib/notifications.ts` | Add gym_id, update notifyPaymentApproved/Rejected |
| `GymzGymsGMS/src/pages/Finances.tsx` | Pass gym_id to notification helpers |
| `GymzGymsGMS/src/components/Layout.tsx` | Pass gym_id, show bell for admin/owner/super_admin |
| `GymzGymsGMS/src/hooks/useNotifications.ts` | Include owner/super_admin in admin role check |

### Admin visibility rules (system-wide)

| Admin type | gym_id | Visibility |
| ------------ | -------- | ------------- |
| Gym admin | Set | Sees notifications for their gym only |
| Gym admin | NULL, in gym_contacts | Sees notifications for gyms they're in |
| Platform admin | NULL | Sees all notifications |
| super_admin | Any | Sees all notifications |

---

## 7. Member Join Notifications Fix (2026-03-28)

**Problem:** Admins were not notified when new members joined via either path.

**Root causes:**

1. Triggers run in invoker context — when a member updates `gym_id` or inserts `event_rsvp`, RLS blocked the notification INSERT (member ≠ gym admin).
2. Gym path join (membership approval) had no notification trigger.
3. `notify_admin_on_member_gym_join` fired for both paths, causing potential duplicates.

**Fix (migration `20260328_admin_notify_on_member_join.sql`):**

1. **RLS policy:** Allow members to INSERT admin notifications when `user_id IS NULL` and they're associated with the gym (via `users.gym_id`, `event_rsvps`, or `membership`).
2. **Membership trigger:** `notify_admin_on_membership_active` — fires when `membership` becomes `active` (gym path, after admin approval).
3. **Users trigger:** `notify_admin_on_member_gym_join` — now only fires for `event_access` (avoids duplicate with membership trigger).
4. **Event RSVP trigger:** `notify_admin_on_event_signup` — enhanced with gym name, member ID.

**Notification content (acceptance criteria):**

- Member name ✓
- Join type (Gym or Event) ✓
- Gym name ✓
- Timestamp (created_at) ✓
- Member's assigned ID ✓
