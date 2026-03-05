# Active Context

## Recent Changes

### Admin Notifications on Member Join — Fixed (2026-03-28)

Admins were not being notified when new members joined via either onboarding path.

**Root causes:**

1. Triggers run in invoker context — when a member updates `gym_id` or inserts `event_rsvp`, RLS blocked the notification INSERT (member ≠ gym admin).
2. Gym path join (membership approval) had no notification trigger.
3. `notify_admin_on_member_gym_join` fired for both paths, causing potential duplicates.

**Fix (migration `20260328_admin_notify_on_member_join.sql`):**

1. **RLS policy:** Allow members to INSERT admin notifications when `user_id IS NULL` and they're associated with the gym (via `users.gym_id`, `event_rsvps`, or `membership`).
2. **Membership trigger:** `notify_admin_on_membership_active` — fires when `membership` becomes `active` (gym path, after admin approval).
3. **Users trigger:** `notify_admin_on_member_gym_join` — now only fires for `event_access` (avoids duplicate with membership trigger).
4. **Event RSVP trigger:** `notify_admin_on_event_signup` — enhanced with gym name, member ID.

**Notification content:** Member name, join type (Gym/Event), gym name, timestamp, member's assigned ID.

**Files Modified:**

- `GymzGymsGMS/supabase/migrations/20260328_admin_notify_on_member_join.sql` (new)
- `docs/NOTIFICATION_AUDIT_AND_FIX.md` — Section 7 added

### Login / Signup Screen Flash Race Condition — Permanently Fixed (2026-03-02)

Eliminated the recurring screen flash where users (new AND returning) briefly saw HealthMetrics or GymSelection for ~1 second before being routed to the correct screen.

**Problem — THREE concurrent race conditions:**

1. **Two-phase `setUser` in `login()`**: Called `setUser(u)` immediately with thin data, then fetched full profile and called `setUser(fullProfile)`. Between these two calls, the navigator rendered with incomplete derived state (`isCalibrated`, `hasGymMapping` = false), routing to wrong screens.

2. **`onAuthStateChange` competing with `login()`**: When `signInWithPassword()` or `signUp()` fires, Supabase emits a `SIGNED_IN` event. The `onAuthStateChange` listener ran `fetchProfile()` in parallel with `login()`. For new users, `fetchProfile()` often returned `null` (DB row not yet created), causing it to set a fallback user with NO gymId, NO accessMode, NO calibration data — overwriting whatever `login()` was doing.

3. **Manual `navigation.navigate('GymSelection')` after `login()`**: Both `SignupScreen` and `LoginScreen.handleRegister` called `navigation.navigate('GymSelection')` AFTER calling `login()`. But `login()` now sets `loading=true`, so the navigator should be showing SplashScreen. The manual navigate raced with the navigator's own route selection when `loading` dropped to `false`.

**Root Fix (THREE changes, all required):**

1. **`login()` is now atomic**: Sets `loginInProgress = true` + `loading = true` first. Fetches full DB profile. Does ONE `setUser(finalProfile)`. Then `loginInProgress = false` + `loading = false` in `finally`. Splash screen stays up the entire time. Zero intermediate renders.

2. **`onAuthStateChange` respects `loginInProgress`**: When `loginInProgress.current` is `true`, the listener skips entirely — no competing `setUser`, no fallback user overwrite. Also removed the fallback user creation (if fetchProfile returns null during an auth event and login isn't in progress, it simply doesn't set user — no incomplete state).

3. **Removed manual `navigation.navigate` calls after `login()`**: SignupScreen and LoginScreen.handleRegister no longer call `navigation.navigate('GymSelection')`. They `await login()`, and when it resolves, the navigator's gate chain (`!hasGymMapping → GymSelection`) handles routing automatically. All `login()` calls are now `await`ed.

4. **`loadSession()` — single-phase hydration**: Removed two-phase cache-then-network. Fetches Supabase session first; falls back to cache only on network failure. Single `setUser`, single `setLoading(false)`.

**Why ALL previous fixes failed:** They only addressed problem #1 (passing more fields) or UI symptoms (removing modals). Problem #2 (`onAuthStateChange` overwriting state) and problem #3 (manual navigates racing with navigator) were never identified. All three had to be fixed together.

**Files Modified:**

- `GymzApp/hooks/useAuth.tsx` — `login()`, `loadSession()`, `onAuthStateChange` rewritten; added `loginInProgress` ref
- `GymzApp/screens/SignupScreen.tsx` — Removed manual navigate after login, await login()
- `GymzApp/screens/LoginScreen.tsx` — All login() calls now awaited, removed manual navigate in handleRegister

### Manual Gym ID Entry Removed + Returning User Auto-Routing Fixed (2026-03-02)

Removed the incorrect Member ID Verification modal from GymSelectionScreen and fixed returning user auto-routing.

**Problem:** Users who had NOT finished registration were being asked to provide a Gym ID after selecting a gym at the Discovery stage. Returning users with existing IDs were also being asked to manually enter their ID, which is redundant — the system already knows their gym association from their credentials. The manual ID entry UI had been discarded but remnants still existed.

**What changed:**

1. **GymSelectionScreen.tsx — Full removal of Member ID Verification modal**
   - Removed state variables: `memberIdModalVisible`, `memberIdInput`, `memberIdError`, `validatingId`
   - Removed functions: `openGymWithIdCheck()`, `validateAndProceed()`
   - Removed the entire Member ID Verification Gate Modal (Modal + TextInput + validation UI)
   - Removed dead styles: `memberIdInputWrapper`, `memberIdInput`
   - Removed unused `TextInput` import
   - All gym card taps now go directly to `openGymDetails()` (discovery view)

2. **LoginScreen.tsx — Returning user auto-routing fix**
   - Added `gymId` and `accessMode` to the initial `login()` call in both login paths
   - Previously these fields were missing, causing `hasGymMapping` to briefly evaluate `false` after login
   - This prevented returning users from being auto-routed to their gym on first render
   - Now returning users with complete gym mapping go directly to Main (no GymSelection flash)

**Core rule enforced:**

- Returning users: credentials determine gym association automatically. No extra steps, no repeated onboarding, no ID input.
- New users: never asked for an ID they don't have. Discovery goes straight to gym details.
- Manual ID entry UI is fully deleted. No remnants, no fallback prompts, no hidden screens.
- In-app QR code is the only mechanism for ID-based verification.

**Files Modified:**

- `GymzApp/screens/GymSelectionScreen.tsx` — Removed member ID modal + all related logic
- `GymzApp/screens/LoginScreen.tsx` — Added gymId/accessMode to login calls

### Staff Role Security + Operational Access Hardening (2026-03-02)

Implemented a strict "admin assigns staff" model in GMS with database-enforced role security and staff operational routes.

**What changed:**

1. **New migration: `20260302_staff_role_hardening_and_promotion.sql`**
   - Added trigger guard `enforce_user_role_security()` on `public.users`.
   - Blocks unauthorized role mutation (prevents self-escalation / arbitrary elevation).
   - Enforces max 3 `admin` users per gym.
   - Added secure RPCs:
     - `promote_member_to_staff(p_user_id UUID)`
     - `demote_staff_to_member(p_user_id UUID)`
   - RPC checks enforce same-gym admin scope (except platform/super admins).

2. **Members UI: admin-only staff assignment**
   - Added admin-only "Staff" action in `Members.tsx`.
   - Uses secure RPC `promote_member_to_staff`.
   - Staff users can view members but cannot elevate roles.

3. **Staff UI: admin-only role revocation**
   - Added admin-only "Revoke Staff" action in `Staff.tsx`.
   - Uses secure RPC `demote_staff_to_member`.
   - Includes fallback user resolution by email+gym for legacy `staff` rows lacking `user_id`.

4. **Staff operational routing enabled**
   - Added staff-only operational routes:
     - `/staff/dashboard`
     - `/staff/members`
     - `/staff/finances`
     - `/staff/checkin`
     - `/staff/rooms`
     - `/staff/notice-board`
     - `/staff/settings`
   - Kept role-management pages admin-only.

5. **Sidebar alignment**
   - Updated `AppSidebar.tsx` staff menu to point to new staff-prefixed operational routes.

6. **Bug fix**
   - Fixed `Staff.tsx` missing `Users` icon import (render/build stability issue).

### Staff Role Audit Logging (2026-03-02)

Added dedicated role-change audit logging for staff assignment/revocation.

**What changed:**

1. **New migration: `20260302_staff_role_audit_log.sql`**
   - Added helper function `log_role_change_audit(...)` to write into `admin_audit_logs`.
   - Upgraded RPC `promote_member_to_staff` to emit audit event:
     - action: `role_change`
     - entity: `users`
     - old/new role payload in JSON
     - actor + gym scoping
   - Upgraded RPC `demote_staff_to_member` with same audit behavior.

2. **Audit payload format**
   - `old_value`: `{ "role": "<old_role>" }`
   - `new_value`: `{ "role": "<new_role>" }`
   - `reason`: explicit operation reason string

3. **GMS visibility panel**
   - Added admin-only "Role Changes Audit" panel in `GymzGymsGMS/src/pages/Staff.tsx`.
   - Reads latest role-change events from `admin_audit_logs` scoped by `gym_id`.
   - Displays actor email, target user ID, old/new role, reason, and timestamp.
   - Includes manual refresh action.

### Multi-Gym Pricing SSOT Enforcement (2026-03-02)

Reworked pricing flow to eliminate hard-coded plan prices and require gym onboarding pricing (`gym_membership_plans`) as the single source of truth.

**What changed:**

1. **Dynamic plan sourcing in member flows**  
   - Mobile app (`SubscriptionPlansScreen`, `PaymentsScreen`) now fetches plans by `gym_id` from onboarding data.
   - Web member flow (`SubscriptionModal`, `MemberPayments`) now fetches gym-specific plans instead of static Day Pass/Basic/Couple/Family maps.

2. **Data integrity guardrails**  
   - If a gym has no valid configured plan tiers, UI now shows **"Pricing not available"** and blocks checkout.
   - Amount/description/duration on payment forms are now derived from selected onboarding plan and locked from manual override in subscription checkout paths.

3. **Plan card consolidation rule implemented**  
   - Every plan card now combines:
     - Dynamic gym price
     - Standard platform benefits (fixed across gyms)
     - Gym-specific inclusions from onboarding

4. **Schema + onboarding support for gym-specific tier inclusions**  
   - New migration: `20260302_add_custom_plan_inclusions.sql` adds `custom_inclusions TEXT[]` to `gym_membership_plans`.
   - OAC Step 4 Pricing now captures per-tier custom inclusions (one per line) and persists them.

5. **Discovery pricing behavior**  
   - Discovery plan previews now include platform benefits + gym-specific inclusions from onboarding data.
   - Empty/invalid pricing now surfaces an explicit pricing-unavailable state.

### Strict Sequential Onboarding Enforcement (2026-03-02)

Fixed a critical breach where users could reach AI Calibration without first selecting a Gym Path, and could potentially access the app without completed calibration data.

**Mandatory Flow Enforced:** Path Selection → Calibration → App Access

**Breaches Found & Fixed:**

1. **HealthMetrics accessible in pre-gym-mapping stack** — AppNavigator included HealthMetrics in the `!hasGymMapping` and `!hasValidMemberId` navigation stacks, allowing users to navigate there before completing path selection.

2. **HealthMetricsScreen had no self-guard** — The calibration screen did not verify that gym path selection and member ID assignment were complete before allowing data entry or save.

3. **PendingApprovalScreen used soft navigation** — Used `navigation.navigate()` instead of `navigation.reset()` and did not pass `isHardGate: true`, allowing back-button bypass.

4. **Database: `is_fully_onboarded()` existed but was UNUSED** — All feature table RLS policies only checked `has_valid_member_id()`, not calibration completeness (height, weight, age, gender, goal).

5. **Database: `20260305_neutral_onboarding_fix.sql` regression** — This migration undid member ID enforcement on `body_metrics`, `user_fitness_goals`, and `daily_calorie_summary`, reducing them to just `auth.uid() = user_id`.

**Fixes Applied:**

1. **AppNavigator.tsx** — Removed HealthMetrics from `!hasGymMapping` and `!hasValidMemberId` stacks. Calibration is ONLY accessible in the `!isCalibrated` stack (which requires gym mapping + member ID to be true).

2. **HealthMetricsScreen.tsx** — Added `useEffect` security gate that checks `hasGymMapping` and `hasValidMemberId` before rendering. Added save-time guard that blocks calibration data submission if prerequisites are missing.

3. **PendingApprovalScreen.tsx** — Changed navigation to use `navigation.reset()` with `isHardGate: true`, preventing back-button escape. Added `refreshUser()` call before navigation to ensure fresh state.

4. **New Migration: `20260302_enforce_full_onboarding_gate.sql`** — Upgraded ALL feature table RLS policies from `has_valid_member_id()` to `is_fully_onboarded()`. Hybrid enforcement on calibration tables (`body_metrics`, `user_fitness_goals`, `daily_calorie_summary`): INSERT/UPDATE use `has_valid_member_id()` (so calibration writes work), SELECT uses `is_fully_onboarded()` (so app data is blocked until complete).

**Files Modified:**

- `GymzApp/navigation/AppNavigator.tsx` — Removed HealthMetrics from pre-calibration stacks
- `GymzApp/screens/HealthMetricsScreen.tsx` — Added prerequisite security gates
- `GymzApp/screens/PendingApprovalScreen.tsx` — Hard navigation reset with isHardGate
- `GymzGymsGMS/supabase/migrations/20260302_enforce_full_onboarding_gate.sql` — Full onboarding RLS enforcement

**Security Layers (Defense-in-Depth):**

| Layer | Enforcement |
| ----- | ----------- |
| Navigator | Gate chain: Login → GymSelection → PendingApproval → HealthMetrics → Main |
| Screen (HealthMetrics) | Self-guard: blocks render + save if !hasGymMapping or !hasValidMemberId |
| Screen (Dashboard/EventHome) | Defense-in-depth redirects for all 3 conditions |
| Screen (PendingApproval) | Hard reset navigation with isHardGate |
| Database (Feature tables) | `is_fully_onboarded()` RLS — blocks ALL reads/writes |
| Database (Calibration tables) | Hybrid: `has_valid_member_id()` for writes, `is_fully_onboarded()` for reads |

### Gym Mapping Security Hardening (2026-03-01)

Fixed a critical security flaw where new users could bypass gym onboarding and enter the app directly after email confirmation.

**Root Cause:** `AppNavigator.tsx` only checked for `isCalibrated` before allowing access to `Main`. It did NOT enforce that users must complete gym selection (`gymId`) and access mode (`accessMode`) first. This allowed authenticated users to skip the onboarding flow entirely, which also broke ID creation.

**Fix:** Implemented defense-in-depth security measures:

1. **Hard Navigation Gate** (`AppNavigator.tsx`):
   - Added `hasGymMapping` check: users MUST have both `gymId` AND `accessMode`
   - Strict routing priority: Login → GymSelection → HealthMetrics → Main
   - Added dedicated "gym mapping gate" stack for unmapped users

2. **Screen-Level Security Guards** (`DashboardScreen.tsx`, `EventHomeScreen.tsx`):
   - Added `useEffect` guards that redirect to correct onboarding step
   - Catches edge cases: stale sessions, deep links, navigation bugs
   - Uses `navigation.reset()` to prevent back-navigation bypass

3. **Auth State Logging** (`useAuth.tsx`):
   - Added `hasGymMapping` and `isFullyOnboarded` computed flags
   - Security state logging for debugging bypass attempts

**Files Modified:**

- `GymzApp/navigation/AppNavigator.tsx` - Hard navigation gate
- `GymzApp/screens/DashboardScreen.tsx` - Defense-in-depth guard
- `GymzApp/screens/EventHomeScreen.tsx` - Defense-in-depth guard
- `GymzApp/hooks/useAuth.tsx` - Security flags and logging

### OAC Profile Completeness Always 0% Fix (2026-03-01)

Fixed a critical bug where the gym onboarding wizard (OAC) always showed 0% profile completeness even after all steps were completed and files were uploaded.

**Root Cause:** The `table_onboarding_gym_isolation` RLS policy (from `20260225_harden_gym_isolation.sql`) uses `is_gym_admin()`, which only allows `role IN ('admin', 'super_admin')`. Gym owners in the OAC have `role = 'owner'`, so they were blocked from reading their own `gym_onboarding_status` row. This caused `gymOnboardingStatus` to return empty, and `completenessScore` fell back to `?? 0`.

**Fix:** Created `20260301_fix_oac_completeness_score_rls.sql` which:

1. Expanded `is_gym_admin()` to include the `'owner'` role.
2. Added a plain `gym_id`-match SELECT policy so gym owners can always read their own onboarding status regardless of role.
3. Backfilled all existing gyms to correct any stuck 0% scores.

**Files Modified:**

- `GymzGymsGMS/supabase/migrations/20260301_fix_oac_completeness_score_rls.sql` (new)

### Event QR Code Format Fix (2026-02-28)

Fixed a critical bug where event member QR codes were not working. The issue was a format mismatch - the displayed QR code was only showing the raw token, but the scanner expected a formatted string with the event ID included.

**Change:** Modified `EventDetailScreen.tsx` to generate QR codes in the correct format: `"gymz_event_checkin:{event_id}:{qr_token}"`

## Current Work Focus

Full sequential onboarding enforcement is now complete at all layers: Navigator, Screen, and Database.

### AI Calibration After Approval Only (2026-03-02)

Enforced mandatory flow: Path Selection → Payment → Pending Approval → Admin Approval → AI Calibration → App Access.

**Rule:** Payment submission ≠ approval. No user may perform AI Calibration until admin-approved. Calibration is a post-approval requirement, not a pre-approval step.

**Changes:**

1. **useAuth.tsx** — Added `isApprovedForCalibration`: event_access always true; gym_access only when `membershipStatus` is `'Active'` or `'approved'`.
2. **AppNavigator.tsx** — Approval gate: `!hasValidMemberId || !isApprovedForCalibration` blocks access to HealthMetrics stack. Approval gate initial route: SubscriptionPlans if not yet paid, PendingApproval if paid and pending.
3. **HealthMetricsScreen.tsx** — Defense-in-depth: redirects to PendingApproval if `!isApprovedForCalibration`.
4. **PendingApprovalScreen.tsx** — On approval: issues member ID, calls `refreshUser()`; gate chain re-evaluates and routes to HealthMetrics (no manual `navigation.reset` to HealthMetrics).
5. **SubscriptionPlansScreen.tsx** — After payment: navigates to PendingApproval (unchanged).

### Pricing Scope Lockdown (2026-03-02)

Started strict enforcement for pricing visibility scope: `Selected Gym -> Selected Path -> Gym Configured Plans`.

**What changed:**

1. Added plan path scope schema support:
   - New migration: `20260302_add_plan_access_scope.sql`
   - Adds `gym_membership_plans.access_mode_scope` with allowed values:
     - `gym_access`
     - `event_access`
     - `both`

2. Added backend payment guard for path scope:
   - New migration: `20260302_enforce_plan_scope_by_access_mode.sql`
   - Upgrades `enforce_onboarding_plan_payment()` to reject `plan_id` if:
     - plan gym != user gym
     - plan scope not compatible with user `access_mode`

3. Added path-scoped plan filtering in clients:
   - `GymzApp/services/pricingPlans.ts`
   - `GymzGymsGMS/src/services/gymPricing.ts`
   - `GymzWebsite/src/services/gymPricing.ts`
   - Plan fetch functions now require both `gymId` and selected path context.
   - No selected path => no plan visibility.

4. Wired selected path through user flows:
   - `AccessModeSelectionScreen` now passes access mode into subscription route.
   - Mobile/web subscription and payment screens now request plans with `(gymId, accessMode)`.
   - Discovery modal plan preview now filters by selected path and blocks checkout when out-of-scope.

5. OAC plan configuration updated:

   - `OAC/src/pages/wizard/steps/Step4Pricing.tsx` now captures `accessModeScope` per plan.
   - Each tier can be configured for Gym Access, Event Access, or Both.

## Next Steps

- Apply the `20260302_enforce_full_onboarding_gate.sql` migration to the Supabase project
- Test full signup flow: new user → gym selection → access mode → member ID → calibration → app
- Verify that direct API calls without calibration data are blocked by RLS
- Test edge cases: stale sessions, deep links, back-button navigation

## Active Decisions

- Calibration tables (body_metrics, user_fitness_goals, daily_calorie_summary) use hybrid RLS: writes allowed with member ID (for calibration step), reads blocked until fully onboarded. This is necessary because the calibration screen writes to these tables before the user is "fully onboarded".
