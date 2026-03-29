# Dashboard Rebuild Summary

## Overview

The Gymz Nutrition Dashboard UI was completely rebuilt from scratch to permanently
eliminate the dead space issue. The new implementation uses a clean, predictable
vertical structure with explicit spacing constants.

---

## New Layout Plan

### A. Root Screen Container

- `flex: 1`, no hidden padding or margin
- Single root `View` with `backgroundColor: theme.background`

### B. Absolute Background Layer

- `DynamicBackground` uses `StyleSheet.absoluteFill` — positioned absolutely
- Does **not** participate in layout flow; never consumes layout height
- Renders behind all content as a true background

### C. Foreground Content Container

- `ScrollView` with `contentContainerStyle` using explicit values:
  - `paddingTop: 0` — no mystery top spacing
  - `paddingHorizontal: 16`
  - `paddingBottom: 100` — clears tab bar
- Vertical flow: Header → Content sections with named spacing

### D. Spacing Strategy

All spacing comes from `dashboardLayoutConstants.ts`:

- `headerToContentSpacing`: 16 — between header and first content block
- `daysToNextBlockSpacing`: 16 — between week row and Daily Pulse block
- `sectionSpacing`: 20 — between major sections (cards)
- `tightSpacing`: 12 — between related items (CalibrationBanner, SponsorBanners)

**Key change:** Spacing uses `marginBottom` on each section instead of `marginTop`
on the next. This prevents accidental stacking of margins and eliminates hidden
gaps.

---

## Files Created

| File | Purpose |
| --- | --- |
| `dashboardLayoutConstants.ts` | Named spacing constants |
| `DashboardLayoutHeader.tsx` | Clean header with safe area |
| `components/dashboard/DashboardLayoutWeekRow.tsx` | Week/day selector |
| `docs/DASHBOARD_REBUILD_SUMMARY.md` | This document |

---

## Files Modified

| File | Changes |
| --- | --- |
| `screens/DashboardScreen.tsx` | Replaced layout; uses new components |

---

## New Component Hierarchy

```text
View (root, flex: 1)
├── DynamicBackground (absoluteFill — does not affect layout)
└── ScrollView (flex: 1)
    └── contentContainerStyle: { paddingTop: 0, paddingHorizontal: 16, ... }
        ├── DashboardLayoutHeader (safeAreaTop, paddingBottom: headerToContent)
        ├── CalibrationBanner? (marginBottom: tightSpacing)
        ├── SponsorBanners (marginBottom: tightSpacing)
        ├── DashboardLayoutWeekRow (marginBottom: daysToNextBlockSpacing)
        ├── CoachInsightCard (marginBottom: sectionSpacing)
        ├── DailyPulseCard (marginBottom: sectionSpacing)
        ├── WeekOverWeekCard? (marginBottom: sectionSpacing)
        ├── ProgressReportCard? (marginBottom: sectionSpacing)
        ├── MyMealLogs (marginBottom: sectionSpacing)
        ├── ActiveSessionBanner? (marginBottom: sectionSpacing)
        ├── UpcomingClasses (marginBottom: sectionSpacing)
        ├── UpcomingEvents (marginBottom: sectionSpacing)
        └── SecondaryActions
```

---

## Why This Structure Avoids the Dead Space Bug

1. **No nested wrappers with marginTop** — The old layout had multiple nested
   `View`s with `marginTop: 24`, `marginTop: 20`, etc. These could stack or
   interact unpredictably. The new layout uses a flat structure with
   `marginBottom` only.

2. **Background is truly absolute** — `DynamicBackground` uses
   `StyleSheet.absoluteFill` and is a sibling of `ScrollView`. It never
   contributes to content height.

3. **Zero top padding on scroll content** — `contentPaddingTop: 0` ensures no
   extra space above the header. Safe area is handled only by the header’s
   `paddingTop: insets.top`.

4. **Explicit spacing constants** — Every gap is named and defined in one
   place. No magic numbers or unexplained wrappers.

5. **Single-direction spacing** — Using `marginBottom` consistently avoids
   margin collapse and stacking issues.

---

## Unused Code (Safe to Remove)

The following files are no longer imported by the Dashboard:

- `components/dashboard/DashboardHeader.tsx`
- `components/dashboard/WeeklyCalendar.tsx`

They can be deleted if confirmed unused elsewhere. A project-wide search showed
no remaining imports.

---

## Post-Implementation Checklist

- [ ] No dead space above the content
- [ ] Header sits correctly at top (respects safe area)
- [ ] Days row sits directly below header/greeting block
- [ ] First card (Daily Pulse) begins at intended position
- [ ] Scrolling works smoothly
- [ ] Bottom navigation is unaffected
- [ ] No other screen has changed
- [ ] Pull-to-refresh works
- [ ] All conditional sections (CalibrationBanner, ActiveSessionBanner, etc.)
      render correctly when shown
