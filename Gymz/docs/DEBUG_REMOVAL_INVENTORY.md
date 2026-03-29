# Gymz App — Debug Removal Inventory

<!-- markdownlint-disable MD060 MD013 MD022 -->

**Date:** 2026-03-05  
**Scope:** Gymz mobile application only (no GMS, onboarding, or website)  
**Status:** Inventory complete; removals applied. See `DEBUG_REMOVAL_REPORT.md`.

---

## STEP 1 — Full Inventory (Pre-Removal)

### Item 1: EditProfileScreen — SAVE DEBUGGER Overlay

Field | Value
------ | ------
**Type** | Overlay / debug panel
**Activation** | Triggered on every Save button click (`setDebugVisible(true)` at line 176)
**File** | `Gymz/screens/EditProfileScreen.tsx`
**Lines** | 45-48 (state), 176-284 (logic), 471-502 (JSX), 634-686 (styles)
**Description** | Step-by-step save progress overlay with "SAVE DEBUGGER" title

**Code snippet:**

```tsx
{debugVisible && (
    <View style={styles.debugOverlay}>
        <View style={styles.debugCard}>
            <View style={styles.debugHeader}>
                <MaterialCommunityIcons name="bug" size={20} color="#6B7280" />
                <Text style={styles.debugTitle}>SAVE DEBUGGER</Text>
                ...
```

**Action:** REMOVE

---

### Item 2: PerformanceMonitor Component

Field | Value
------ | ------
**Type** | Overlay / developer tool (FPS meter, memory usage, performance metrics)
**Activation** | `usePerformanceMonitor().show()` — never called in codebase (always hidden)
**File** | `Gymz/components/PerformanceMonitor.tsx` (entire file)
**Used in** | `App.tsx` (import, render), `DashboardScreen.tsx`, `NutritionScreen.tsx` (startMetric/endMetric)
**Description** | FPS monitor, memory usage display, metrics list — developer performance tool

**Action:** REMOVE (component + all usages)

---

### Item 3: NutritionScreen — Unused Debug Styles

Field | Value
------ | ------
**Type** | Dead styles (debugOverlay, debugLine)
**Activation** | N/A — styles exist but are never rendered
**File** | `Gymz/screens/NutritionScreen.tsx`
**Lines** | 733-755 (styles), 40, 58 (usePerformanceMonitor)
**Description** | Leftover styles from removed debug overlay; also uses usePerformanceMonitor for metrics

**Action:** REMOVE (styles + usePerformanceMonitor usage)

---

### Item 4: FoodScanner — Debug Log State and Styles

Field | Value
------ | ------
**Type** | Debug state + dead styles
**Activation** | `debugLog` populated via `setDebugLog` in handleScan — never rendered
**File** | `Gymz/components/nutrition/FoodScanner.tsx`
**Lines** | 66 (state), 319 (setDebugLog), 1125-1136 (debugBadge, debugBadgeText styles)
**Description** | debugLog accumulates scan step messages; debugBadge/debugBadgeText styles unused

**Action:** REMOVE (state, setDebugLog calls, unused styles)

---

### Item 5: ProfileScreen — debugNotes

Field | Value
------ | ------
**Type** | User-facing subscription fault display
**Activation** | When secureQRService returns debugNotes (e.g. "User record not found")
**File** | `Gymz/screens/ProfileScreen.tsx`
**Description** | Displays subscription/identity issues to users — NOT a developer debug tool

**Action:** KEEP (feature logic)

---

### Item 6: secureQRService — debugNotes

Field | Value
------ | ------
**Type** | Data field for subscription status
**Description** | Returned to ProfileScreen for user display — NOT debug UI

**Action:** KEEP

---

### Item 7: dataMapper.ts — `__DEV__`

Field | Value
------ | ------
**Type** | Conditional console logging
**Description** | No visible UI — development logging only

**Action:** KEEP (not a debug overlay)

---

### Item 8: ErrorBoundary — "Log the error to console for debugging"

Field | Value
------ | ------
**Type** | Comment + console.error
**Description** | Error logging, not a debug UI

**Action:** KEEP

---

### Item 9: useAuth — "Log security state for debugging"

Field | Value
------ | ------
**Type** | Comment + console.warn
**Description** | Security logging, not a debug UI

**Action:** KEEP

---

## Summary

Item | Type | Action
----- | ----- | -----
EditProfileScreen SAVE DEBUGGER | Overlay | REMOVE
PerformanceMonitor | Overlay/Tool | REMOVE
NutritionScreen debug styles + usePerformanceMonitor | Dead code | REMOVE
FoodScanner debugLog + debugBadge styles | Dead code | REMOVE
ProfileScreen debugNotes | User feature | KEEP
secureQRService debugNotes | Data field | KEEP
dataMapper `__DEV__` | Logging | KEEP

---

## Not Verified (Manual Review)

None. All items were traced to source and classified.
