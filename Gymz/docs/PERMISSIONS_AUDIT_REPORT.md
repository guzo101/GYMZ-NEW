# Gymz – Permissions Audit Report

<!-- markdownlint-disable MD013 -->

**Audit Date:** March 4, 2025  
**Purpose:** Google Play Data Safety & Permissions Declaration compliance  
**Principle:** Minimum necessary permissions

---

## Executive Summary

| Category | Count |
| ---------- | ------ |
| **Required permissions** | 8 |
| **Library-added (review)** | 3 |
| **Blocked (correct)** | 6 |
| **Unused** | 0 |

---

## 1. Required Permissions (Evidence-Based)

### 1.1 CAMERA

| Field | Value |
| ------- | ------- |
| **Permission** | `android.permission.CAMERA` |
| **Essential** | Yes |
| **Feature** | QR/barcode scanning for check-in and nutrition logging |

**Code locations:**

| File | Line | Usage |
| ------ | ------ | ------ |
| `screens/EventQRCheckInScreen.tsx` | 3, 170 | CameraView for event QR check-in |
| `screens/GymCheckInScannerScreen.tsx` | 3, 160 | CameraView for gym QR check-in |
| `screens/BarcodeScannerScreen.tsx` | 4, 77 | CameraView for barcode scan |
| `components/nutrition/FoodScanner.tsx` | 19, 609 | CameraView for food photo/barcode |
| `hooks/useCameraPermissions.ts` | 2, 17 | useCameraPermissions from expo-camera |

**Config:** `app.json` lines 29–30, 62–67 (expo-camera plugin, `recordAudioAndroid: false`)

---

### 1.2 NOTIFICATIONS

| Field | Value |
| ------- | ------- |
| **Permission** | `android.permission.POST_NOTIFICATIONS` (Android 13+) / `NOTIFICATIONS` |
| **Essential** | Yes |
| **Feature** | Push notifications for check-in reminders, meal reminders |

**Code locations:**

| File | Line | Usage |
| ------ | ------ | ------ |
| `App.tsx` | 10, 76, 83 | registerForPushNotifications() |
| `services/notifications.ts` | 15–46 | getPermissionsAsync, requestPermissionsAsync, getExpoPushTokenAsync |
| `services/nutritionNotificationService.ts` | 8, 26–27 | initNotifications, registerForPushNotifications |
| `screens/DashboardScreen.tsx` | 484 | nutritionNotificationService.initNotifications |
| `screens/SettingsScreen.tsx` | 84–85, 255–259 | Push Notifications toggle |

**Config:** `app.json` line 31, 78–83 (expo-notifications plugin)

---

### 1.3 ACTIVITY_RECOGNITION

| Field | Value |
| ------- | ------- |
| **Permission** | `android.permission.ACTIVITY_RECOGNITION` |
| **Essential** | Yes |
| **Feature** | Pedometer step counting on Dashboard |

**Code locations:**

| File | Line | Usage |
| ------ | ------ | ------ |
| `hooks/useSteps.ts` | 2, 26–27, 35, 42 | Pedometer.isAvailableAsync, getStepCountAsync, watchStepCount |
| `hooks/useStepCounter.ts` | 2, 21, 25, 33, 49 | Pedometer.requestPermissionsAsync, getStepCountAsync, watchStepCount |
| `screens/DashboardScreen.tsx` | 32, 110 | useSteps(user?.id) |
| `components/StepCounterCard.tsx` | 6, 12 | useStepCounter |

**Config:** `app.json` line 33

**Play Console:** Requires Permissions Declaration Form + demo video (see `docs/PLAY_CONSOLE_GROUP_D.md` D3).

---

### 1.4 READ_MEDIA_IMAGES

| Field | Value |
| ------- | ------- |
| **Permission** | `android.permission.READ_MEDIA_IMAGES` (Android 13+) |
| **Essential** | Yes |
| **Feature** | Pick images from gallery for profile, community posts, progress snapshots |

**Code locations:**

| File | Line | Usage |
| ------ | ------ | ------ |
| `screens/EditProfileScreen.tsx` | 104, 110–111 | requestMediaLibraryPermissionsAsync, launchImageLibraryAsync(MediaTypeOptions.Images) |
| `screens/CommunityChatScreen.tsx` | 217, 222–223 | Same – community photo posts |
| `components/dashboard/SnapshotsView.tsx` | 259, 266–267 | Same – progress snapshot upload |

**Config:** `app.json` line 34

---

### 1.5 READ_EXTERNAL_STORAGE / WRITE_EXTERNAL_STORAGE

| Field | Value |
| ------- | ------- |
| **Permissions** | `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` |
| **Essential** | Yes (legacy Android &lt; 13) |
| **Feature** | Read: image picker. Write: save comparison image to gallery |

**Code locations:**

| File | Line | Usage |
| ------ | ------ | ------ |
| `screens/EditProfileScreen.tsx` | 104 | ImagePicker reads from gallery |
| `screens/CommunityChatScreen.tsx` | 217 | ImagePicker reads from gallery |
| `components/dashboard/SnapshotsView.tsx` | 259, 380, 404 | ImagePicker read + **MediaLibrary.saveToLibraryAsync(uri)** (write) |

**Note:** On Android 13+, READ_MEDIA_IMAGES replaces READ. WRITE is still used by `expo-media-library` for `saveToLibraryAsync`. `requestLegacyExternalStorage="true"` in AndroidManifest supports older devices.

**Config:** `app.json` lines 35–36

---

### 1.6 VIBRATE

| Field | Value |
| ------- | ------- |
| **Permission** | `android.permission.VIBRATE` |
| **Essential** | Yes |
| **Feature** | Haptic feedback on interactions |

**Code locations:**

| File | Line | Usage |
| ------ | ------ | ------ |
| `services/hapticService.ts` | 14–68 | impactAsync, notificationAsync, selectionAsync |
| `screens/CommunityChatScreen.tsx` | 357 | Haptics.impactAsync |
| `components/dashboard/ComparisonSlider.tsx` | 100 | Haptics.impactAsync |
| `components/BottomTabBar.tsx` | 41 | Haptics.impactAsync |
| `components/nutrition/FoodScanner.tsx` | 232, 314, 392 | Haptics.notificationAsync, impactAsync |
| `components/nutrition/PlanOverview.tsx` | 43, 45 | Haptics.impactAsync |
| `components/nutrition/DailySummary.tsx` | 39 | Haptics.impactAsync |
| `contexts/NotificationBannerContext.tsx` | 41 | Vibration.vibrate |

**Config:** In AndroidManifest (expo-haptics / React Native)

---

### 1.7 INTERNET

| Field | Value |
| ------- | ------- |
| **Permission** | `android.permission.INTERNET` |
| **Essential** | Yes |
| **Feature** | Supabase, APIs, payments, push tokens |

**Evidence:** All network calls (Supabase, Pesapal, notifications). Implicit for any app with backend.

**Config:** AndroidManifest line 6 (standard)

---

## 2. Library-Added Permissions (Review)

These appear in `AndroidManifest.xml` but are **not actively used** by app code. They may be added by `expo-image-picker` or `expo-media-library`.

### 2.1 READ_MEDIA_AUDIO

| Field | Value |
| ------- | ------- |
| **Used by app?** | No |
| **Source** | Likely expo-image-picker or expo-media-library |
| **App usage** | Only `MediaTypeOptions.Images` – no audio picker |

**Recommendation:** Remove if possible via plugin config. If the library requires it, document in Data Safety that audio is not collected.

---

### 2.2 READ_MEDIA_VIDEO

| Field | Value |
| ------- | ------- |
| **Used by app?** | No |
| **Source** | Likely expo-image-picker |
| **App usage** | Only `MediaTypeOptions.Images` – no video picker |

**Recommendation:** Remove if possible. If required by library, document that video is not collected.

---

### 2.3 READ_MEDIA_VISUAL_USER_SELECTED

| Field | Value |
| ------- | ------- |
| **Used by app?** | Possibly (Android 14+ partial access) |
| **Source** | expo-image-picker |
| **App usage** | Image picker may use granular "select specific photos" on Android 14+ |

**Recommendation:** Keep if library adds it for granular photo access. Aligns with minimum necessary (user selects only what to share).

---

## 3. Blocked Permissions (Correct)

These are explicitly removed via `tools:node="remove"` in AndroidManifest. The app does not use them.

| Permission | Reason |
| ---------- | ------ |
| `ACCESS_FINE_LOCATION` | Location not used; check-in is QR-only |
| `ACCESS_COARSE_LOCATION` | Same |
| `READ_CALENDAR` | Calendar not used |
| `WRITE_CALENDAR` | Same |
| `RECORD_AUDIO` | No audio recording; expo-camera `recordAudioAndroid: false` |
| `SYSTEM_ALERT_WINDOW` | Overlay not used |

**Config:** `app.json` blockedPermissions (lines 37–44), AndroidManifest `tools:node="remove"`

---

## 4. Sensors (No Extra Permissions)

| Sensor | Used in | Permission needed? |
| -------- | --------- | -------------------- |
| **Pedometer** | useSteps, useStepCounter | ACTIVITY_RECOGNITION (already declared) |
| **Accelerometer** | FoodScanner.tsx (scan quality) | No |
| **LightSensor** | FoodScanner.tsx (lighting quality) | No |

Accelerometer and LightSensor are used for scan quality hints in FoodScanner; they do not require additional Android permissions.

---

## 5. Other Features Checked

| Feature | Permission needed? | Evidence |
| --------- | -------------------- | ---------- |
| **expo-sharing** | No | SnapshotsView uses `Sharing.shareAsync` – system share sheet, no storage permission |
| **Bluetooth** | No | Not used |
| **Location** | No | Blocked; check-in uses `location: null` or placeholder |
| **Calendar** | No | Blocked |

---

## 6. Current Declaration Summary

### app.json (Gymz)

```json
"permissions": [
  "CAMERA",
  "NOTIFICATIONS",
  "android.permission.CAMERA",
  "android.permission.ACTIVITY_RECOGNITION",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE"
]
```

### AndroidManifest.xml (generated)

| Permission | Status |
| ---------- | ------ |
| ACTIVITY_RECOGNITION | ✅ Required |
| CAMERA | ✅ Required |
| INTERNET | ✅ Required |
| NOTIFICATIONS | ✅ Required |
| READ_EXTERNAL_STORAGE | ✅ Required (legacy) |
| READ_MEDIA_AUDIO | ⚠️ Library – consider removing |
| READ_MEDIA_IMAGES | ✅ Required |
| READ_MEDIA_VIDEO | ⚠️ Library – consider removing |
| READ_MEDIA_VISUAL_USER_SELECTED | ⚠️ Library – keep if granular picker |
| VIBRATE | ✅ Required |
| WRITE_EXTERNAL_STORAGE | ✅ Required (legacy) |
| ACCESS_*_LOCATION | ❌ Blocked |
| RECORD_AUDIO | ❌ Blocked |
| READ/WRITE_CALENDAR | ❌ Blocked |
| SYSTEM_ALERT_WINDOW | ❌ Blocked |

---

## 7. Recommendations for Google Play

### 7.1 Data Safety Form

Declare only what you collect:

| Data type | Declare |
| ----------- | --------- |
| Photos/images | Yes – profile, community, nutrition, progress |
| Location | **No** |
| Audio | **No** |
| Video | **No** |
| Health/fitness | Yes – steps, workouts, nutrition |
| Notifications | Yes – push token |

### 7.2 Permissions Declaration (ACTIVITY_RECOGNITION)

- Complete the Permissions Declaration Form in Play Console.
- Provide a short demo video showing step counting on the Dashboard.
- See `docs/PLAY_CONSOLE_GROUP_D.md` D3.

### 7.3 Optional: Reduce Media Permissions

The app uses **images only** (profile, community, nutrition). READ_MEDIA_AUDIO and READ_MEDIA_VIDEO may be added by expo-image-picker or expo-media-library.

- **expo-image-picker** does not support granular media permissions in its config.
- **expo-media-library** (used for `saveToLibraryAsync` in SnapshotsView) supports `granularPermissions: ["photo"]` in its plugin config. Adding expo-media-library to `app.json` plugins with this option may reduce unnecessary READ_MEDIA_* permissions.

If these permissions remain after config changes, document in Data Safety that audio and video are **not collected**.

### 7.4 Keep

- All required permissions listed in Section 1.
- Blocked permissions as-is.

---

## 8. Code-to-Permission Map (Quick Reference)

| Permission | Primary files |
| ---------- | --------------- |
| CAMERA | EventQRCheckInScreen, GymCheckInScannerScreen, BarcodeScannerScreen, FoodScanner, useCameraPermissions |
| NOTIFICATIONS | App.tsx, notifications.ts, nutritionNotificationService, SettingsScreen |
| ACTIVITY_RECOGNITION | useSteps, useStepCounter, DashboardScreen, StepCounterCard |
| READ_MEDIA_IMAGES | EditProfileScreen, CommunityChatScreen, SnapshotsView (ImagePicker) |
| READ/WRITE_EXTERNAL_STORAGE | SnapshotsView (MediaLibrary.saveToLibraryAsync), ImagePicker |
| VIBRATE | hapticService, CommunityChatScreen, ComparisonSlider, BottomTabBar, FoodScanner, PlanOverview, DailySummary, NotificationBannerContext |

---

*End of permissions audit report.*
