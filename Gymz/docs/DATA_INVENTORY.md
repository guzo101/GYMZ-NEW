# Gymz – Data Inventory

**Purpose:** Google Play Data Safety form compliance. Use this document to complete
the Data safety section in Play Console.

**Last updated:** 2025-03-04

---

## 1. Data Collected

| Data type | Collected? | Purpose | Shared? | Encrypted? |
| --- | --- | --- | --- | --- |
| **Name** | Yes | Account identity, gym membership | No (gym admin) | Yes |
| **Email** | Yes | Login, password reset, notifications | No | Yes |
| **Phone** | Yes | Login (OTP), account recovery | No | Yes |
| **Photos / media** | Yes | Profile, community, nutrition | No (gym) | Yes |
| **Location** | **No** | Not collected | N/A | N/A |
| **Subscription status** | Yes | Access control, membership | No | Yes |
| **Health / fitness data** | Yes | Workouts, steps, nutrition | No | Yes |
| **Device identifiers** | Yes | Push, analytics, crash | Analytics | Yes |

---

## 2. Data Collection Details

### Account & identity

- **Name, email, phone:** Collected at registration. Stored in Supabase Auth +
  `users` table.
- **Purpose:** Authentication, account recovery, personalization.
- **Storage:** Supabase (PostgreSQL). Encrypted at rest (Supabase default).

### Photos & media

- **Source:** Camera (QR/barcode), image picker (profile, posts), media library.
- **Purpose:** QR check-in, profile avatar, community chat, nutrition logging.
- **Storage:** Supabase Storage. Encrypted in transit (HTTPS).

### Location

- **Not collected.** No GPS or location permissions. Location blocked in
  `app.json`. Check-in uses QR only.

### Subscription status

- **Source:** Gym management system (GMS) / backend.
- **Purpose:** Access control, feature gating.
- **Storage:** Supabase. Not shared.

### Health & fitness

- **Workouts, steps, nutrition, body metrics:** Via app (expo-sensors for steps).
- **Purpose:** Fitness tracking, progress, recommendations.
- **Storage:** Supabase. Not shared.

### Device identifiers

- **Push token, device ID:** For notifications and analytics.
- **Purpose:** Push notifications, crash reporting, analytics.
- **Shared:** With Expo/EAS (notifications), analytics provider if used.

---

## 3. Data Safety Form Mapping (Play Console)

When completing the Data safety form, declare:

1. **Data types collected:** Name, email, phone, photos, subscription status,
   health & fitness, device identifiers. **Location is NOT collected.**
2. **Is data shared?** No (except device IDs with notification/analytics services).
3. **Is data required or optional?** Account data required for core features.
4. **Encryption:** All data encrypted in transit (HTTPS). Supabase encrypts at rest.
5. **Data deletion:** Users can request account deletion (see Account Deletion below).

---

## 4. Permissions & Purpose

| Permission | Purpose |
| --- | --- |
| CAMERA | QR/barcode scan (check-in, nutrition) |
| NOTIFICATIONS | Push notifications (check-in, reminders) |
| ACTIVITY_RECOGNITION | Step tracking (walking/steps) |
| READ_MEDIA_IMAGES / STORAGE | Profile photo, community posts |

**Blocked (not used):** RECORD_AUDIO, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION,
READ/WRITE_CALENDAR.

**Media permissions (expo-image-picker):** App uses images only (profile,
community, nutrition). READ_MEDIA_IMAGES required. READ_MEDIA_AUDIO,
READ_MEDIA_VIDEO may appear in manifest from library; we do not use
audio/video picker.

---

## 5. Account Deletion

- **In-app:** Add "Delete account" in Settings → Account.
- **External:** Document process (email support, or self-service if implemented).
- **Scope:** Delete user record, auth identity, and associated data from Supabase.

---

## 6. Privacy Policy Requirements

Your privacy policy must cover:

- What data is collected
- Why it is collected
- How it is stored and secured
- Who it is shared with (if anyone)
- How users can request deletion
- Contact for privacy questions
