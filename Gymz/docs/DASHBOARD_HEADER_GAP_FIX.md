# Dashboard Header Vertical Gap Fix

## Root Cause (with evidence)

**Container responsible:** The native stack (react-native-screens) applies safe area insets to screen content by default. The Main screen (which hosts the Tab.Navigator containing Dashboard) receives this safe area, causing the content to start below the status bar/notch.

**Property creating the space:** The native `ScreenStackItem` from react-native-screens uses the platform's safe area layout guide. Combined with the fact that the Dashboard header had `paddingTop: 0`, the effective layout was:

1. **Parent (native stack content wrapper):** Adds top inset (safe area) so content starts below status bar/notch.
2. **Dashboard header:** Had no padding, so it rendered at the top of the content area.
3. **Result:** On devices with notches or large status bars, the header appeared too far down because the parent's safe area was applied, and the header did not account for the fact that we wanted a single, controlled top offset.

**Evidence from component tree:**
- `App.tsx` → `SafeAreaProvider` (provides context, does not add padding)
- `AppNavigator` → `Stack.Navigator` (headerShown: false)
- `Main` Stack.Screen → `AppTabs` (Tab.Navigator)
- Tab.Screen "Dashboard" → `DashboardScreen`
- `DashboardScreen` root View → ScrollView → `DashboardHeader`

The native stack's `ScreenStackItem` wraps screen content and applies safe area via the native view controller. The fix cancels this at the Dashboard level and applies a single, explicit top inset only to the header.

---

## Files and Code Sections Changed

### 1. `Gymz/screens/DashboardScreen.tsx`

**Added:**
- `import { useSafeAreaInsets } from 'react-native-safe-area-context';`
- `const insets = useSafeAreaInsets();`
- Root View: `marginTop: -insets.top` to counteract the parent's safe area
- `DashboardHeader` prop: `paddingTop={insets.top}` to position the logo below the status bar/notch

```tsx
// Root View
<View style={[styles.container, { backgroundColor: theme.background, marginTop: -insets.top }]}>

// DashboardHeader
<DashboardHeader
  ...
  paddingTop={insets.top}
/>
```

### 2. `Gymz/components/dashboard/DashboardHeader.tsx`

**Changed:**
- Added `paddingTop?: number` prop (default 0)
- Replaced hardcoded `paddingTop: 0` with `paddingTop` from props

```tsx
interface DashboardHeaderProps {
  ...
  paddingTop?: number;
}

<View style={[styles.container, { paddingTop }]}>
```

---

## Why This Fix Does Not Affect Other Screens

1. **Dashboard-only scope:** The changes are confined to `DashboardScreen.tsx` and `DashboardHeader.tsx`. The `DashboardHeader` is used only by the Dashboard screen.

2. **No navigator changes:** The `AppNavigator`, `Stack.Navigator`, `Tab.Navigator`, and screen options are unchanged. Other tabs (Nutrition, Gymz AI, Tribes, Profile, etc.) keep their existing layout.

3. **No shared layout components:** No shared wrappers (e.g. `ScreenHeader`, `SafeAreaProvider`) were modified. Other screens that use `useSafeAreaInsets` or `SafeAreaView` are unaffected.

4. **EventHome vs Dashboard:** EventHome uses a separate `EventTabs` navigator and its own `EventHomeScreen`. It is not affected.

---

## Test Checklist

| # | Step | Expected |
|---|------|----------|
| 1 | Log in and reach Main (Dashboard) | Dashboard loads; logo and user icon appear near the top with minimal gap |
| 2 | Check header on notched device (iPhone X+) | Logo sits just below the notch; no large empty space above |
| 3 | Check header on Android (status bar) | Logo sits just below the status bar; no double spacing |
| 4 | Switch to Nutrition tab | Nutrition screen layout unchanged |
| 5 | Switch to Profile tab | Profile screen layout unchanged |
| 6 | Pull to refresh on Dashboard | Data refreshes; header position stable |
| 7 | Rotate device (if supported) | Header remains correctly positioned |

---

## Verification Notes

- **Header onLayout y:** With this fix, the header container starts at the top of the Dashboard content area. The `paddingTop: insets.top` pushes the logo/avatar row below the status bar.
- **Android vs iOS:** On Android with a non-translucent status bar, `insets.top` may be 0 (system already reserves space). In that case, `marginTop: -0` and `paddingTop: 0` leave the layout as before. On iOS with a notch, both values are applied to remove double spacing.
