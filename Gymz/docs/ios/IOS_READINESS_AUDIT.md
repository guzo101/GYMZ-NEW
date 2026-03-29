# Gymz iOS readiness audit

**Project root audited:** `Gymz/`  
**Audit method:** Read `package.json`, `app.config.js`, `eas.json`, `.easignore`, `android/` native entrypoints, and searched application source for platform APIs. **One command was executed:** `npx expo prebuild --platform ios --no-install` on Windows (result recorded below).

---

## 1. Expo vs bare React Native

**Finding:** This is **Expo-based React Native** (managed workflow with prebuild).

**Evidence:**

- `package.json` lists `expo: ~54.0.33`, `babel-preset-expo`, multiple `expo-*` packages, scripts `expo run:android` / `expo run:ios`.
- `app.config.js` exports `module.exports = { expo: { ... } }` (Expo config).
- `android/app/src/main/java/.../MainApplication.kt` uses `expo.modules.ReactNativeHostWrapper` and `expo.modules.ApplicationLifecycleDispatcher`.
- There is **no** `app.json` in `Gymz/`; configuration is **`app.config.js` only** (verified: glob for `app.json` under `Gymz/` returned none).

---

## 2. `ios/` folder

**Finding:** There is **no** committed `ios/` directory in `Gymz/` at audit time.

**Evidence:**

- Directory listing of `Gymz/` does not include `ios/`.
- Glob for `Podfile` and `Info.plist` under `Gymz/` (excluding assumptions) found **no** project-native copies; iOS native files are **not** in the repo.

**Related:** `.easignore` contains `ios/` and `android/`, so **EAS uploads exclude** committed native trees and **regenerates** them during the build using `app.config.js` (and plugins).

---

## 3. Dependencies: Android-only or iOS risk

| Package / area | Finding |
|----------------|---------|
| `expo`, `expo-*` (camera, notifications, sensors, etc.) | Documented as cross-platform; iOS support is provided by Expo modules. |
| `@react-navigation/*`, `react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler` | Cross-platform. |
| `@react-native-async-storage/async-storage`, `@supabase/supabase-js`, `date-fns` | JS-only / cross-platform. |
| `@react-native-community/datetimepicker` | Cross-platform (native UI differs per OS). |
| `@react-native/gradle-plugin` | **Android Gradle only.** It is **not** used by the iOS/Xcode build. It does **not** prevent an iOS build. |
| `react-native-web`, `react-dom` | Used for **web**; not part of the native iOS binary. |
| `react-native-vector-icons` | Listed in `package.json`. **No** `from 'react-native-vector-icons/...'` import was found under `Gymz/*.ts` / `*.tsx` via repository search; UI uses `@expo/vector-icons`. The dependency may be **transitive / unused in app source**; it does not constitute a verified iOS break from imports found. |
| `sharp` (devDependency) | Node image tooling for scripts; not linked into the iOS app binary. |

---

## 4. Android-specific code, config, permissions

### Application TypeScript / TSX

| Location | What | iOS impact |
|----------|------|------------|
| `navigation/AppNavigator.tsx` | `Platform.OS !== 'android'` guard around `BackHandler.addEventListener('hardwareBackPress', ...)` | **Expected:** Android-only API; iOS has no hardware back. **Does not block iOS.** |
| `App.tsx` | `Platform.OS === 'android' && insets.bottom === 0` → fallback bottom inset | **Android-only layout fix.** iOS uses `insets.bottom` as provided. **Does not block iOS.** |
| `services/notifications.ts` | `Platform.OS === 'android'` for notification channel and Android-only `channelId` / vibration in payloads | **Expected.** iOS does not use Android channels. **Does not block iOS.** |
| `services/permissionOnboarding.ts` | `PermissionsAndroid` + `ACTIVITY_RECOGNITION` **only when** `Platform.OS === 'android'` | **Does not run on iOS.** For `activityRecognition`, iOS branch sets result to `undetermined` (no `PermissionsAndroid` call). |
| `services/permissionOnboarding.ts` | `NativeModules.StepCounterModule` | **Not registered** in `MainApplication.kt` (only autolinked `PackageList`). On Android, `if (StepCounterModule)` avoids calling when undefined. **No iOS-specific crash path identified from this file.** |
| `hooks/useStepTracking.ts` | `if (Platform.OS !== 'android')` → sets `isAvailable: false` and error message | **Step UI/service init is intentionally disabled on iOS** in this hook, regardless of `expo-sensors` Pedometer capability on iOS. **Product gap, not a compile blocker.** |
| `services/stepTrackingService.ts` | Uses `expo-sensors` `Pedometer` | **Cross-platform API** in Expo; **not** wired for iOS in `useStepTracking` (see above). |
| `components/nutrition/FoodScanner.tsx` | `LightSensor.addListener` only when `Platform.OS === 'android'` | On iOS, lighting subscore for “readiness” is **not** updated from the light sensor; accelerometer path still runs where applicable. **Behavioral difference vs Android, not a build blocker.** |
| `components/nutrition/FoodScanner.tsx` | `paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0` | **Expected** pattern for status bar on Android; iOS uses `0` here. |

### `app.config.js`

- Keys under `expo.android.*` (permissions, intentFilters, adaptiveIcon, etc.) apply **only to Android** and do **not** configure iOS.
- `expo.ios` includes `bundleIdentifier`, `associatedDomains`, `supportsTablet`, `jsEngine: 'hermes'`.

### `expo-build-properties` plugin

- Only an **`android`** block is present (`minSdkVersion`, `compileSdkVersion`, etc.). **No `ios` block** is present. **Expo applies default iOS build settings** when `ios` is omitted (exact default version numbers are defined by the Expo SDK you use at prebuild time, not duplicated here to avoid unstated numbers).

### Android native (`android/`)

- `AndroidManifest.xml` declares Android permissions and intent filters for `gymz` and `https://gymz.app/auth/callback`. **iOS equivalents** for universal links come from **`app.config.js` `ios.associatedDomains`** and generated entitlements after prebuild, **not** from `AndroidManifest.xml`.

---

## 5. Native modules and iOS setup

**Finding:** The app relies on **Expo autolinking** and standard React Native pods. There is **no** custom native iOS Swift/ObjC module in this repo (none found under a non-existent `ios/` tree).

**Custom Android native:** `MainApplication.kt` does **not** add any manual `ReactPackage` beyond `PackageList(this).packages`.

**Implication:** iOS native setup is **whatever `expo prebuild` + CocoaPods produce** from `app.config.js` and dependencies. No extra manual iOS native registration was found as required in-repo.

---

## 6. Config files checked

| File | Present | Notes |
|------|---------|--------|
| `app.config.js` | Yes | Single source of Expo config; `ios` block present. |
| `app.json` | **No** in `Gymz/` | N/A |
| `package.json` | Yes | `expo`, `react-native`, scripts include `ios` and EAS iOS builds. |
| `eas.json` | Yes | `preview`, `preview-simulator`, `production` include `ios` entries. |
| `Podfile` | **No** in repo | Expected until `ios/` is generated. |
| `Info.plist` (project) | **No** in repo | Generated by prebuild into `ios/` when run on a supported host. |
| `codemagic.yaml` | **No** at audit start | Repo root [`codemagic.yaml`](../../../codemagic.yaml): **`ios-simulator-preview`** workflow; `APP_DIR=$CM_BUILD_DIR/Gymz`. |
| `.easignore` | Yes | Ignores `ios/` and `android/` for upload; EAS regenerates native projects. |

---

## 7. `expo prebuild` for iOS — safe / possible?

**Executed (fact):** On **Windows**, in `Gymz/`:

```text
npx expo prebuild --platform ios --no-install
```

**Result:** **Exit code 1.** Expo printed:

```text
Skipping generating the iOS native project files. Run npx expo prebuild again from macOS or Linux to generate the iOS project.
CommandError: At least one platform must be enabled when syncing
```

**Conclusion:**

- **iOS native project generation is not performed on Windows** by this Expo CLI version in this environment.
- **Safe:** Running prebuild on **macOS or Linux** (or CI Mac, e.g. Codemagic) is the path to generate `ios/`.
- **EAS Build** runs on macOS in the cloud and performs the equivalent native generation for iOS builds even when your dev machine is Windows.

---

## 8. If this were bare React Native

**N/A:** The project is Expo-based. There is **no** standalone committed `ios/` project to judge “complete enough” in-repo; completeness is defined by **Expo prebuild output** on a Mac/Linux host or **EAS**.

---

## 9–10. Safe changes made (Android preserved)

The following **documentation and CI template** changes were made. **No Android behavior was removed.** **No step-counting logic was changed** (per project rules).

---

## 11. Report summary

### What was checked

- Project type, `ios/` presence, `package.json` dependencies, `app.config.js`, `eas.json`, `.easignore`, `MainApplication.kt`, `AndroidManifest.xml`, platform branching in key TS/TSX files, `useStepTracking` / `stepTrackingService`, `expo prebuild` on Windows.

### What was fixed / added (repo)

- **`codemagic.yaml`**: **Simulator-only** workflow: `npm ci` → icon scripts → `expo prebuild --platform ios` → `pod install` → `xcodebuild build` for **iphonesimulator** with signing disabled. Workspace/scheme discovered at build time (see YAML).
- **`docs/ios/IOS_READINESS_AUDIT.md`** (this file): Full audit record.
- **`package.json`**: Script **`prebuild:ios`** to run prebuild for iOS (must be run on **macOS or Linux**, not Windows, per command output above).
- **`docs/ios/README.md`**: Link to this audit.

### What still blocks iOS (plain English)

1. **No `ios/` folder in the repo** — expected; it is **generated** on Mac/Linux or by **EAS**, not on Windows via local prebuild (verified failure above).
2. **Apple signing and App Store Connect** — you must supply certificates/profiles (EAS can manage) or configure Codemagic signing.
3. **Universal Links** — `associatedDomains` is set in config; **hosting** must serve a valid `apple-app-site-association` for `gymz.app` (see [UNIVERSAL_LINKS.md](./UNIVERSAL_LINKS.md)).
4. **Push on iOS** — requires APNs credentials in EAS (or your CI) as already documented in [APPLE_EAS_SETUP.md](./APPLE_EAS_SETUP.md).
5. **Feature parity** — Steps are **disabled on iOS** in `useStepTracking.ts`. Food scanner **light sensor** path is **Android-only**. These are **product/QA** items, not compile errors.

### Files changed (this implementation)

| File | Action |
|------|--------|
| `codemagic.yaml` (repo root) | Created / moved from `Gymz/`; scripts target `Gymz/` via `APP_DIR` |
| `Gymz/docs/ios/IOS_READINESS_AUDIT.md` | Created |
| `Gymz/docs/ios/README.md` | Updated (link to audit) |
| `Gymz/package.json` | Added `prebuild:ios` script |

### Manual work still required

- Run **`npm run prebuild:ios`** (or `npx expo prebuild --platform ios`) on **macOS or Linux** once to generate `ios/` for local Xcode iteration, **or** rely on **EAS Build** without committing `ios/`.
- In **Codemagic**: connect **App Store Connect**, set **bundle id** `com.gym.memberapp`, verify **scheme/workspace** names match prebuild output, set **Node** version to match `.nvmrc` if you add one later.
- Complete **Apple** and **APNs** steps from [APPLE_EAS_SETUP.md](./APPLE_EAS_SETUP.md).
- **QA** using [QA_CHECKLIST.md](./QA_CHECKLIST.md).

### Codemagic next steps (unsigned Simulator only)

1. Add the repo in Codemagic with **`codemagic.yaml`** at the **repository root** (`CM_BUILD_DIR` = clone root). The workflow **`cd`s into `Gymz/`** for npm and Expo.
2. Run workflow **`gymz-ios-simulator`**. No App Store Connect or signing configuration is required for this workflow.
3. If the **scheme** fallback (`expo.name`) does not match the Xcode shared scheme Expo generated, the build can fail; fix by adjusting discovery logic in `codemagic.yaml` or hard-coding the correct scheme after you inspect `xcodebuild -list` output from a failed build log.
4. **App Preview**: Codemagic shows **Quick Launch** for suitable **`.app`** artifacts when the feature is enabled for your team ([docs](https://docs.codemagic.io/yaml-testing/app-preview/)).

---

## Post-audit code changes (iOS readiness implementation)

The following updates align native **step / motion** behavior with Expo `Pedometer` on **iOS and Android**, add **NSMotionUsageDescription** for the App Store, and remove unused **`StepCounterModule`** / **`PermissionsAndroid`** usage from permission onboarding.

| File | Change |
|------|--------|
| [`services/stepTrackingService.ts`](../../services/stepTrackingService.ts) | Initialize on **iOS + Android**; skip **web** only. `requestPermissionOnly` same. |
| [`hooks/useStepTracking.ts`](../../hooks/useStepTracking.ts) | Skip **web** only; native platforms use the service. |
| [`services/permissionOnboarding.ts`](../../services/permissionOnboarding.ts) | **activityRecognition** uses **`Pedometer`** on native; removed **`NativeModules` / `PermissionsAndroid`**. |
| [`app.config.js`](../../app.config.js) | **`ios.infoPlist.NSMotionUsageDescription`** for motion / step permission dialogs. |
| [`docs/ios/QA_CHECKLIST.md`](./QA_CHECKLIST.md) | Steps / light-sensor notes updated. |

**Dependency note:** `@react-native/gradle-plugin` remains in `package.json`; it is **only consumed by the Android Gradle build**, not by Xcode or CocoaPods. **Do not remove** while building Android.

---

**End of audit.**
