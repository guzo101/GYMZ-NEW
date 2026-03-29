# Gymz – Play Store Readiness Report

**Generated:** March 4, 2025  
**App:** Gymz (com.gym.memberapp)  
**Platform:** Expo / React Native (Android)

---

## Executive Summary

The app is a gym membership app with check-in, nutrition logging, events, payments, and AI chat. It uses Supabase for backend, expo-camera for QR scanning, expo-sensors for step counting, and several other features. **Several issues must be fixed before a successful Play Store listing.**

---

## Critical Issues (Must Fix)

### 1. **Excessive & Unused Permissions**

The app declares many permissions that are **not used** or come from libraries by default. Google Play rejects apps that request permissions without clear, in-app use.

| Permission | Status | Action |
|------------|--------|--------|
| `RECORD_AUDIO` | **UNUSED** | App uses camera for QR scanning and food photos only—no video/audio recording. Remove via expo-camera and expo-image-picker config. |
| `ACCESS_FINE_LOCATION` | **UNUSED** | "Location Check-in" uses `{ latitude: 0, longitude: 0 }`—no real GPS. Remove from app.json. |
| `ACCESS_COARSE_LOCATION` | **UNUSED** | Same as above. Remove. |
| `READ_CALENDAR` | **UNUSED** | App uses Supabase calendar data, not device calendar. Remove. |
| `WRITE_CALENDAR` | **UNUSED** | Same as above. Remove. |
| `ACTIVITY_RECOGNITION` | **USED** | Pedometer (step counting) in `useSteps.ts`, `useStepCounter.ts`. Keep—but you must complete the **Permissions Declaration Form** in Play Console and provide a video showing step counting. |

**Fix:** Remove unused permissions from `app.json` and configure expo-camera/expo-image-picker to not add RECORD_AUDIO.

---

### 2. **Privacy Policy & Data Safety**

Google Play **requires**:

- A **privacy policy URL** (publicly accessible)
- A completed **Data safety** section in Play Console

**Current status:** No privacy policy file or URL found in the project.

**Data collected (from code review):**

- **Account data:** Email, name, profile (Supabase Auth)
- **Health/fitness:** Weight, goals, nutrition logs, step count, workout sessions
- **Location:** Not actually used (placeholder)
- **Photos:** Food images for nutrition logging (Supabase Storage)
- **Payment:** Payment records (Supabase)
- **Device:** Push notification tokens

**Action:** Create a privacy policy and host it (e.g. your website or GitHub Pages). Declare all data types in the Data safety section.

---

### 3. **Build Scripts**

**`package.json`:**

```json
"build:apk": "eas-cli build --platform android --profile preview",
"build:android": "eas-cli build --platform android --profile preview"
```

**Issue:** `eas-cli` is not a standard package. Use `eas` or `npx eas build`.

**Fix:** Change to:

```json
"build:apk": "eas build --platform android --profile preview",
"build:android": "eas build --platform android --profile production"
```

Ensure `eas` is installed: `npm install -g eas-cli` (the CLI package is `eas-cli`, but the command is `eas`).

---

### 4. **Production Build Profile**

For Play Store, you must submit an **AAB (Android App Bundle)**, not APK.

**Current `eas.json`:** Production profile correctly uses `app-bundle`.

**Submit config:** Currently set to `"track": "internal"`. For public release, use `"track": "production"` (or remove to use default).

---

### 5. **Sensitive Permissions Declaration (ACTIVITY_RECOGNITION)**

`ACTIVITY_RECOGNITION` (used by Pedometer for step counting) is a **sensitive permission**. Google requires:

1. **Permissions Declaration Form** in Play Console
2. **Video demonstration** of the feature
3. **Review instructions** for the review team

**Action:** Prepare a short video showing step counting in the app and document how reviewers can test it.

---

### 6. **SYSTEM_ALERT_WINDOW in Manifest**

`android/app/src/main/AndroidManifest.xml` includes:

```xml
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
```

**Issue:** This is a special permission (overlay/draw over other apps). If not used, it can trigger review questions.

**Action:** Confirm if any feature needs overlay (e.g. floating UI). If not, remove it (may come from a dependency—check which plugin adds it).

---

## Medium Priority

### 7. **Supabase Credentials**

`services/supabase.ts` has hardcoded URL and anon key. The anon key is intended for client use, but:

- Prefer environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) for different environments
- Ensure Supabase RLS and security rules are correctly configured

---

### 8. **Store Listing Assets**

You will need:

| Asset | Requirement |
|-------|-------------|
| App icon | 512×512 px (PNG, 32-bit) |
| Feature graphic | 1024×500 px |
| Screenshots | At least 2 (phone), 7" and 10" for tablets if supported |
| Short description | Max 80 characters |
| Full description | Max 4000 characters |

---

### 9. **Content Rating**

Complete the **Content rating** questionnaire in Play Console. For a fitness/gym app with payments and optional AI chat, it will likely be **Everyone** or **Teen**, but the questionnaire determines the final rating.

---

### 10. **Target SDK**

- **Current:** targetSdkVersion 35 (Android 15) ✅  
- **minSdkVersion:** 26 (Android 8.0) ✅  

Meets current Play Store requirements.

---

## Checklist Before Submission

- [x] Remove unused permissions (RECORD_AUDIO, location, calendar) — **DONE**
- [x] Configure expo-camera: `recordAudioAndroid: false` — **DONE**
- [x] Add expo-image-picker plugin with `microphonePermission: false` — **DONE**
- [x] Fix build scripts (eas vs eas-cli) — **DONE**
- [x] Block SYSTEM_ALERT_WINDOW via `android.blockedPermissions` — **DONE**
- [x] Regenerate android with `npx expo prebuild --platform android --clean` — **DONE**
- [ ] Create and publish privacy policy
- [ ] Complete Data safety section in Play Console
- [ ] Complete Permissions Declaration Form for ACTIVITY_RECOGNITION
- [ ] Prepare video + instructions for step-counting feature
- [ ] Prepare store assets (icon, feature graphic, screenshots)
- [ ] Complete Content rating questionnaire
- [ ] Provide demo account credentials for review
- [ ] Test production build: `npm run build:android` or `npx eas build --platform android --profile production`

---

## App Overview (from code review)

| Feature | Implementation |
|---------|----------------|
| Auth | Supabase Auth (email/password, invite flow) |
| Check-in | QR scan (expo-camera), placeholder location check-in |
| Nutrition | Food scanner (camera + AI), barcode, manual logging |
| Steps | expo-sensors Pedometer |
| Calendar | Supabase (gym classes, events)—not device calendar |
| Payments | Supabase + payment integration |
| Notifications | expo-notifications |
| AI Chat | Supabase-backed chat |
| Community | Notice board, reactions, chat |

---

## Recommended Next Steps

1. **Immediate:** Remove unused permissions and add `recordAudioAndroid: false` to expo-camera.
2. **Before first submission:** Create privacy policy, complete Data safety, fix build scripts.
3. **For ACTIVITY_RECOGNITION:** Complete declaration form and prepare demo video.
4. **Final:** Run `eas build --platform android --profile production` and test the AAB before upload.
