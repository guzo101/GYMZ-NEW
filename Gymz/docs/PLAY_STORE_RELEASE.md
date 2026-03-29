# Gymz – Play Store Release Checklist

**Target countries:** Zambia, Kenya, Nigeria, South Africa  
**Monetization:** Subscriptions + Ads  
**Audience:** May include kids (content rating required)

---

## A. Build Configuration ✓

| Item | Value |
| ---- | ----- |
| minSdkVersion | 26 |
| targetSdkVersion | 35 |
| compileSdkVersion | 35 |
| Package | com.gym.memberapp |
| versionCode | 2 (increment every release) |
| version | 1.0.0 |

**Build command:** `npm run build:play`  
**Output:** `.aab` (Android App Bundle)

---

## B. Pre-Upload Checklist

### Play Console account

- [ ] **Personal account:** Complete Closed testing with 12+ testers for 14 continuous days before production.
- [ ] **Organization account:** No 14-day requirement.

### Signing

- [ ] Enable Play App Signing in Play Console.
- [ ] Configure EAS credentials: `eas credentials` (Android).
- [ ] Store and back up keystore/upload key.

### Store listing

- [ ] App icon 512×512
- [ ] Feature graphic 1024×500
- [ ] 2–8 phone screenshots
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] Category: Health & Fitness
- [ ] Support email
- [ ] Privacy policy URL (must match app behavior)
- [ ] Optional: website

### Content rating

- [ ] Complete questionnaire (kids may use → likely Everyone or Teen).
- [ ] Submit for rating.

### Data safety

- [ ] Complete Data safety form using `docs/DATA_INVENTORY.md`.
- [ ] Declare subscriptions and ads in monetization section.

### Permissions

- [ ] Ensure only required permissions are requested.
- [ ] Provide in-context permission rationale (e.g. "Allow location to find nearby gyms").

---

## C. Release Workflow

1. **Internal testing** – Upload first build, test with internal testers.
2. **Closed testing** – Add 12+ opted-in testers. Run for 14 days if personal account.
3. **Production** – Staged rollout (e.g. 10% → 50% → 100%).

---

## D. Versioning for Future Releases

Before each new upload:

1. Increment `versionCode` in `android/app/build.gradle` (or via app.json/plugin).
2. Update `version` in `app.json` (e.g. 1.0.1, 1.1.0).
3. Run `npm run build:play`.

---

## E. In-App Requirements

- [ ] **Privacy link** in Settings → link to privacy policy.
- [ ] **Account deletion** path (in-app or documented).
- [ ] **Consent prompts** for sensitive data (location, health, etc.).
- [ ] **Session handling** – token refresh, logout works.
- [ ] **Offline handling** – graceful no-internet behavior.

---

## F. Step Tracking (ACTIVITY_RECOGNITION)

Step tracking uses **ACTIVITY_RECOGNITION** + **expo-sensors** (Pedometer).  
This permission is correctly declared. No changes needed.

---

## G. Install Location & Calendar (if not yet used)

If you use location or calendar features, install:

```bash
npx expo install expo-location expo-calendar
```

Then run `npx expo prebuild --clean` to regenerate native projects.
