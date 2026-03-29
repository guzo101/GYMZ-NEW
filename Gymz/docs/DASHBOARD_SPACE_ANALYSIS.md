# Dashboard Unwanted Space Analysis

## User-Marked Areas (from images)

1. **Top-most dead space** (~25–30% of screen): Large empty area at the very top, above the header (logo, bell, profile). Heavily marked with yellow scribbles and a horizontal line.

2. **Mid-screen dead space** (~20–25% of screen): Vertical gap between the header (logo, icons) and the weekly calendar (SU MO TU WE TH FR SA). Marked with yellow scribbles.

3. **Top-left quadrant** (red circle): Space above and around the GYMZ logo, extending left and down toward the weekly calendar.

## Root Causes Identified

| Source | Location | Current Value | Contribution |
|--------|----------|---------------|--------------|
| **Header paddingTop** | DashboardHeader.tsx | `insets.top + 8` | On notched devices: 44–59 + 8 = 52–67px. Primary cause of top-most space. |
| **ScrollView contentInset** | DashboardScreen.tsx | Default `automatic` | iOS can add duplicate safe-area inset, doubling top padding. |
| **Header topBar paddingVertical** | DashboardHeader.tsx | 4 | Adds 8px to header height. |
| **WeeklyCalendar paddingVertical** | WeeklyCalendar.tsx | `designSystem.spacing.sm` (8) | 8px top padding = gap between header and SU MO TU row. |
| **SponsorBanners marginVertical** | SponsorBanners.tsx | 8 | When banners exist: 8px top margin. |
| **CalibrationBanner margins** | CalibrationBanner.tsx | marginTop: 10, marginBottom: 10 | When shown: 20px total. |

## Fix Strategy

1. **contentInsetAdjustmentBehavior="never"** – Stop iOS from adding extra top inset.
2. **Header paddingTop** – Cap at 12px: `Math.min(insets.top, 12)`.
3. **Header topBar** – `paddingVertical: 0`.
4. **WeeklyCalendar** – `paddingTop: 0`, `marginTop: 0`, `paddingBottom: 4`.
5. **SponsorBanners** – `marginVertical: 4`.
6. **CalibrationBanner** – `marginTop: 4`, `marginBottom: 4`.

## Files to Modify (no other code changes)

- `screens/DashboardScreen.tsx` – ScrollView + scrollContent
- `components/dashboard/DashboardHeader.tsx` – paddingTop, topBar
- `components/dashboard/WeeklyCalendar.tsx` – container padding/margin
- `components/dashboard/SponsorBanners.tsx` – marginVertical
- `components/CalibrationBanner.tsx` – margins
