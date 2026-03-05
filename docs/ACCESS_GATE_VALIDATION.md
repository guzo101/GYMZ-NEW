# Access Gate — Validation Scenarios and Test Evidence

## Summary

The Pending Approval flow was fully removed and replaced with a single **Access
Gate** screen and **membership** table as the single source of truth. The gate
uses a strict state machine and `replace()` for all transitions so users cannot
get stuck when the database is Active and Approved.

## Observability (Part E)

On every refresh cycle (manual or 10s auto), the Access Gate logs:

- `membership_status`
- `approved`
- `paid_at`
- `unique_member_id`
- `calibration_completed`
- `final_routing_decision`

Example (in dev console):

```javascript
[AccessGate] {
  membership_status: 'active',
  approved: true,
  paid_at: '2026-03-21T...',
  unique_member_id: 'GY-SW26001',
  calibration_completed: false,
  final_routing_decision: 'to_calibration'
}
```

Use these logs to verify the scenarios below.

---

## Validation Scenarios (Part F)

### 1. Payment submitted

- **Steps:** User completes gym/path selection, subscribes, submits payment
  (e.g. Cash).
- **Expected:** Gate shows **Pending Approval** UI (“We will unlock access once
  approved”). No calibration access. Manual “Refresh status” and 10s
  auto-refresh available.
- **Proof:** Logs show `membership_status: 'pending'`, `approved: false`,
  `final_routing_decision: 'pending'`. User remains on Access Gate screen.

### 2. Admin approves

- **Steps:** Admin approves payment in GymzGymsGMS (e.g. sets payment status to
  completed/approved). User is on Access Gate (pending UI).
- **Expected:** On the **next** refresh cycle (within 10s or on manual refresh),
  gate routes to **AI Calibration** (HealthMetrics) automatically. No manual
  action required.
- **Proof:** Logs show `membership_status: 'active'`, `approved: true`,
  `final_routing_decision: 'to_calibration'`. Screen replaces to HealthMetrics.

### 3. Calibration completed

- **Steps:** User completes AI Calibration (HealthMetrics) and saves. Next time
  they hit the gate (e.g. app restart or re-entry).
- **Expected:** Gate routes into **app home** (Main).
- **Proof:** Logs show `calibration_completed: true`,
  `final_routing_decision: 'to_main'`. Screen replaces to Main.

### 4. User already active on app launch

- **Steps:** User is already active and calibrated; they open the app (or refresh).
- **Expected:** Gate runs once; if `membership_status = active`, `approved = true`,
  and `calibration_completed = true`, gate goes **directly to Main**. If
  calibration incomplete, gate goes **directly to HealthMetrics** (AI Calibration).
  No Pending UI.
- **Proof:** Logs show `final_routing_decision: 'to_main'` or `'to_calibration'`
  and no `'pending'` when DB is active and approved.

---

## Redirect and Staleness Rules (Part D)

- **Calibration incomplete** never sends users to a “Pending approval” state; it
  routes only to **AI Calibration**.
- **Pending approval** UI is shown only when `membership_status = pending` or
  `approved = false`.
- All transitions from the gate use **replace**, not push; the gate unmounts
  after routing.
- No other guard overrides the route after a successful gate decision
  (Dashboard/EventHome only redirect to AccessGate if e.g. member ID is missing,
  so the gate can re-evaluate).

---

## Files Delivered

<!-- markdownlint-disable MD013 -->
| Part | Deliverable |
| ------ | ------------- |
| Backend | `GymzGymsGMS/supabase/migrations/20260321_access_gate_membership_ssot.sql` — membership table, RLS, RPCs, triggers, backfill |
| Frontend | `GymzApp/screens/AccessGateScreen.tsx` — new Access Gate screen and state machine |
| Service | `GymzApp/services/membershipGate.ts` — `fetchMembershipForGate`, `setCalibrationCompleted` |
| Navigation | `GymzApp/navigation/AppNavigator.tsx` — single gate stack, initial route AccessGate when hasGymMapping |
| Removed | `GymzApp/screens/PendingApprovalScreen.tsx` — deleted; all PendingApproval references removed from navigator and guards |
| Validation | This document and console logs for evidence |
<!-- markdownlint-enable MD013 -->
