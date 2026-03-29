# Step Tracking – Verification Test Checklist

Use this checklist to verify the step counting pipeline **without repeated blind rebuilds**. Before each test, ensure you are on a **physical Android device** (step counter is not reliable on emulators).

---

## Test 1: Permission verification

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 1.1 | Install a **fresh build** (or clear app data). | App installs. | ☐ |
| 1.2 | Open the app and log in. | App opens; user reaches main flow (e.g. Dashboard or onboarding). | ☐ |
| 1.3 | When the app requests **activity / motion** permission, tap **Allow**. | System permission dialog appears; after Allow, it closes. | ☐ |
| 1.4 | Check logs for `[StepTrackingService] permission request result:` or `permission get:`. | Log shows `granted: true` (and `status: granted`). | ☐ |
| 1.5 | If no dialog appeared, confirm in **Settings → Apps → Gymz → Permissions** that **Physical activity** (or **Body sensors** / **Activity recognition**) is **Allowed**. | Permission is recorded as granted by the system. | ☐ |

**If permission is denied:** Logs should show `Permission not granted` and the app should set an error (e.g. "Activity permission is required to track steps."). No step data will be recorded until permission is granted.

---

## Test 2: Capability verification

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 2.1 | Confirm you are testing on a **real physical Android device**, not an emulator. | Step counter is only reliable on real hardware. | ☐ |
| 2.2 | Check logs for `[StepTrackingService] isAvailableAsync():`. | Value is `true` on supported devices. | ☐ |
| 2.3 | If `isAvailableAsync()` is `false`: confirm device has step-counting hardware (most modern phones do). Check battery / device optimization: some OEMs restrict sensors when "Battery optimization" is aggressive. | Either capability is true or you have a known reason (unsupported device / restriction). | ☐ |

**Failure here:** If the device does not support the step counter or it is disabled, the app should show an error (e.g. "Step counter is not available on this device.") and not pretend to track steps.

---

## Test 3: Live data verification

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 3.1 | Note the **current step count** shown on the Dashboard (or Health/Activity section). | You have a baseline value (e.g. 0 or N). | ☐ |
| 3.2 | **Walk a measurable number of steps** (e.g. 20–50) with the phone on your person. | Physical steps are taken. | ☐ |
| 3.3 | Check logs for `[StepTrackingService] incoming step values:` with `cumulative` and `stepsToday`. | Raw step data changes: `cumulative` and/or `stepsToday` increase. | ☐ |
| 3.4 | Confirm **app state** updates: log `[useStepTracking] displayed step values:` should show the new value. | Log shows updated step count. | ☐ |
| 3.5 | Confirm the **UI** (Dashboard / step card) shows the updated step count. | Displayed number matches (or is very close to) the steps you took. | ☐ |

**If the UI never updates:** Use the logs to see where it fails:
- No `incoming step values` → sensor/subscription layer (Expo Pedometer not firing).
- `incoming step values` updates but no `displayed step values` → callback or React state.
- `displayed step values` updates but UI does not → display/component layer.

---

## Test 4: Persistence verification

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 4.1 | After recording some steps (Test 3), note the **displayed step count**. | Value is e.g. N. | ☐ |
| 4.2 | **Close the app** (swipe away from recents or back out and force stop). | App is not running. | ☐ |
| 4.3 | **Reopen the app** and go to the Dashboard. | App opens and shows Dashboard. | ☐ |
| 4.4 | Check the **displayed step count**. | It is correct or correctly refreshed from the sensor (same or higher than N; may be 0 if baseline was reset for a new day). | ☐ |

**Note:** On Android, the Expo Pedometer uses a cumulative sensor value since boot. "Steps today" is computed from a stored baseline. After reopen, the first update may come when the subscription fires again; the displayed value should then match the correct "steps today" logic.

---

## Test 5: Edge cases

| Scenario | Action | Expected | Pass? |
|----------|--------|----------|-------|
| 5.1 **Permission denied** | Deny activity permission when prompted (or revoke in Settings). Reopen app. | App does not crash. Logs show permission not granted. Step count is 0 or unavailable; error state is clear. | ☐ |
| 5.2 **Permission revoked after grant** | Grant permission, use app, then **Settings → Apps → Gymz → Permissions** → turn off Physical activity. Reopen app. | Same as 5.1: no crash, clear error, no fake step data. | ☐ |
| 5.3 **Unsupported device** | If you have a device where `isAvailableAsync()` is false (or use an emulator for this check only). | App shows that step tracking is unavailable; no fake success. | ☐ |
| 5.4 **App reopened after inactivity** | Leave app in background for a while, then bring to foreground. | Step count refreshes (check logs for foreground refresh); displayed value is still correct. | ☐ |
| 5.5 **Phone reboot** (if feasible) | Reboot device, open app, walk a few steps. | Baseline may reset; steps today should start from 0 and then increase as you walk. Logs may show "cumulative < baseline (e.g. reboot), baseline reset". | ☐ |
| 5.6 **Low power / battery optimization** | Enable aggressive battery saving for the app, then repeat a short walk test. | Step updates may be delayed; document behavior. No silent crash. | ☐ |

---

## Test 6: Debug tracing

Use these log tags to locate failures quickly:

| Layer | Log tag / message | Meaning |
|-------|--------------------|--------|
| **Permission** | `[StepTrackingService] permission get:` / `permission request result:` | Result of get/request permissions. |
| **Capability** | `[StepTrackingService] isAvailableAsync():` | Whether the step counter is available. |
| **Subscription** | `[StepTrackingService] Subscribing to watchStepCount (subscription start)` | Pedometer subscription started. |
| **Incoming data** | `[StepTrackingService] incoming step values:` `cumulative`, `stepsToday` | Raw values from the sensor / pipeline. |
| **Stored** | `[StepTrackingService] baseline set for` / `SYNC TO DB` | Baseline and DB sync. |
| **Displayed** | `[useStepTracking] displayed step values:` | Value passed to UI state. |
| **Init result** | `[useStepTracking] initialization success` / `initialization returned false` | Whether the hook considers tracking active. |

**Before any rebuild:** Decide which layer failed (permission, platform support, native integration, data read, storage, UI update), then apply a **targeted fix** and re-run only the relevant tests.

---

## Definition of done

- [ ] App can request activity permission successfully (Test 1).
- [ ] App receives real step data on supported physical devices (Test 3).
- [ ] App stores and displays the correct step count (Tests 3, 4).
- [ ] Repeatable testing procedure exists and is used (this checklist).
- [ ] Failures can be located via logs without trial-and-error rebuilds (Test 6).
- [ ] No unrelated UI or app behavior changes were introduced.

---

## Implementation summary (for reference)

- **Previous failure:** The app depended on a native module `StepCounterModule` that was **never implemented** in the Android project, so step data was never received.
- **Current approach:** Step tracking uses **Expo Pedometer** (`expo-sensors`). Permission is requested via `Pedometer.requestPermissionsAsync()`. On Android, the sensor provides **cumulative steps since boot**; "steps today" is computed using a **daily baseline** stored in AsyncStorage (`@gymz_step_tracking_baseline_YYYY-MM-DD`). Steps are synced to the backend via `healthService.syncSteps()`.
- **Platform:** Step tracking is implemented for **Android only**; iOS is explicitly unsupported in the current code (hook and service return unavailable on non-Android).
