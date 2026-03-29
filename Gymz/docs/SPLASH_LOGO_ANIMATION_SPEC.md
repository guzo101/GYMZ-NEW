# Gymz Splash Screen — Premium Logo Animation Spec

**Role:** Motion design direction and technical specification for the Gymz logo animation on the splash screen.  
**Context:** React Native (Expo) app; logo is a PNG image (`GymzLogo`); animations use `Animated` with `useNativeDriver: true`. Splash display window is ~1.5–2s; exit ~400ms.  
**Constraints:** No logo redesign, no distortion, no identity change, no excessive glow/particles/cartoon style. Logo must stay recognizable at all times.

---

## 1. Subtle scale reveal

**Name:** Subtle scale reveal  

**Visual description:** The logo fades in while scaling from ~90% to 100% size. No rotation or bounce; a calm, confident appear.

**Begin:** Logo at scale 0.9, opacity 0.  
**End:** Logo at scale 1, opacity 1, fully visible and at rest.

**Duration:** ~600–800 ms for the reveal. Can sit within a 1.5–2 s total splash.

**Why it feels premium:** Restraint. No overshoot or playfulness; the brand “arrives” without shouting. Common in high-end product and fitness apps.

**Technical (mobile):**

- Use `Animated.timing` for both scale and opacity with `useNativeDriver: true`.
- Easing: `Easing.out(Easing.cubic)` or `Easing.out(Easing.quad)` — no back/overshoot.
- Start values: `scale = 0.9`, `opacity = 0`; end: `1`, `1`.
- Runs entirely on the native driver; no JS thread work per frame. Safe for low-end devices.
- **Fits current setup:** Replace or simplify the existing spring/rotate/translateY entrance in `SplashLogo.tsx` with this only.

---

## 2. Light sweep (highlight pass)

**Name:** Light sweep  

**Visual description:** A soft, narrow highlight (gradient or bright band) moves once across the logo surface left-to-right (or center-out), suggesting a polished, metallic finish. The logo itself does not deform; the sweep is an overlay.

**Begin:** Sweep invisible or off one side (e.g. left). Logo already visible (e.g. after a short scale-in or immediately).  
**End:** Sweep has passed; logo unchanged, no residual effect.

**Duration:** Sweep pass ~400–600 ms. Logo can appear at 0–300 ms (e.g. scale-in 0.9→1, opacity 0→1), then sweep starts.

**Why it feels premium:** Single, intentional moment of “polish” that reads as quality and precision without being flashy.

**Technical (mobile):**

- Logo: same as today (Image in `GymzLogo`). No changes to the logo asset.
- Sweep: implement as an overlay `View` (or `LinearGradient`) positioned over the logo, with animated `translateX` (or `opacity` + position). Use `useNativeDriver: true`.
- Option A: Narrow vertical `LinearGradient` (e.g. transparent → white 0.2 → transparent) inside a view that’s as tall as the logo; animate that view’s `translateX` from -width to +width.
- Option B: Full-width overlay with gradient that has a “bright band”; animate the gradient’s `start`/`end` or the overlay’s position so the band moves across.
- Keep opacity of the sweep low (e.g. 0.15–0.25) so it reads as reflection, not a flash.
- **Performance:** Only transform/opacity on the overlay; no per-pixel work. Works on slow devices.

---

## 3. Orbit (accent line)

**Name:** Orbit motion  

**Visual description:** A thin, subtle line or arc (single color, low opacity) orbits once around the logo, then fades or stops. The logo itself is static or has a minimal reveal (e.g. scale-in); the orbit is an accent, not part of the logo.

**Begin:** Logo visible or just finished a short reveal. Orbit line at 0° (e.g. top).  
**End:** One full (or 3/4) orbit; line fades out or remains static. Logo unchanged.

**Duration:** Orbit ~700–1000 ms. Logo reveal (if any) ~400–600 ms; orbit can start after or in parallel.

**Why it feels premium:** Suggests precision and energy (motion around a central brand mark) without touching the mark. Used in tech and sport branding.

**Technical (mobile):**

- Logo: unchanged; no distortion.
- Orbit: separate `Animated.View` with a thin border or a small “dot”/segment, wrapped in a parent that’s centered on the logo. Parent’s `transform: [{ rotate }]`; animate `rotate` from 0 to 360deg (or 270deg) with `Animated.timing` + `Easing.out(Easing.cubic)`.
- Use a circular border (e.g. `borderWidth: 1`, `borderRadius: size/2`) slightly larger than the logo, or a small View at radius R; in both cases only the visible segment need be drawn (e.g. border with transparent background).
- Optional: animate orbit line opacity 0→0.4→0 over the rotation so it “trails off”.
- All with `useNativeDriver: true`. Lightweight.

---

## 4. Precision line draw (outline then fill)

**Name:** Precision line draw  

**Visual description:** Logo outline appears as if being drawn (stroke), then the fill fades or scales in. Requires a vector representation of the logo (e.g. SVG).

**Begin:** Outline at 0% drawn (or invisible).  
**End:** Outline 100% drawn, fill visible; logo complete.

**Duration:** Draw ~800–1200 ms; fill ~200–400 ms. Total ~1.2–1.5 s.

**Why it feels premium:** Communicates craft and precision; “drawn” reveals are associated with premium and creative brands.

**Technical (mobile):**

- **Constraint:** Current logo is PNG. True stroke-draw requires SVG (or Lottie) with stroke-dasharray/dashoffset or path length animation.
- If you introduce an SVG version of the logo: use `react-native-svg`; animate `strokeDashoffset` from path length to 0 (and optionally opacity) for the stroke; then animate fill opacity or scale for the fill. Use `useNativeDriver` where possible; note that some SVG props may run on JS — keep path simple and test on low-end devices.
- If you stay with PNG: approximate with a “reveal” (see Material reveal below) rather than a true line draw; avoid claiming “line draw” for a bitmap to prevent uncanny effect.

---

## 5. Strength pulse (settle)

**Name:** Strength pulse  

**Visual description:** Logo appears (e.g. scale-in or simple fade), then once at rest it performs a single, very subtle “pulse”: a small scale up and back (e.g. 1 → 1.03 → 1) with optional subtle opacity variation. Reads as energy and vitality, not bounce.

**Begin:** Logo reveal completes (e.g. scale 1, opacity 1).  
**End:** One soft pulse completed; logo at scale 1, at rest.

**Duration:** Reveal ~500–700 ms; pulse ~400–600 ms. Total ~1.2–1.5 s.

**Why it feels premium:** The pulse is minimal and singular; it suggests a heartbeat or readiness without being playful or cartoonish.

**Technical (mobile):**

- After entrance animation completes, run a short sequence: `Animated.timing(scale, { toValue: 1.03, duration: 250 })` then `Animated.timing(scale, { toValue: 1, duration: 350 })` with `Easing.out(Easing.cubic)`.
- Keep overshoot at 0; do not use spring for the pulse (spring can feel bouncy). Optional: very slight opacity 1 → 0.92 → 1 in parallel.
- All with `useNativeDriver: true`. Very cheap.

---

## 6. Material reveal (center-out)

**Name:** Material reveal  

**Visual description:** Logo appears as if emerging from the center: a soft mask or scale-from-center effect so it “grows” into place. No hard edges; the logo never stretches or distorts.

**Begin:** Logo effectively invisible (scale 0 or opacity 0, or both).  
**End:** Logo at full size and opacity; fully visible.

**Duration:** ~700–900 ms.

**Why it feels premium:** Feels like the brand “materializing” — controlled and confident. Works well for fitness/tech.

**Technical (mobile):**

- **With PNG:** Easiest approach is combined scale + opacity: start `scale = 0.85` (or 0.9), `opacity = 0`; end `scale = 1`, `opacity = 1` with `Animated.timing` and `Easing.out(Easing.cubic)`. This reads as “reveal from center” without a true mask.
- **True radial mask:** React Native doesn’t expose radial mask APIs directly. Alternatives: (1) use a circular `MaskedView` (expo or community) with an expanding circle mask — animate the circle scale; or (2) stick with scale+opacity for simplicity and performance. Prefer scale+opacity for reliability on all devices.
- `useNativeDriver: true` for transform and opacity. No bitmap manipulation.

---

## Recommendation summary

| Style              | Premium feel | Fits PNG logo | Implementation effort | Performance |
|--------------------|-------------|---------------|------------------------|------------|
| Subtle scale reveal| High        | Yes           | Low                    | Excellent  |
| Light sweep        | High        | Yes (overlay) | Medium                 | Excellent  |
| Orbit              | High        | Yes           | Medium                 | Excellent  |
| Precision line draw| High        | Needs SVG     | High                   | Good       |
| Strength pulse     | High        | Yes           | Low                    | Excellent  |
| Material reveal    | High        | Yes           | Low                    | Excellent  |

**Primary recommendation:** **Subtle scale reveal** as the default logo entrance. It is minimal, on-brand, and matches your “refined, not decorative” requirement. Optionally add **Strength pulse** after the reveal (one subtle pulse) to reinforce energy and vitality without delaying the splash.

**Optional enhancement:** Add **Light sweep** after the scale-in for a more “product launch” feel, or **Orbit** if you want a single accent motion around the mark. Use only one of sweep/orbit to keep the splash focused.

**Avoid for current stack:** Relying on “Precision line draw” with the existing PNG; if you later add an SVG logo, it can be revisited.

---

## Integration with current code

- **File:** `Gymz/components/splash/SplashLogo.tsx`
- **Current behavior:** Entrance: scale 0.3→1 (spring), rotate -18°→0°, translateY 60→0. Exit: translateY 0→-24, scale 1→0.95.
- **Suggested change for “Subtle scale reveal + optional pulse”:**
  - Entrance: remove rotate and translateY; set initial scale 0.9, opacity 0; animate to scale 1, opacity 1 with `Animated.timing` and `Easing.out(Easing.cubic)`, duration ~650 ms.
  - Optional: on entrance completion, run one strength-pulse sequence (scale 1→1.03→1, ~600 ms total).
  - Exit: keep current exit (translateY and scale) or simplify to fade only; ensure `useNativeDriver: true` for all.
- **Splash timing:** Keep `MIN_DISPLAY_MS = 1500` in `AnimatedSplashScreen.tsx`; logo animation should finish well before exit (e.g. by ~1.2 s so the logo “holds” for a moment before transition).

---

## Definition of success

- The splash shows the Gymz logo with a clear, premium entrance (and optional pulse/sweep/orbit).
- Animation is smooth (60fps), minimal, and non-blocking; transition into the first screen is unchanged.
- No logo redesign, distortion, or gimmicky effects; the logo stays recognizable and on-brand throughout.
- Behavior is consistent on both fast and slow devices and completes before the first screen loads.
