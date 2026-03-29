# Automatic Monthly Report Generation

## Overview

The system automatically generates and downloads performance reports for the
**previous month** when an admin logs in on the **1st day of each month**
(before noon).

## Scheduling Mechanism

- **Trigger**: When an admin user loads the app (Layout mounts) on the 1st of
  the month
- **Time window**: Before 12:00 (noon) local time
- **Duplicate prevention**: `localStorage` key `gms_monthly_report_last_run`
  stores the last run month (e.g. `2026-01`). If already run for the current
  month, the process is skipped.

## Report Scope

The following reports are generated for the **entire previous month**:

1. **Dashboard Performance Summary** – All-time metrics, membership mix
2. **Finance Report** – Full transaction history (all payments)
3. **Membership Report** – Complete member registry
4. **Attendance Report** – All check-in records
5. **Events Report** – All events
6. **Staff Report** – All staff members
7. **Support Inquiries** – All support inquiries

## Folder Naming

All reports are bundled into a single ZIP file:

```text
GMS_Monthly_Report_January_2026.zip
```

When extracted, the folder structure is:

```text
GMS_Monthly_Report_January_2026/
├── 01_Dashboard_January_2026.pdf
├── 02_Finance_January_2026.pdf
├── 03_Members_January_2026.pdf
├── 04_Attendance_January_2026.pdf
├── 05_Events_January_2026.pdf
├── 06_Staff_January_2026.pdf
└── 07_Support_Inquiries_January_2026.pdf
```

## Implementation Details

- **Service**: `src/services/monthlyReportService.ts`
- **Integration**: `src/components/Layout.tsx` (useEffect on admin user
  load)
- **Dependencies**: `jspdf`, `jspdf-autotable`, `date-fns`
- **Existing logic**: Uses `addBrandedHeader` and `fetchGymNameForReport` from
  `@/lib/pdfBranding`

## Date Logic

- **Previous month** is correctly calculated: e.g. on March 1st, reports cover
  February 1–28/29
- Uses `startOfMonth(subMonths(now, 1))` and `endOfMonth(subMonths(now, 1))`

## Manual Re-run

To force a re-run (e.g. if the automatic run was missed):

1. Open browser DevTools → Application → Local Storage
2. Remove the key `gms_monthly_report_last_run`
3. Refresh the app on the 1st of the month (before noon)

Or temporarily change the system date to the 1st of a month and load the app.
