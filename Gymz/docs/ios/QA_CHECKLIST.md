# iOS QA checklist (parity with Android)

Run these checks on a **physical iPhone** after installing a build from EAS (ad hoc / internal / TestFlight). Simulator covers most UI flows but not all push or camera edge cases.

## Install and launch

- [ ] App installs without crash.
- [ ] Splash and icon match Android branding.
- [ ] First launch: permission prompts appear in a sensible order; app remains usable if optional permissions are denied.

## Auth and deep links

- [ ] Login and signup.
- [ ] **Password reset:** email link opens app (custom scheme `gymz://` and/or `https://gymz.app/...` if Universal Links are configured). Session applies and reset screen appears.
- [ ] **Auth callback** (`auth/callback`) completes when opened from email/browser.
- [ ] Cold start vs app-in-background: deep link still applies session and navigation.

See also [UNIVERSAL_LINKS.md](./UNIVERSAL_LINKS.md).

## Core flows

- [ ] Tab navigation (Dashboard, Nutrition, Progress/Tribes, Discover, Profile, hidden calendar routes).
- [ ] Safe areas: bottom tabs and content not obscured by home indicator (compare with Android nav bar behavior in `App.tsx`).
- [ ] Camera / QR flows (check-in, barcodes) if used on device.
- [ ] Photo picker (profile, community) and saving/sharing if applicable.

## Notifications

- [ ] Permission prompt; token registers without error (check logs or backend if you store Expo push tokens).
- [ ] Foreground and background notification display.
- [ ] Tapping a notification navigates or shows the expected screen (see `AppNavigator` notification handling).

## Regression

- [ ] No unexpected crashes on low memory or quick background/foreground.

## Steps / activity (iOS vs Android)

- Onboarding uses **Expo `Pedometer`** permissions on both Android and iOS (see [`permissionOnboarding.ts`](../../services/permissionOnboarding.ts)).
- Step display uses [`stepTrackingService`](../../services/stepTrackingService.ts) + [`useStepTracking`](../../hooks/useStepTracking.ts). **Expo documents** that `watchStepCount` may not deliver updates in the **background**; iOS also exposes `getStepCountAsync` for date ranges in expo-sensors. Validate foreground/background behavior on real devices.
- **Light sensor** readiness in the food scanner remains **Android-only** (`expo-sensors` marks `LightSensor` as `@platform android`).

## Build profiles used

| Profile | Use |
|---------|-----|
| `preview-simulator` | Fast QA on Simulator (`npm run build:ios:simulator`) |
| `preview` | Internal device distribution (`npm run build:ios:preview`) |
| `production` | TestFlight / App Store (`npm run build:ios`) |
