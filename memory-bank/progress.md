# Progress

## Fixed Issues

### AI Calibration After Approval Only (Fixed - 2026-03-02)

**Problem:** Users were prompted to complete AI Calibration immediately after submitting payment. Payment submission does not equal approval. Calibration must only unlock after admin approval.

**Mandatory flow:** Path Selection → Payment → Pending Approval → Admin Approval → AI Calibration → App Access.

**Solution:**

1. **useAuth.tsx** — Added `isApprovedForCalibration`: event_access always true; gym_access only when `membershipStatus` is `'Active'` or `'approved'`.
2. **AppNavigator.tsx** — Approval gate: `!hasValidMemberId || !isApprovedForCalibration` blocks access to HealthMetrics stack. Approval gate initial route: SubscriptionPlans if not yet paid, PendingApproval if paid and pending.
3. **HealthMetricsScreen.tsx** — Defense-in-depth: redirects to PendingApproval if `!isApprovedForCalibration`.
4. **PendingApprovalScreen.tsx** — On approval: issues member ID, calls `refreshUser()`; gate chain re-evaluates and routes to HealthMetrics (removed manual `navigation.reset` to HealthMetrics since that screen is not in the approval gate stack).

**Files Modified:**

- `GymzApp/hooks/useAuth.tsx`
- `GymzApp/navigation/AppNavigator.tsx`
- `GymzApp/screens/HealthMetricsScreen.tsx`
- `GymzApp/screens/PendingApprovalScreen.tsx`

### Login / Signup Screen Flash Race (Fixed - 2026-03-02)

**Problem:** Both new and returning users briefly saw HealthMetrics or GymSelection for ~1 second before being routed to the correct screen. This survived multiple prior "fixes".

**Root Cause — THREE concurrent race conditions:**

1. `login()` called `setUser()` twice (thin data then full profile) — intermediate render with wrong gate values
2. `onAuthStateChange` listener ran in parallel with `login()`, overwriting state with an incomplete fallback user (especially for new users where fetchProfile returned null)
3. SignupScreen/LoginScreen called `navigation.navigate('GymSelection')` AFTER `login()`, racing with the navigator's own route selection

**Solution — all three fixed together:**

1. `login()` is atomic: `loginInProgress=true` + `loading=true`, fetch full profile, ONE `setUser`, then unlock in `finally`
2. `onAuthStateChange` skips entirely when `loginInProgress.current` is true; removed fallback user creation
3. Removed all manual `navigation.navigate` calls after `login()`; all `login()` calls are now `await`ed
4. `loadSession()` is single-phase: network first, cache only on failure

**Why prior fixes failed:** Only addressed problem #1. Problems #2 and #3 were never identified.

**Files Modified:**

- `GymzApp/hooks/useAuth.tsx` — `login()`, `loadSession()`, `onAuthStateChange`; added `loginInProgress` ref
- `GymzApp/screens/SignupScreen.tsx` — Removed manual navigate, await login()
- `GymzApp/screens/LoginScreen.tsx` — All login() calls awaited, removed manual navigate

### Manual Gym ID Entry Removed + Returning User Auto-Routing (Fixed - 2026-03-02)

**Problem:** GymSelectionScreen contained a Member ID Verification modal that asked returning users (those with a `uniqueId`) to manually type their gym member ID when tapping a gym in Discovery. New users who hadn't finished registration were also incorrectly being prompted for an ID they didn't have. This UI had been discarded but its code remnants persisted.

**Root Cause:** The `openGymWithIdCheck()` function checked `userId && user?.uniqueId` and if both existed, showed a modal asking the user to manually type their member ID. This was logically wrong — the system already knows the user's gym from their credentials (gymId, accessMode stored in the users table). Additionally, `LoginScreen.tsx` did not pass `gymId` or `accessMode` in the initial `login()` call, causing returning users to briefly lack `hasGymMapping` and flash GymSelection before the full profile loaded.

**Solution:**

1. Removed the entire Member ID Verification modal from `GymSelectionScreen.tsx`:
   - Deleted state: `memberIdModalVisible`, `memberIdInput`, `memberIdError`, `validatingId`
   - Deleted functions: `openGymWithIdCheck()`, `validateAndProceed()`
   - Deleted the full Modal JSX and related styles
   - All gym taps now go directly to `openGymDetails()`
2. Fixed `LoginScreen.tsx` to pass `gymId` and `accessMode` in both login paths so `hasGymMapping` resolves correctly on first render.

**Files Modified:**

- `GymzApp/screens/GymSelectionScreen.tsx`
- `GymzApp/screens/LoginScreen.tsx`

### Staff Assignment + Role Escalation Hardening (Fixed - 2026-03-02)

**Problem:** GMS did not provide a secure, explicit "admin assigns staff" flow. Staff support was inconsistent: staff could log in but had limited routes, and role security relied on broad user update patterns.

**Solution:**

1. Added migration `20260302_staff_role_hardening_and_promotion.sql`:
   - Trigger `enforce_user_role_security()` on `public.users` to block unauthorized role tampering.
   - Enforced max 3 gym admins per gym.
   - Added secure RPCs for role transitions:
     - `promote_member_to_staff(p_user_id)`
     - `demote_staff_to_member(p_user_id)`
2. Added admin-only member action in `GymzGymsGMS/src/pages/Members.tsx` to promote members to staff via RPC.
3. Added admin-only staff revocation action in `GymzGymsGMS/src/pages/Staff.tsx` using `demote_staff_to_member`, with fallback user resolution for legacy rows without `user_id`.
4. Enabled staff operational routes (dashboard/members/finances/checkin/rooms/notice-board/settings) using staff-prefixed paths.
5. Updated staff sidebar entries to new routes.
6. Fixed missing `Users` import in `GymzGymsGMS/src/pages/Staff.tsx`.
7. Added migration `20260302_staff_role_audit_log.sql` to log all staff role promotions/demotions in `admin_audit_logs` (actor, target, gym, old/new role, reason).
8. Added admin-only "Role Changes Audit" panel in `GymzGymsGMS/src/pages/Staff.tsx` with gym-scoped log retrieval and manual refresh.

**Files Modified:**

- `GymzGymsGMS/supabase/migrations/20260302_staff_role_hardening_and_promotion.sql` (new)
- `GymzGymsGMS/supabase/migrations/20260302_staff_role_audit_log.sql` (new)
- `GymzGymsGMS/src/pages/Members.tsx`
- `GymzGymsGMS/src/App.tsx`
- `GymzGymsGMS/src/components/AppSidebar.tsx`
- `GymzGymsGMS/src/pages/Staff.tsx`
- `memory-bank/activeContext.md`
- `memory-bank/progress.md`

### Multi-Gym Pricing Hard-Coding Removal (Fixed - 2026-03-02)

**Problem:** Pricing tiers were still hard-coded in subscription/payment surfaces, causing single-gym assumptions and mixed pricing sources.

**Solution:** Enforced onboarding-driven pricing as SSOT:

1. Replaced static plan maps in mobile and web member flows with `gym_membership_plans` queries scoped by `gym_id`.
2. Added strict UI guardrails: if no valid plan data exists, show "Pricing not available" and block checkout.
3. Locked subscription checkout amount/description/duration to selected onboarding plan values (no manual inferred pricing path).
4. Added `custom_inclusions TEXT[]` to `gym_membership_plans` and updated OAC Step 4 to collect per-tier gym-specific inclusions.
5. Standardized plan-card composition: dynamic gym price + fixed platform benefits + gym-specific inclusions.

**Files Modified:**

- `GymzApp/screens/GymSelectionScreen.tsx`
- `GymzApp/screens/SubscriptionPlansScreen.tsx`
- `GymzApp/screens/PaymentsScreen.tsx`
- `GymzApp/services/pricingPlans.ts` (new)
- `GymzGymsGMS/src/components/SubscriptionModal.tsx`
- `GymzGymsGMS/src/pages/MemberPayments.tsx`
- `GymzGymsGMS/src/services/gymPricing.ts` (new)
- `GymzGymsGMS/src/pages/Finances.tsx`
- `GymzGymsGMS/supabase/migrations/20260302_add_custom_plan_inclusions.sql` (new)
- `GymzWebsite/src/components/SubscriptionModal.tsx`
- `GymzWebsite/src/hooks/useAuth.tsx`
- `GymzWebsite/src/services/gymPricing.ts` (new)
- `GymzWebsite/src/website/data/content.ts`
- `OAC/src/pages/wizard/steps/Step4Pricing.tsx`

### Pricing Visibility Scope Enforcement (In Progress - 2026-03-02)

**Problem:** Users reported seeing plan types (e.g., Family/Couple) outside valid gym/path scope. Required behavior is strict scope: `Selected Gym -> Selected Path -> Gym Configured Plans`.

**Audit Findings:**

1. Live active plan records are sourced from `gym_membership_plans`; no hard-coded Family/Couple tiers are present in currently active data snapshot.
2. Existing fetch logic was gym-scoped but not path-scoped, which allowed over-broad plan visibility when a gym had mixed-tier data.
3. Payment enforcement validated `plan_id` ownership by gym, but did not validate compatibility with member `access_mode`.

**Implemented Controls:**

1. Added path scope column:
   - `GymzGymsGMS/supabase/migrations/20260302_add_plan_access_scope.sql`
   - `access_mode_scope` on `gym_membership_plans` with strict enum-like check.
2. Added backend validation:
   - `GymzGymsGMS/supabase/migrations/20260302_enforce_plan_scope_by_access_mode.sql`
   - Rejects payment inserts/updates when selected plan scope does not match user access mode.
3. Updated plan fetchers to require gym + path:
   - `GymzApp/services/pricingPlans.ts`
   - `GymzGymsGMS/src/services/gymPricing.ts`
   - `GymzWebsite/src/services/gymPricing.ts`
   - No selected path => no plan visibility.
4. Wired access path through subscription/payment flows:
   - `GymzApp/screens/AccessModeSelectionScreen.tsx`
   - `GymzApp/screens/SubscriptionPlansScreen.tsx`
   - `GymzApp/screens/PaymentsScreen.tsx`
   - `GymzApp/screens/GymSelectionScreen.tsx`
   - `GymzGymsGMS/src/components/SubscriptionModal.tsx`
   - `GymzGymsGMS/src/pages/MemberPayments.tsx`
   - `GymzWebsite/src/components/SubscriptionModal.tsx`
5. Updated OAC configuration UI:
   - `OAC/src/pages/wizard/steps/Step4Pricing.tsx`
   - Added per-plan `Access Path Scope` selector.

**Status:** Code complete; requires migration apply + plan scope data configuration in OAC to fully enforce in production.

### Strict Sequential Onboarding Enforcement (Fixed - 2026-03-02)

**Problem:** Users could reach AI Calibration without selecting a Gym Path. The database only enforced `has_valid_member_id()` on feature tables, not full calibration completeness. A later migration (`20260305`) regressed enforcement on 3 calibration tables.

**Root Cause:** Multiple breach points:

1. HealthMetrics was included in navigation stacks before gym mapping was complete
2. HealthMetricsScreen had no self-guard checking prerequisites
3. PendingApprovalScreen used soft navigation (navigate vs reset)
4. `is_fully_onboarded()` DB function existed but was never used in RLS
5. `20260305_neutral_onboarding_id_rls_fix.sql` removed member ID checks from 3 tables

**Solution:** Four-layer enforcement:

1. AppNavigator: Removed HealthMetrics from pre-gym-mapping and pre-member-ID stacks
2. HealthMetricsScreen: Added useEffect guard + save-time guard checking hasGymMapping + hasValidMemberId
3. PendingApprovalScreen: Changed to navigation.reset() with isHardGate: true
4. New migration `20260302_enforce_full_onboarding_gate.sql`: Upgraded all feature tables to `is_fully_onboarded()` RLS, with hybrid enforcement on calibration tables

**Files Modified:**

- `GymzApp/navigation/AppNavigator.tsx`
- `GymzApp/screens/HealthMetricsScreen.tsx`
- `GymzApp/screens/PendingApprovalScreen.tsx`
- `GymzGymsGMS/supabase/migrations/20260302_enforce_full_onboarding_gate.sql` (new)

### OAC Profile Completeness Stuck at 0% (Fixed - 2026-03-01)

**Problem:** The gym onboarding wizard (OAC) always showed 0% profile completeness even after uploading documents and completing all wizard steps.

**Root Cause:** RLS policy conflict on `gym_onboarding_status` table. The `20260225_harden_gym_isolation.sql` migration added a hardened policy `table_onboarding_gym_isolation` that uses `is_gym_admin()`. That function only passes for `role IN ('admin', 'super_admin')`. Gym owners in the OAC have `role = 'owner'`, so they were blocked from reading their own `gym_onboarding_status` row. With no row returned, `gym?.gymOnboardingStatus?.[0]?.completenessScore` was `undefined`, falling back to `?? 0`.

**Solution:** Created `GymzGymsGMS/supabase/migrations/20260301_fix_oac_completeness_score_rls.sql`:

1. Expanded `is_gym_admin()` to include `'owner'` role.
2. Added a SELECT policy allowing owners to read their own status by `gym_id` match.
3. Backfilled all gym completeness scores.

**Files Modified:**

- `GymzGymsGMS/supabase/migrations/20260301_fix_oac_completeness_score_rls.sql` (new migration)

### Event QR Code Not Working (Fixed - 2026-02-28)

**Problem:** Event members reported their QR codes were not working when trying to check in to events.

**Root Cause:** There was a format mismatch between what was being displayed and what the scanner expected:

- **Displayed QR code**: Raw `qr_token` (32-character hex string)
- **Scanner expected**: `"gymz_event_checkin:{event_id}:{secret}"`

**Solution:** Updated `GymzApp/screens/EventDetailScreen.tsx` (line 314) to format the QR code value correctly:

```typescript
// Before:
value={userRsvp.qrToken}

// After:
value={`gymz_event_checkin:${event.id}:${userRsvp.qrToken}`}
```

**Files Modified:**

- `GymzApp/screens/EventDetailScreen.tsx` - Fixed QR code format to match scanner expectations

**Impact:** Event members can now successfully check in to events using their QR codes in the mobile app.

## Current Status

### Working Features

- Event QR code generation with proper format
- Event QR code scanning via `EventQRCheckInScreen`
- Event RSVP system
- Gym member QR codes (secure, time-based)
- Admin check-in system

### Known Components

- **Mobile App (GymzApp):**
  - `EventDetailScreen.tsx` - Displays event QR codes to members
  - `EventQRCheckInScreen.tsx` - Scans event venue QR codes
  - `ProfileScreen.tsx` - Generates gym member QR codes
  - `secureQRService.ts` - Handles secure QR generation

- **Web Admin (GymzGymsGMS):**
  - `eventCheckIn.ts` - Verifies event RSVP for check-in
  - `checkin.ts` - Main check-in API for gym access
  - `secureQRCheckin.ts` - Validates secure QR codes
  - `QRScanner.tsx` - Camera-based QR scanner component
  - `MemberQRCode.tsx` - Member QR code display (web)

### QR Code Formats in Use

1. **Event Check-in QR**: `"gymz_event_checkin:{event_id}:{secret}"`
2. **Gym Member QR**: `"Gymz|hash|user_id|timestamp|expires_at"` (time-based, expires in 60s)
