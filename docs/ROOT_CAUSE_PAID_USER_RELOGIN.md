# Root Cause Report: Paid User Forced to Payment Flow After Relogin

**Date:** 2026-04-01  
**Severity:** Critical  
**Status:** Fixed

## Problem Summary

A member who had already paid was sometimes forced to go through the payment flow again after logging out and logging back in. This created double payment risk, blocked access, and damaged trust.

## Root Cause Analysis

### Primary Causes

1. **Strict exact-match in `get_membership_for_gate`**  
   The RPC required an exact match on `(user_id, gym_id, access_mode)`. When `users.gym_id` did not match the gym where the user had an active membership, the RPC returned `null`, causing AccessGate to route to GymSelection (and eventually SubscriptionPlans).

2. **Multi-gym / stale context**  
   The `users` table stores a single `gym_id`. If a user had memberships at multiple gyms, or if `users.gym_id` was stale (e.g. from an earlier signup), the gate looked up membership for the wrong gym and got `null`.

3. **Event_access users had no membership row**  
   Event_access users receive an ID immediately without payment. No membership row was created, so on relogin `get_membership_for_gate` returned `null` and they were sent to GymSelection.

4. **No server-side guard against duplicate payment**  
   The system allowed creating a new payment even when the user already had an active membership for the same gym and access mode.

### Flow That Triggered the Bug

1. User logs in → `fetchProfile` loads `users` (including `gym_id`, `access_mode`).
2. Navigator routes to AccessGate (user has gym mapping).
3. AccessGate calls `get_membership_for_gate(user_id, gym_id, access_mode)`.
4. If `users.gym_id` does not match the gym where membership exists → RPC returns `null`.
5. `decideRoute(null)` → `no_membership` → `navigation.replace('GymSelection')`.
6. User selects gym again → AccessModeSelection → SubscriptionPlans.
7. User is shown payment UI again.

### Evidence

- **Access gate logic:** `AccessGateScreen.tsx` uses `fetchMembershipForGate`; when it returns `null`, `decideRoute` yields `no_membership` and routes to GymSelection.
- **RPC behavior:** `get_membership_for_gate` in `20260321_access_gate_membership_ssot.sql` only returned a row when `(user_id, gym_id, access_mode)` matched exactly.
- **Event access:** `AccessModeSelectionScreen` issues an event ID and navigates to HealthMetrics without creating a membership row.

## Fix Summary

### 1. Extended `get_membership_for_gate` (Migration `20260401_paid_user_relogin_fix.sql`)

- Tries exact match first.
- If no match, falls back to any active membership for the user.
- Returns `gym_context_mismatch = true` when the fallback is used.
- Caller syncs `users.gym_id` and `users.access_mode` when `gym_context_mismatch` is true.

### 2. New RPC: `sync_user_gym_context_from_membership`

- Updates `users.gym_id` and `users.access_mode` from the membership.
- Called by AccessGate when `gym_context_mismatch` is true.

### 3. Payment guard trigger: `guard_payment_against_active_membership`

- Blocks `INSERT` into `payments` when the user already has an active membership for the same gym and access mode.
- Raises `PAYMENT_BLOCKED` to prevent duplicate payments.

### 4. Event_access membership creation

- Trigger `trg_ensure_event_access_membership` creates a membership row when an event_access user receives a `unique_id`.
- Backfill adds membership rows for existing event_access users with `unique_id`.

### 5. Client-side guards

- **AccessModeSelectionScreen:** Before navigating to SubscriptionPlans, checks for active membership; if found, navigates to AccessGate instead.
- **SubscriptionPlansScreen:** Handles `PAYMENT_BLOCKED` and redirects to AccessGate with a clear message.
- **AccessGateScreen:** When `gym_context_mismatch` is true, calls `syncUserGymContextFromMembership` and refreshes the user before routing.

### 6. Monitoring

- AccessGate logs `[AccessGate] MISROUTE` when a paid user would be routed to payment/gym-selection (defensive; should not occur after the fix).
- AccessGate logs `gym_context_mismatch` for observability.

## Reproducible Steps (Before Fix)

1. Create a user with active gym membership at Gym A.
2. Ensure `users.gym_id` is set to a different gym B (or null) or that the user has multiple gyms and `users.gym_id` points to an unpaid gym.
3. Log out.
4. Log back in.
5. **Observed:** User is sent to GymSelection, then SubscriptionPlans.
6. **Expected:** User is sent to Main or HealthMetrics.

## Acceptance Criteria (Met)

- [x] A user with an active membership who logs out and logs back in is never routed to the payment screen.
- [x] If membership is active, the system cannot create a new payment request for the same period.
- [x] The system correctly handles users who are members of multiple gyms without misrouting them.
- [x] Event_access users receive a membership row and are not misrouted on relogin.

## Files Modified

- `GymzGymsGMS/supabase/migrations/20260401_paid_user_relogin_fix.sql` (new)
- `GymzApp/services/membershipGate.ts` — `gym_context_mismatch`, `syncUserGymContextFromMembership`
- `GymzApp/screens/AccessGateScreen.tsx` — sync on mismatch, monitoring logs
- `GymzApp/screens/AccessModeSelectionScreen.tsx` — membership check before SubscriptionPlans
- `GymzApp/screens/SubscriptionPlansScreen.tsx` — `PAYMENT_BLOCKED` handling, `gym_id` from route

## Database Integrity Queries

See `GymzGymsGMS/scripts/integrity_paid_user_relogin.sql` for queries to:

1. Find paid payments without matching active membership.
2. Find active memberships with missing user/gym references.
3. Find users whose `gym_id` does not match any active membership.
4. Find event_access users with `unique_id` but no membership row.
