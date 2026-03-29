# Gymz iOS shipping (handoff)

This folder summarizes how to build and release the **same** member app as Android, from the [`Gymz/`](../../) Expo project. The iOS bundle ID is **`com.gym.memberapp`** ([`app.config.js`](../../app.config.js)).

## Prerequisites

1. Complete [APPLE_EAS_SETUP.md](./APPLE_EAS_SETUP.md) (Apple Developer, App Store Connect, EAS login, credentials, APNs if using push).
2. Node dependencies installed in `Gymz/`: `npm install`

## Build commands (from `Gymz/`)

| Script | When to use |
|--------|-------------|
| `npm run build:ios:simulator` | iOS **Simulator** `.app` tarball from EAS (no device signing friction). |
| `npm run build:ios:preview` | **Internal** iOS build (ad hoc / dev distribution per EAS). |
| `npm run build:ios` | **Production** iOS build for **TestFlight / App Store**. |

These mirror the Android scripts: they run `generate:icon` and `generate:notification-icon` before `eas build`.

## Local development (Mac only)

```bash
cd Gymz
npm run ios
```

Uses `expo run:ios` (Xcode + Simulator or device).

## Submit to App Store Connect

After a successful **production** iOS build:

```bash
npx eas-cli submit --platform ios --profile production
```

## Further reading

- [IOS_READINESS_AUDIT.md](./IOS_READINESS_AUDIT.md) — full iOS/Codemagic audit (what is ready, blockers, file list)
- [APPLE_EAS_SETUP.md](./APPLE_EAS_SETUP.md) — accounts and credentials
- [UNIVERSAL_LINKS.md](./UNIVERSAL_LINKS.md) — `applinks:gymz.app` and AASA
- [QA_CHECKLIST.md](./QA_CHECKLIST.md) — manual parity testing and iOS step-counter note

## Codemagic

Repo root [`codemagic.yaml`](../../../codemagic.yaml) defines **`ios-simulator-preview`**: minimal unsigned **iOS Simulator** `.app` (no signing / App Store). The workflow uses **`Gymz/`** as the Expo app directory (`APP_DIR`).

## Android reference

Android release notes and Play Store checklist may live elsewhere in the repo (search for `PLAY_STORE`); use them to align store metadata and permissions wording with iOS.
