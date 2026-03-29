# Gymz – Google Play Release Readiness Audit Report

<!-- markdownlint-disable MD060 MD013 MD022 MD032 MD034 MD009 -->

**Audit Date:** March 4, 2025  
**App:** Gymz (com.gym.memberapp)  
**Platform:** Expo React Native 54 + TypeScript + Supabase  
**Auditor:** Line-by-line repository scan (no assumptions)

---

## Key Files Scanned

| Category | Files |
|----------|-------|
| **Config** | `Gymz/app.json`, `Gymz/eas.json`, `Gymz/package.json` |
| **Android** | `Gymz/android/app/build.gradle`, `Gymz/android/gradle.properties`, `Gymz/android/app/src/main/AndroidManifest.xml` |
| **Supabase** | `Gymz/services/supabase.ts` |
| **Auth** | `Gymz/hooks/useAuth.tsx`, `Gymz/services/logoutService.ts` |
| **Settings** | `Gymz/screens/SettingsScreen.tsx`, `Gymz/screens/EditProfileScreen.tsx` |
| **Payments** | `Gymz/services/pesapal.ts`, `Gymz/services/clicknpay.ts` |
| **Privacy** | `Gymz/screens/PrivacyPolicyScreen.tsx`, `Gymz/docs/DATA_INVENTORY.md` |
| **App shell** | `Gymz/App.tsx`, `Gymz/navigation/AppNavigator.tsx`, `Gymz/components/ErrorBoundary.tsx` |

---

## Executive Summary

| Verdict              | **PARTIAL** |
|----------------------|-------------|
| **Critical Blockers** | 3           |
| **Medium Issues**     | 6           |
| **Minor Issues**      | 4           |

The app has solid Android build configuration and core architecture, but **account deletion is missing** (required by Google for apps with accounts), **debug code remains in production paths**, and **privacy policy URL is not configured**. These must be addressed before submission.

---

## 1. Android Build Compliance

### Values Found

| Property | Value | Source |
|----------|-------|--------|
| minSdkVersion | **26** | app.json, gradle.properties, build.gradle |
| targetSdkVersion | **35** | app.json, gradle.properties, build.gradle |
| compileSdkVersion | **35** | app.json, gradle.properties, build.gradle |
| buildToolsVersion | 35.0.0 | app.json, gradle.properties |

### Evidence (Files + Lines)

| File | Lines | Content |
|------|-------|---------|
| `Gymz/app.json` | 54–58 | `expo-build-properties` plugin: `minSdkVersion: 26`, `compileSdkVersion: 35`, `targetSdkVersion: 35` |
| `Gymz/android/gradle.properties` | 66–69 | `android.minSdkVersion=26`, `android.compileSdkVersion=35`, `android.targetSdkVersion=35` |
| `Gymz/android/app/build.gradle` | 87–94 | `compileSdk rootProject.ext.compileSdkVersion`, `minSdkVersion rootProject.ext.minSdkVersion`, `targetSdkVersion rootProject.ext.targetSdkVersion` |

### Release Artifact Type

| Profile | Build Type | File |
|---------|------------|------|
| production | **app-bundle** | `Gymz/eas.json` lines 19–23 |
| preview | apk | `Gymz/eas.json` lines 14–17 |
| development | apk | `Gymz/eas.json` lines 7–12 |

**Result:** ✅ **PASS** – Android 8+ (API 26) supported, Android 15 targeted, production uses AAB.

---

## 2. App Identity and Store Consistency

### Package Name
- **com.gym.memberapp**  
- Defined in: `app.json` (line 21), `android/app/build.gradle` (lines 90–91), `AndroidManifest` namespace

### Versioning

| Property | Value | Location |
|----------|-------|----------|
| versionName | 1.0.0 | `app.json` line 6, `package.json` line 3, `android/app/build.gradle` line 96 |
| versionCode | 1 | `android/app/build.gradle` line 95 |

**VersionCode increment:** `versionCode` is hardcoded in `android/app/build.gradle`. It is **not** auto-incremented by Expo. Manual increment required for each release. See `docs/PLAY_STORE_RELEASE.md` line 79.

### App Name Consistency
- **app.json** line 3: `"name": "Gymz"` ✅
- **package.json** line 2: `"name": "gymz"` (lowercase, npm convention)
- **UI strings:** "Gymz", "Gymz Coach", "Gymz Intelligence", "Gymz Fitness", "Gymz Smart Coach" – branding variations, acceptable
- **support@Gymzfitness.com** (HelpCenterScreen line 39) vs **support@gymz.app** (termsAndConditions line 44) – **inconsistent contact emails**

### Leftover Names
- None found that conflict with "Gymz" as the store name.

---

## 3. Permissions and Sensitive Access

### Permissions (from AndroidManifest.xml)

| Permission | Status | Usage |
|------------|--------|-------|
| `ACTIVITY_RECOGNITION` | ✅ Used | `hooks/useSteps.ts`, `hooks/useStepCounter.ts`, `DashboardScreen.tsx` – Pedometer step counting |
| `CAMERA` | ✅ Used | QR check-in, barcode scanner, food scanner |
| `INTERNET` | ✅ Used | Supabase, payments, APIs |
| `NOTIFICATIONS` | ✅ Used | `expo-notifications`, push tokens |
| `READ_MEDIA_IMAGES` | ✅ Used | `expo-image-picker` – profile, community posts |
| `READ_EXTERNAL_STORAGE` | Legacy | May be used by image picker on older Android |
| `WRITE_EXTERNAL_STORAGE` | Legacy | May be used by image picker on older Android |
| `READ_MEDIA_AUDIO` | ⚠️ | From expo-image-picker – verify if needed |
| `READ_MEDIA_VIDEO` | ⚠️ | From expo-image-picker – verify if needed |
| `READ_MEDIA_VISUAL_USER_SELECTED` | ⚠️ | Partial media access – verify if needed |
| `VIBRATE` | ✅ Used | Haptics |

### Blocked Permissions (app.json)

- `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `READ_CALENDAR`, `WRITE_CALENDAR`, `SYSTEM_ALERT_WINDOW`  
- Manifest uses `tools:node="remove"` for location, calendar, RECORD_AUDIO, SYSTEM_ALERT_WINDOW.

### Permissions Declaration Form

`ACTIVITY_RECOGNITION` is a sensitive permission. Google requires:
1. Permissions Declaration Form in Play Console
2. Video showing step-counting feature
3. Instructions for reviewers

**Recommendation:** Keep ACTIVITY_RECOGNITION. Document step-counting flow and prepare demo video.

---

## 4. Privacy and Data Safety (Supabase)

### Data Inventory

| Data Type | Collected | Where | Storage | Transmitted |
|-----------|------------|-------|---------|-------------|
| Email | Yes | Login, Signup | Supabase Auth + `users` | HTTPS |
| Name | Yes | Signup, EditProfile | `users` | HTTPS |
| Phone | Yes | Payments, profile | `users`, `payments` | HTTPS |
| Photos | Yes | Profile, community, nutrition | Supabase Storage | HTTPS |
| Weight | Yes | HealthMetrics, profile | `users`, body metrics | HTTPS |
| BMI | Yes | Calculated | Derived | N/A |
| Meal logs | Yes | NutritionScreen | `daily_nutrition_logs` | HTTPS |
| Workout logs | Yes | Dashboard, progress | `workout_sessions` | HTTPS |
| Push token | Yes | pushTokenService | `push_tokens` | HTTPS |
| Payment records | Yes | PaymentsScreen | `payments` | HTTPS |
| Location | **No** | Not used | N/A | N/A |

### Data Safety Form Mismatch

`docs/DATA_INVENTORY.md` (lines 17–18, 41–42, 69, 85–86) states:
- Precise location: Yes (gym check-in, nearby gyms)
- Approximate location: Yes (gym discovery)

**Evidence:** The app **blocks** location permissions (`app.json` lines 39–40, `AndroidManifest.xml` lines 2–3 with `tools:node="remove"`).  
`AttendanceScreen.tsx` line 161: `checkIn({ userId, location: { latitude: 0, longitude: 0 } })` – placeholder only.

**Action:** Update Data Safety form to reflect that **location is NOT collected**. Do not declare location unless you plan to enable it.

### Third-Party SDKs

- **Supabase** – backend, auth, storage, realtime
- **Expo** – push, camera, image picker, sensors
- **OpenAI** – food AI (API key from `ai_settings` table, not client-side)
- **Pesapal** – payments (Zambia)
- **ClicknPay** – payments (Africa)
- **exchangerate.host** – ZMW/USD rates

### Network Security

- Supabase: `https://bivgvttxaymcdnuvyugv.supabase.co` ✅
- Pesapal: `https://cybqa.pesapal.com` ✅
- ClicknPay: `https://backendservices.clicknpay.africa:2081` ✅
- **Exception:** `http://127.0.0.1:7816` in `useAuth.tsx` and `DashboardScreen.tsx` – debug analytics, localhost only. **Remove before production.**

---

## 5. Account Deletion and User Controls

### Deletion Path Existence

**NOT FOUND.** `SettingsScreen.tsx` does not include an account deletion option.

| File | Lines | Content |
|------|-------|---------|
| `Gymz/screens/SettingsScreen.tsx` | 215–234 | Account section: Edit Profile, Privacy & Security, Subscription & Billing – **no Delete account** |
| `Gymz/screens/SettingsScreen.tsx` | 250–257 | Logout button only |

### Documentation vs Implementation

- `docs/DATA_INVENTORY.md` line 94: "Add 'Delete account' in Settings → Account"
- `docs/PLAY_STORE_RELEASE.md` line 88: "Account deletion path (in-app or documented)"
- `PrivacyPolicyScreen.tsx` line 44: "You can request... deletion of your account... by contacting our support team or using the setting in the Edit Profile section"

**Edit Profile section:** No delete account option found in `EditProfileScreen.tsx`.

### Risk Assessment

**CRITICAL:** Google Play requires account deletion for apps that allow account creation. See [User Data policy](https://support.google.com/googleplay/android-developer/answer/13392821).

**Required:**
1. Add "Delete account" in Settings → Account.
2. On delete: remove Supabase Auth user, `users` row, related profile/logs/subscriptions, storage objects.
3. Or document external process (email support) with clear steps and response time.

---

## 6. Payments and Subscriptions Compliance

### Monetization Detection

- **Pesapal** – `services/pesapal.ts` (sandbox: `cybqa.pesapal.com`)
- **ClicknPay** – `services/clicknpay.ts`
- **PaymentsScreen** – subscription plans, payment flow
- **SubscriptionPlansScreen** – plan selection

### Nature of Goods

- Gym membership subscriptions (physical access)
- Payments are for **physical goods/services** (gym access), not in-app digital content.

### Google Play Billing

- **Not required** for physical goods/services.
- External payment (Pesapal, ClicknPay) is acceptable for this use case.

### Compliance Status

✅ **PASS** – No in-app digital goods; external payment for physical services is allowed.

### Remediation

- Ensure Pesapal/ClicknPay credentials are not hardcoded (see Security section).
- Ensure `pesapal.ts` uses production URL when going live.

---

## 7. Security Basics

### Hardcoded Secrets

| File | Line | Content | Risk |
|------|------|---------|------|
| `services/supabase.ts` | 7–8 | Supabase URL + anon key | Medium – anon key is intended for client use; prefer env vars |
| `hooks/useAuth.tsx` | 41, 154 | `fetch('http://127.0.0.1:7816/ingest/...')` | Debug – remove for production |
| `screens/DashboardScreen.tsx` | 529 | Same debug fetch | Debug – remove for production |
| `services/pesapal.ts` | 9–10 | `CONSUMER_KEY`, `CONSUMER_SECRET` = "REDACTED_USE_ENVIRONMENT_VARIABLE" | Placeholder – must use env vars in prod |
| `services/clicknpay.ts` | 7 | `API_KEY = ""` | Empty – must be configured |

### Dev Scripts (Not in App Bundle)

- `check_policies_snapshots.js` line 4: **Hardcoded `SUPABASE_SERVICE_KEY` (service_role)** – CRITICAL. Key is in repo.
- `check_rows.js` lines 4–5: Uses anon key (publishable) – lower risk.
- **Action:** Exclude dev scripts from build via `.easignore`; move service_role to env vars; ensure scripts are not shipped. Rotate the exposed service_role key.

### Environment Variables

- Supabase: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` – **not used**; values are hardcoded.
- `eas.json` production env: `EXPO_PUBLIC_BUILD_ENV: "production"` only.

### Fixes Required

1. Remove debug `fetch('http://127.0.0.1:7816/...')` from `useAuth.tsx` and `DashboardScreen.tsx`.
2. Move Supabase config to env vars (e.g. `EXPO_PUBLIC_SUPABASE_URL`).
3. Ensure Pesapal/ClicknPay credentials come from env or secure backend.

---

## 8. App Stability and UX Blockers

### Error Handling

- **ErrorBoundary:** `App.tsx` line 166 – wraps entire app ✅
- **ErrorBoundary:** `components/ErrorBoundary.tsx` – fallback UI with "Try Again" ✅

### Crash Risks

| Risk | Location | Notes |
|------|----------|-------|
| `user?.id` undefined | Multiple screens | `useAuth` provides user; null checks exist in most paths |
| Unhandled promise rejections | Various | Many `fetch`/`supabase` calls have `.catch()` |
| RPC failures | ProfileScreen, DashboardScreen | Fallbacks to basic fetch when RPC fails |

### Navigation

- All `Stack.Screen` references in `AppNavigator.tsx` point to existing screens.
- No dead routes found.

### Empty States

- **NOT VERIFIED** – No systematic scan of empty-state handling. Recommend manual review of: Dashboard, Nutrition, Events, Payments, Profile.

### Network Failure Handling

- `LoginScreen.tsx` lines 146–161: Connectivity check; does not block login on failure.
- `useAuth.tsx` lines 203–212: Session fetch timeout with cache fallback.

---

## 9. Release Verification Steps

### Required Commands

```bash
# 1. EAS Build (production AAB)
cd Gymz
npx eas build --platform android --profile production

# 2. Download AAB from EAS dashboard
# 3. Install on device (internal testing or internal track)
eas build:run --platform android --profile production
# or: adb install <path-to-aab> (requires bundletool for AAB)

# 4. Verify permissions behavior
# - Open app → Settings → Permissions
# - Grant Camera when prompted for QR/barcode
# - Grant Notifications when prompted
# - Grant ACTIVITY_RECOGNITION when prompted for step counting
# - Confirm no location/calendar prompts

# 5. Verify auth flows
# - Sign up → Email verification → Login
# - Password reset
# - Logout

# 6. Verify account deletion
# NOT IMPLEMENTED – must add before testing

# 7. Verify offline behavior
# - Turn off network → Open app
# - Confirm no crash; cached data or graceful degradation
```

### Pre-Build Checklist

```bash
# Lint and type-check
npm run check-project

# Clean build (if using native android)
cd android && ./gradlew clean && cd ..
```

---

## 10. Issues Sorted by Category (Fix Order)

Grouped so you can tackle them one by one. **Start with Group A (App Code – Critical).**

### Group A: App Code – Critical (Must fix first)

| # | Issue | Files to Edit | What to Do |
|---|-------|---------------|------------|
| A1 | Remove debug analytics | `hooks/useAuth.tsx` (lines 41, 154), `screens/DashboardScreen.tsx` (line 529) | Delete the 3 `fetch('http://127.0.0.1:7816/...')` calls |
| A2 | Add account deletion | `screens/SettingsScreen.tsx`, new service (e.g. `services/accountDeletionService.ts`) | Add "Delete account" in Account section; implement Auth + DB + storage deletion |
| A3 | Update Privacy Policy text | `screens/PrivacyPolicyScreen.tsx` (line 44) | Fix "Edit Profile" deletion claim – either add delete there or change copy to match reality |

### Group B: App Code – Medium

| # | Issue | Files to Edit | What to Do |
|---|-------|---------------|------------|
| B1 | Use env vars for Supabase | `services/supabase.ts` (lines 7–8) | Replace hardcoded URL/key with `process.env.EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| B2 | Unify support email | `screens/HelpCenterScreen.tsx` (line 39), `constants/termsAndConditions.ts` (line 44) | Pick one: `support@gymz.app` or `support@Gymzfitness.com` and use everywhere |
| B3 | Update build version text | `screens/SettingsScreen.tsx` (line 259) | Change "Build 2024.12.25" to match actual build date |

### Group C: Config & Repo (Not in app bundle)

| # | Issue | Files to Edit | What to Do |
|---|-------|---------------|------------|
| C1 | Rotate service_role key | Supabase Dashboard | Rotate key; update `check_policies_snapshots.js` to use `process.env.SUPABASE_SERVICE_ROLE_KEY` |
| C2 | Exclude dev scripts from EAS | `Gymz/.easignore` | Add `check_*.js`, `verify_*.js`, `fix_*.js`, `probe_*.js`, `list_*.js`, `inspect_*.js`, `diagnose_*.js`, `search_*.js`, `find_*.js`, `test_*.js`, `ensure_*.js` |
| C3 | Pesapal production URL | `services/pesapal.ts` (line 5) | When going live, switch from `cybqa.pesapal.com` to production Pesapal URL |
| C4 | Submit track for release | `eas.json` (line 32) | Change `"track": "internal"` to `"production"` when ready for public release |

### Group D: Play Console & External (Not in codebase)

| # | Issue | Where | What to Do |
|---|-------|-------|------------|
| D1 | Privacy policy URL | Play Console → App content → Privacy policy | Host policy at e.g. `https://gymz.co.zm/privacy` and add URL in Play Console |
| D2 | Data Safety form | Play Console → App content → Data safety | Declare location is **NOT** collected (remove if listed) |
| D3 | Permissions Declaration | Play Console → Policy → App permissions | Complete ACTIVITY_RECOGNITION form; upload demo video for step counting |
| D4 | versionCode | `android/app/build.gradle` (line 95) | Increment `versionCode` manually for each release |

### Group E: Docs & Nice-to-Have

| # | Issue | Files | What to Do |
|---|-------|-------|------------|
| E1 | DATA_INVENTORY.md location | `docs/DATA_INVENTORY.md` | Update: remove "Precise location: Yes", "Approximate location: Yes" |
| E2 | Privacy policy deletion wording | `screens/PrivacyPolicyScreen.tsx` | Update once in-app deletion exists (covered in A3) |
| E3 | Media permissions | Optional | Verify if READ_MEDIA_AUDIO, READ_MEDIA_VIDEO needed by image picker |

---

### Suggested Fix Order

1. **A1** – Quick win, removes debug code  
2. **A2** – Critical for Google Play  
3. **A3** – Align Privacy Policy with implementation  
4. **B1** – Move Supabase to env vars  
5. **B2** – Unify support email  
6. **C1 + C2** – Rotate key, exclude dev scripts  
7. **D1** – Publish privacy policy URL  
8. **D2** – Update Data Safety form  
9. **D3** – Permissions Declaration + video  
10. **B3, C3, C4, D4, E1** – Before final release  

---

## 11. Critical Blockers (Summary)

| # | Issue | Priority | Action |
|---|-------|----------|--------|
| 1 | **Account deletion missing** | Critical | Add "Delete account" in Settings → Account. Implement Supabase Auth + DB + storage deletion, or document external process. |
| 2 | **Privacy policy URL** | Critical | Create privacy policy URL (e.g. `https://gymz.co.zm/privacy`) and add to Play Console. |
| 3 | **Debug analytics in production** | Critical | Remove `fetch('http://127.0.0.1:7816/...')` from `useAuth.tsx` (lines 41, 154) and `DashboardScreen.tsx` (line 529). |

---

## 12. Medium Issues (Summary)

| # | Issue | Action |
|---|-------|--------|
| 1 | Data Safety form mismatch | Declare that location is NOT collected (remove from Data Safety if currently listed). |
| 2 | ACTIVITY_RECOGNITION declaration | Complete Permissions Declaration Form and prepare demo video for step counting. |
| 3 | Hardcoded Supabase config | Use `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in app config. |
| 4 | Inconsistent support emails | Unify: `support@gymz.app` (termsAndConditions.ts:44) vs `support@Gymzfitness.com` (HelpCenterScreen.tsx:39). |
| 5 | versionCode increment | Manual process; document in release checklist. |
| 6 | Service_role key in repo | `check_policies_snapshots.js` line 4 – rotate key, move to env, add to `.easignore`. |

---

## 13. Minor Issues (Summary)

| # | Issue |
|---|-------|
| 1 | READ_MEDIA_AUDIO, READ_MEDIA_VIDEO – verify if needed by image picker |
| 2 | Privacy policy mentions "Edit Profile" for deletion – update once in-app deletion exists |
| 3 | Settings version text: "Build 2024.12.25" – update to match build date |
| 4 | Submit track: `eas.json` uses `"track": "internal"` – change to `"production"` for public release |

---

## 14. Action Plan (Ordered)

1. **Remove debug fetch** – Delete `fetch('http://127.0.0.1:7816/...')` from `useAuth.tsx` and `DashboardScreen.tsx`.
2. **Implement account deletion** – Add in-app flow or document external process; update Privacy Policy.
3. **Publish privacy policy** – Host at public URL; add to Play Console.
4. **Update Data Safety** – Remove location from collected data if not used.
5. **Complete Permissions Declaration** – ACTIVITY_RECOGNITION form + demo video.
6. **Move to env vars** – Supabase URL/key; Pesapal/ClicknPay credentials.
7. **Rotate service_role key** – Exposed in `check_policies_snapshots.js`; add dev scripts to `.easignore`.
8. **Run production build** – `npx eas build --platform android --profile production`.
9. **Test AAB** – Install, verify auth, permissions, flows, and offline behavior.

---

## 15. Evidence Index

| Claim | Evidence |
|-------|----------|
| minSdk 26, targetSdk 35 | app.json:54–58, gradle.properties:66–69, build.gradle:93–94 |
| AAB for production | eas.json:19–23 |
| Package com.gym.memberapp | app.json:21, build.gradle:90–91 |
| versionCode 1 | build.gradle:95 |
| No account deletion | SettingsScreen.tsx:215–257 (no delete option) |
| Location blocked | app.json:39–40, AndroidManifest:2–3 |
| Location placeholder | AttendanceScreen.tsx:161 |
| Hardcoded Supabase | services/supabase.ts:7–8 |
| Debug fetch | useAuth.tsx:41,154; DashboardScreen.tsx:529 |
| Service_role in repo | check_policies_snapshots.js:4 |
| ErrorBoundary | App.tsx:166, components/ErrorBoundary.tsx |
| ACTIVITY_RECOGNITION usage | useSteps.ts, useStepCounter.ts, DashboardScreen:32,110 |
| Payments external | pesapal.ts, clicknpay.ts, PaymentsScreen |

---

*End of audit report.*
