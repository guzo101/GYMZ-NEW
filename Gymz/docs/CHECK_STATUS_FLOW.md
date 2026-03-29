# Check Status Flow — What It Looks For & Why It Can Get Stuck

## Root Cause (Critical Gating Bug Fix)

**Root cause:** The gate used conditional stack rendering only; when state updated, the NavigationContainer did not reliably remount, and PendingApprovalScreen had no way to explicitly navigate to HealthMetrics (it was not in the same stack).

**Fix:** (1) Add HealthMetrics to the approval gate stack so `navigation.replace('HealthMetrics')` is possible; (2) Add a useEffect in PendingApprovalScreen that immediately replaces with HealthMetrics when `hasValidMemberId && isApprovedForCalibration && gymId && accessMode`; (3) Unify gate logic with `canGoToCalibration` and `mustShowApprovalGate`; (4) Add explicit `[AppNavigator] GATE` logs on every render.

**Gate location:** `AppNavigator.tsx` lines 89–119, `PendingApprovalScreen.tsx` lines 69–77.

---

## 1. What Check Status Is Looking For

**Single condition:** `users.membership_status = 'Active'` (or `'approved'`)

| Layer | Variable | Source |
| ----- | -------- | ------ |
| **Database** | `membership_status` | `users` table column (snake_case) |
| **Fetch result** | `rawProfile.membership_status` | Raw Supabase response |
| **Mapped profile** | `profile.membershipStatus` | After `mapProfile()` → camelCase |
| **Auth context** | `user.membershipStatus` | What `useAuth()` exposes |

**Approval check in `handleCheckStatus`:**

```js
const approved = diag.success &&
  (diag.rawProfile?.membership_status || diag.profile?.membershipStatus || '')
    .toLowerCase() === 'active';
```

- Uses both `rawProfile.membership_status` (DB) and `profile.membershipStatus` (mapped)
- No variable mismatch — both paths covered

---

## 2. What Happens When It Finds It

**Current behavior when `approved === true`:**

1. `setShowDebugOverlay(false)` — closes debug modal
2. Nothing else

**What it relies on (passive flow):**

1. `refreshUserWithDiagnostics()` already called `setUser(profile)` with `membershipStatus: 'Active'`
2. AuthContext updates
3. AppNavigator re-renders with new `isApprovedForCalibration`
4. `navKey` changes → `NavigationContainer` remounts
5. New stack shows HealthMetrics

**The button does not navigate.** It only updates state and expects the navigator to react.

---

## 3. The Disconnect (Why User Stays Stuck)

| Step | What happens | Problem? |
| ---- | ------------- | --------- |
| 1. Fetch | DB returns `membership_status: 'Active'` | ✅ Works |
| 2. Map | `mapProfile` → `membershipStatus: 'Active'` | ✅ Works |
| 3. State | `setUser(profile)` updates AuthContext | ✅ Works |
| 4. Gate | `isApprovedForCalibration` becomes `true` | ✅ Works |
| 5. Navigate | AppNavigator should show HealthMetrics | ❌ **Stuck here** |

**Root cause:** `NavigationContainer` kept a static key (`'auth'`). When the gate passed, the navigator re-rendered but the container did not remount, so it kept showing the old route (Pending Approval).

**Fix applied:** `navKey` now includes `approvalGatePassed` and `initialRoute`. When the gate passes, the key changes → container remounts → fresh navigation state.

---

## 4. Data Flow Summary

```text
DB: users.membership_status = 'Active'
    ↓
refreshUserWithDiagnostics() fetches users row
    ↓
mapProfile(userData) → profile.membershipStatus = 'Active'
    ↓
setUser(profile) → AuthContext
    ↓
useAuth() → user.membershipStatus, isApprovedForCalibration
    ↓
AppNavigator: !hasValidMemberId || !isApprovedForCalibration?
    → false (gate passed) → render calibration stack, initialRoute = 'HealthMetrics'
    ↓
navKey = 'auth-true-HealthMetrics' (was 'auth-false-PendingApproval')
    ↓
NavigationContainer remounts → shows HealthMetrics
```

---

## 5. Not a Dead-End Button

The button is **not** a dead end. It:

1. Fetches from DB
2. Updates state via `setUser`
3. Relies on AppNavigator to react to that state

The failure was in step 3: the navigator was not resetting when the gate passed. The `navKey` change forces a full remount when approval happens.

---

## 6. Variable Alignment (No Mismatch)

| DB column | Raw fetch | mapProfile | useAuth | AppNavigator |
| --------- | --------- | ---------- | ------- | -------------- |
| `membership_status` | `rawProfile.membership_status` | `userData.membershipStatus` (DataMapper) | `user.membershipStatus` | `dbMembershipStatus` |
| — | — | `profile.membershipStatus` | — | → `isApprovedForCalibration` |

DataMapper converts `membership_status` → `membershipStatus`. All layers use the same value.
