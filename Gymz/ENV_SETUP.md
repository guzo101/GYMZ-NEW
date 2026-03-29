# Environment Variables Setup

This document explains where and how to set environment variables for the Gymz app.

## Quick Reference

| Variable | Where to set | Required? | Used by |
| -------- | ------------ | --------- | ------- |
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` or EAS Secrets | No (fallback exists) | App |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` or EAS Secrets | No (fallback exists) | App |
| `EXPO_PUBLIC_BUILD_DATE` | EAS (auto) or `eas.json` | No | Settings screen |
| `EXPO_PUBLIC_PESAPAL_BASE_URL` | `.env` or EAS Secrets | No, sandbox | Pesapal |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` (local only) | Yes, for dev scripts | Dev scripts only |

---

## 1. Local development

### Create `.env`

```bash
cd Gymz
cp .env.example .env
```

Edit `.env` and add values where needed. The app works without `.env` (it uses hardcoded fallbacks for Supabase). You only need `.env` if you want to override config or run dev scripts.

### Running dev scripts

Scripts like `check_policies_snapshots.js`, `ensure_bucket.js`, etc. require `SUPABASE_SERVICE_ROLE_KEY`:

**Option A – Use `.env` with dotenv**

```bash
# Install dotenv (one-time)
npm install dotenv

# Run with env loaded (add to script: require('dotenv').config())
node check_policies_snapshots.js
```

**Option B – Inline (PowerShell)**

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="your_key_here"; node check_policies_snapshots.js
```

**Option B – Inline (Bash)**

```bash
SUPABASE_SERVICE_ROLE_KEY=your_key_here node check_policies_snapshots.js
```

---

## 2. EAS Build (production)

### EAS Secrets (recommended)

1. Go to [expo.dev](https://expo.dev) → your project → **Secrets**
2. Add:
   - `EXPO_PUBLIC_SUPABASE_URL` (optional)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (optional)
   - `EXPO_PUBLIC_PESAPAL_BASE_URL` (for production Pesapal: `https://pay.pesapal.com/v3/api`)
   - `EXPO_PUBLIC_BUILD_DATE` (optional; EAS can set this)

### `eas.json` (non-sensitive only)

For non-sensitive values, you can add them under `build.production.env` in `eas.json`:

```json
"production": {
  "env": {
    "EXPO_PUBLIC_BUILD_ENV": "production",
    "EXPO_PUBLIC_BUILD_DATE": "2025-03-04"
  }
}
```

---

## 3. File placement

| File | Purpose | Committed to git? |
| ---- | ------- | ------------------- |
| `.env.example` | Template – variable names and docs | Yes |
| `.env` | Your actual values | **No** (in `.gitignore`) |
| `ENV_SETUP.md` | This documentation | Yes |

---

## 4. Security checklist

- [x] **Supabase anon key** – Safe to have in app (public by design; RLS protects data)
- [x] **Supabase URL** – Public
- [x] **Service role key** – Never in app or repo; only in local `.env` for dev scripts
- [x] **Pesapal credentials** – Currently placeholders; for production, move to Supabase Edge Function
- [ ] **Rotate service_role key** – Do this in Supabase Dashboard if it was ever committed

---

## 5. Pesapal production

Pesapal consumer key and secret must **not** live in the app. For production:

1. Create a Supabase Edge Function that holds the credentials
2. App calls the Edge Function to create/verify orders
3. The Edge Function uses `Deno.env.get('PESAPAL_CONSUMER_KEY')` etc., set in Supabase secrets
