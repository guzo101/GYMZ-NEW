# Pre-App Flow: Logout & Back Navigation Architecture

## A. Flow Map

| # | Screen | Route | Allowed Back Destination | Logout Available | Logout Behavior |
| --- | --- | --- | --- | --- | --- |
| 1 | Login | Login | N/A (first step) | No | N/A — Back = exit app or no-op |
| 2 | Signup | Signup | Login | No | N/A — Back goes to Login |
| 3 | Gym Discovery | GymSelection | Login (if logged in) or Signup (if guest) | Yes (when logged in) | Exit to Sign In |
| 4 | Access Mode | AccessModeSelection | GymSelection | Yes | Exit to Sign In |
| 5 | Email Verification | EmailVerification | Signup | No | Back goes to Signup |
| 6 | Reset Password | ResetPassword | Login | No | Back goes to Login |
| 7 | Subscription Plans | SubscriptionPlans | AccessModeSelection | Yes | Exit to Sign In |
| 8 | Access Gate | AccessGate | GymSelection (via "Choose gym again") | Yes | Exit to Sign In |
| 9 | AI Calibration | HealthMetrics | AccessGate or SubscriptionPlans | Yes | Exit to Sign In |
| 10 | Settings | Settings | Previous screen | Yes | Exit to Sign In |
| 11 | Help Center | HelpCenter | Previous screen | Yes | Exit to Sign In |
| 12 | Privacy Policy | PrivacyPolicy | Previous screen | Yes | Exit to Sign In |
| 13 | Terms of Service | TermsOfService | Previous screen | Yes | Exit to Sign In |

**Back rules:**

- First step in flow (Login when !user, GymSelection when user): Back = Logout (Exit to Sign In)
- All other steps: Back = goBack() to previous screen
- If goBack() would land on invalid state, Back = Logout

## B. New Logout Architecture

**Single module:** `services/logoutService.ts`

**Responsibilities:**

1. Clear Supabase auth session
2. Clear AsyncStorage: auth_user, auth_expiry, sb-*, auth-token, Gymz_*, profile_data_*, dashboard_data_*
3. Clear web localStorage sb-* (web platform)
4. Notify AuthProvider to set user=null, currentGym=null
5. Realtime listeners auto-cleanup when user?.id becomes null (useEffect in useAuth)

**Entry point:** `logoutService.performLogout(setUser, setCurrentGym)` — called only from useAuth.

**Screens:** Call `logout()` from useAuth. No screen implements its own logout logic.

## C. Navigation Reset Rules

- On logout: Stack.Navigator uses `key={user ? 'authenticated' : 'unauthenticated'}` — forces full remount when user becomes null
- Remounted stack has `initialRouteName="Login"`
- Back gesture / hardware back after logout: Stack is fresh, no history — back does nothing or exits
- Android BackHandler: On pre-app screens, intercept back; if canGoBack() then goBack(), else logout

## D. Back Navigation Rules

- Each screen uses `usePreAppBack()` hook which returns `{ onBack }`
- `onBack`: if `navigation.canGoBack()` then `navigation.goBack()`, else `logout()`
- First-step screens (Login, GymSelection as entry): Back = logout
- AccessGate "Choose gym again": explicit replace('GymSelection') — not back

## E. QA Test Plan

- [ ] Back works on every pre-app screen
- [ ] Logout works on every pre-app screen that has it (GymSelection, AccessModeSelection, AccessGate, SubscriptionPlans, HealthMetrics, Settings)
- [ ] Back gesture does not bypass logout reset
- [ ] Android hardware back: correct behavior on each screen (goBack or logout)
- [ ] After logout, user cannot return to pre-app screens (Stack remounts with Login)
- [ ] After logout and login, flow starts from correct point
- [ ] No duplicate logout logic in any screen
- [ ] ProfileScreen and SettingsScreen logout (from main app) still works

## F. Files Modified/Created

**Created:**

- `services/logoutService.ts` — centralized logout
- `hooks/usePreAppBack.ts` — back navigation hook (for screens that need it)
- `docs/PRE_APP_FLOW_LOGOUT_ARCHITECTURE.md` — this doc

**Modified:**

- `hooks/useAuth.tsx` — logout delegates to logoutService
- `navigation/AppNavigator.tsx` — navigationRef, Android BackHandler
- `screens/GymSelectionScreen.tsx` — simplified Back to Sign In
- `screens/AccessModeSelectionScreen.tsx` — logout only
- `screens/AccessGateScreen.tsx` — logout only
- `screens/SubscriptionPlansScreen.tsx` — logout only
- `screens/HealthMetricsScreen.tsx` — logout only

**Unchanged (already use logout correctly):**

- `screens/ProfileScreen.tsx` — calls logout()
- `screens/SettingsScreen.tsx` — calls logout()
- `screens/DashboardScreen.tsx` — OverdueStatusModal calls logout()
