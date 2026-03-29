# Group D: Play Console Checklist

Complete these tasks in **Google Play Console** before submitting Gymz for review.

---

## D1: Privacy Policy URL

**Where:** Play Console → Your app → **App content** → **Privacy policy**

### Steps

1. Host your privacy policy at a public URL, e.g.:
   - `https://gymz.co.zm/privacy`
   - Or GitHub Pages, your website, etc.

2. In Play Console:
   - Go to **Policy** → **App content**
   - Find **Privacy policy**
   - Click **Start** or **Manage**
   - Enter the URL (e.g. `https://gymz.co.zm/privacy`)
   - Save

### Content requirements

Your policy must cover (see `docs/DATA_INVENTORY.md`):

- What data you collect (email, name, phone, photos, weight, meal/workout logs, push token, payments)
- How it’s used and stored
- That **location is NOT collected**
- Account deletion (Settings → Delete account)
- Contact for privacy questions (e.g. support.gymz@gmail.com)

---

## D2: Data Safety Form

**Where:** Play Console → Your app → **App content** → **Data safety**

### Steps

1. Go to **Policy** → **App content** → **Data safety**
2. Click **Start** or **Manage**

### Important declarations

| Data type | Declare | Notes |
|----------|---------|-------|
| **Location** | **NOT collected** | App does not use location. Remove if listed. |
| Email | Collected | For auth, account |
| Name | Collected | Profile |
| Phone | Collected | Profile, payments |
| Photos | Collected | Profile, community, nutrition |
| Health data (weight, BMI, workouts) | Collected | For fitness features |
| Payment info | Collected | Via Pesapal/ClicknPay |
| App activity (logs) | Collected | Workout, meal logs |
| Device ID (push token) | Collected | For notifications |

3. Complete all sections and submit.

---

## D3: Permissions Declaration (ACTIVITY_RECOGNITION)

**Where:** Play Console → Your app → **Policy** → **App permissions**

### Steps

1. Go to **Policy** → **App permissions**
2. Find **ACTIVITY_RECOGNITION** (step counting / pedometer)
3. Complete the **Permissions Declaration Form**
4. Provide:
   - **Purpose:** Step counting for fitness tracking on dashboard
   - **Demo video:** Short screen recording showing step counting in use
   - **Instructions:** Brief text for reviewers (e.g. "Open app → Dashboard → Steps are shown from device pedometer")

### Video tips

- Show the app open → Dashboard
- Show steps displayed (or placeholder if no device)
- Keep it under 30–60 seconds

---

## D4: versionCode (In Codebase)

**Status:** Done. `versionCode` is set to **2** in `android/app/build.gradle`.

For future releases, increment before each new upload:

- 2 → 3 → 4 → …

---

## Quick reference

| Task | Status | Action |
|------|--------|--------|
| D1 | You | Add privacy policy URL in Play Console |
| D2 | You | Complete Data Safety form; ensure location = NOT collected |
| D3 | You | Complete ACTIVITY_RECOGNITION declaration + upload demo video |
| D4 | Done | versionCode = 2 in build.gradle |
