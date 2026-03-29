# Auth UI breakdown — sign up & login (mobile)

## Goal

Make the mobile app sign-up and login flow **user-friendly** with clear screens and paths. **Backend is unchanged**; only front-end (screens and navigation) is modified.

---

## Target flow (by facts from codebase)

### 1. Entry (first screen)

- **One screen**: user sees only two choices.
  - **Log in** (primary) → goes to **Login** screen.
  - **Create an account** (secondary) → goes to **Signup** screen.
- Optional: **Browse Gyms** (tertiary link) → **GymSelection** (existing behavior).

### 2. Login path

- **Login screen** (only):
  - Email input
  - Password input
  - **Forgot your password?** (→ Reset flow: e.g. Forgot screen or ResetPassword)
  - Primary: **Sign in**
  - Footer: **Don’t have an account? Sign up** (→ Signup screen)
  - Back (or system back) returns to **Entry** screen.

### 3. Sign up path

- **Signup screen** (existing):
  - Name (first/last), email, password, confirm password, terms, marketing.
  - **Create account** → Email verification or main app (unchanged).
  - **Already have an account? Sign in** (→ Login screen).
  - Back returns to **Entry** (when opened from Entry) or previous screen.

### 4. Forgot password

- From Login: **Forgot your password?** → enter email → **ResetPassword** (existing) with code entry.
- No change to backend or ResetPassword logic.

---

## Systematic approach (build → test → next)

- **Task 1**: Entry screen only.  
  - New **AuthEntry** screen: logo, tagline, “Log in”, “Create an account”, optional “Browse Gyms”.  
  - Navigator: **AuthEntry** as initial route when unauthenticated; add **AuthEntry** to stack and `PRE_APP_ROUTES`.  
  - **Test**: Cold open → Entry; tap Log in → Login; tap Create account → Signup; back from Login/Signup → Entry.

- **Task 2**: Login screen cleanup.  
  - Login screen shows only **login** and **forgot** (remove any in-screen “register” phase if still present).  
  - Ensure: email, password, “Forgot your password?”, “Sign up” link, and back to Entry.  
  - **Test**: Full login, forgot password, sign up link, back.

- **Task 3**: Sign up path polish.  
  - Ensure Signup has “Already have an account? Sign in” and back to Entry where appropriate.  
  - **Test**: Signup → Login link, back from Signup.

- **Task 4** (optional): Forgot from Login.  
  - If “Forgot?” currently toggles in-place, consider a dedicated step/screen for “Enter email” then navigate to **ResetPassword** with email param (already supported).  
  - **Test**: Forgot flow end-to-end.

---

## Current state (verified from code)

- **AppNavigator** (`Gymz/navigation/AppNavigator.tsx`):  
  - When `!user`, `initialRouteName` is `'Login'`.  
  - Stack includes: Login, Signup, GymSelection, AccessModeSelection, EmailVerification, ResetPassword.

- **LoginScreen** (`Gymz/screens/LoginScreen.tsx`):  
  - Single screen with internal `phase`: `LOGIN` | `REGISTER` | `FORGOT`.  
  - “Sign Up” link uses `navigation.navigate('Signup')`.  
  - “Forgot?” sets `phase` to `FORGOT` (same screen).  
  - `REGISTER` phase exists in code but is never set (no UI path to it).

- **SignupScreen** (`Gymz/screens/SignupScreen.tsx`):  
  - Full form (first/last name, email, password, confirm, terms, marketing).  
  - Back: `navigation.goBack()`.  
  - Footer: “Already have an account? Sign In” → `navigation.navigate('Login')`.

---

## Implementation status

- **Task 1**: In progress — AuthEntry screen + navigator wiring.
- **Task 2–4**: Pending (after Task 1 is built and tested).
