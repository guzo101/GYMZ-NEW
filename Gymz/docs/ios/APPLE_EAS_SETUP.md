# Apple Developer and EAS (iOS)

Complete these steps on your side before the first successful **iOS** EAS build. Values must match [`app.config.js`](../../app.config.js).

## Bundle identifier

- **iOS bundle ID:** `com.gym.memberapp`
- Register this exact App ID in [Apple Developer](https://developer.apple.com/account/resources/identifiers/list) if it does not exist.

## Apple Developer Program

- Enroll in the **Apple Developer Program** (paid).
- In **App Store Connect**, create an app record that uses `com.gym.memberapp` (or link an existing app to that bundle ID).

## Expo / EAS project

- EAS project ID is in `app.config.js` under `expo.extra.eas.projectId` (`d2226084-a971-416d-978a-d34d1274bf70`).
- From the [`Gymz/`](../../) folder, log in:

  ```bash
  npx eas-cli login
  ```

- Confirm the project is linked (should already be set via `app.config.js`):

  ```bash
  npx eas-cli project:info
  ```

## iOS signing (first build)

On the first `eas build --platform ios`, EAS can create or guide you through:

- Distribution **certificate**
- **Provisioning profile** (development / ad hoc / App Store as appropriate for the profile)

Or configure ahead of time:

```bash
npx eas-cli credentials
```

Select the **iOS** target and follow prompts for the build profile you use (`preview`, `production`, etc.).

## Push notifications (APNs)

Remote push uses [`expo-notifications`](https://docs.expo.dev/push-notifications/push-notifications-setup/) with your EAS project.

- In **EAS credentials**, add an **Apple Push Notifications key** (.p8) when prompted, or upload/configure via `eas credentials`.
- Ensure **Push Notifications** capability is enabled for the App ID in Apple Developer (EAS usually aligns this with the native project).

## Useful commands

| Goal | Command |
|------|---------|
| Internal device build (preview) | `npm run build:ios:preview` |
| Simulator-only build (QA) | `npm run build:ios:simulator` |
| Store / TestFlight build | `npm run build:ios` |
| Submit latest production to ASC | `npx eas-cli submit --platform ios --profile production` |

## Windows

EAS Build runs in the cloud; you can trigger iOS builds from **Windows**. Local Simulator / `expo run:ios` requires a **Mac** with Xcode.
