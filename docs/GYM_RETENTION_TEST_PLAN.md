# Gym Retention — Test Plan (Before Proceeding)

Use this to verify the retention design and migration before building the
sender/cron or events retention.

---

## What We Have Done So Far

1. **Design doc** — `docs/GYM_RETENTION_SYSTEM_DESIGN.md`  
   Segmentation, strategy per segment, copy, notification design, campaigns,
   pop-up UX.
   No code.

2. **Migration** —  
   <!-- markdownlint-disable-next-line MD013 -->
   `GymzGymsGMS/supabase/migrations/20260326_gym_retention_templates_and_rules.sql`  
   - Adds `training_category` to `gym_membership_plans` (optional column).  
   - Seeds 11 retention templates in `notification_templates`.  
   - Seeds 11 retention rules in `notification_rules` with `trigger_config` and
     `template_ids`.

---

## Step 1: Apply the Migration

### Option A — Supabase CLI (local or linked project)

```bash
cd GymzGymsGMS
supabase db push
# or
supabase migration up
```

### Option B — Supabase Dashboard

1. Open your project → **SQL Editor**.
2. Open `GymzGymsGMS/supabase/migrations/20260326_gym_retention_templates_and_rules.sql`.
3. Copy full contents → paste in SQL Editor → **Run**.
4. Confirm: no errors; message like “Success. No rows returned” is fine.

---

## Step 2: Run Verification SQL

1. In **SQL Editor**, open and run:
   - `GymzGymsGMS/scripts/verify_retention_migration.sql`
2. Or paste the contents of that file and run.

### What to check

| Check | Expected |
| --- | --- |
| `training_category column` | **PASS** |
| `retention templates count` | **PASS** (11) |
| `retention rules count` | **PASS** (11) |
| `rules have template_ids` | **PASS** (0 rules missing template_ids) |

1. Skim the two listing queries:
   - **Templates**: 11 rows, categories `retention_onboarding`, `retention_rescue`,
     `retention_milestone`, `retention_renewal`, `retention_daily_pass`.
   - **Rules**: 11 rows, each with a `segment` or trigger key in `trigger_config`,
     and `template_count` ≥ 1.

If any check is **FAIL**, fix the migration or data and re-run migration + verification.

---

## Step 3: Optional — Spot-Check Design Doc vs Data

- Open `docs/GYM_RETENTION_SYSTEM_DESIGN.md` and the template list from the
  verification script.
- Confirm copy in DB matches the doc (e.g. onboarding Day 1:
  “You’re in. Your first session…”).
- Confirm rule keys align with design: onboarding_day1/3/5, rescue_3d/7d/14d,
  renewal_30d/7d, daily_pass, milestone_streak/visits.

---

## Step 4: Sign-Off Before Proceeding

- [ ] Migration applied with no errors.
- [ ] All verification checks **PASS**.
- [ ] Retention templates and rules visible in DB and match design intent.

After this, we can proceed to:

- Building the **retention sender** (cron or app job that evaluates segments and
  sends using these templates/rules), and/or
- Designing the **events retention** system using the same structure.

---

## Step 5: Manual Test — Retention Improvement UI (GymzGymsGMS Dashboard)

Use this to verify the **Retention Improvement** panel end-to-end: list loads,
template choice, send creates notifications, and (optionally) member sees them.

### Preconditions

- Logged into GymzGymsGMS as a **gym admin** (or owner) for a gym that has
  members.
- At least one **member** with:
  - `role = 'member'`, `gym_id` = your gym, `membership_status = 'Active'`.
  - `renewal_due_date` between today and 7 days from now (so they appear in
    "Expiring Soon").
- (Optional) One member with `membership_status = 'Inactive'` and
  `renewal_due_date` in the last 7 days (for "Recently Expired" / Win-back).

If "Expiring Soon" is empty, either create test data or temporarily set a
member’s `renewal_due_date` to within 7 days in the DB for testing.

### Test: Send renewal reminders

1. Open **Dashboard** → ensure the **Retention Improvement** section is visible
   (Expiring Soon, Recently Expired, Retention Tip).
2. **Expiring Soon (7 Days)**  
   - Confirm the list shows members with expiry dates in the next 7 days (or
     "All clear! No members expiring soon" if none).
   - Select one or more members (checkboxes).
3. **Choose template**  
   - Open the dropdown **"Choose Message Template..."** and select e.g.
     **"Progress Focused"**.  
   - A modal should open with the template text and placeholders (e.g. `{{name}}`,
     `{{days}}`) filled or editable.
4. **Send**  
   - Click **"Send Reminders (N)"** in the modal (or the main CTA that confirms
     send).  
   - Expect: toast **"Sent N renewal reminders!"** and modal
     closes.
5. **Verify in DB**  
   - In Supabase: `notifications` table.  
   - Filter by `type = 'renewal_reminder'` and the member’s `user_id`.  
   - You should see a new row with your message, `read = false`, and (if
     implemented) `gym_id` set.
6. **Verify as member (optional)**  
   - Log into the **member app** (or GymzGymsGMS member portal) as that
     member.  
   - Open notifications / bell.  
   - The renewal reminder should appear.

### Test: Win-back campaign (if you have recently expired members)

1. In **Recently Expired**, select a member.
2. Choose a **Win-back Template** (e.g. "We Noticed" or "Coach Check-in"),
   optionally set a discount.
3. Click **"Launch Win-back Campaign (N)"** and confirm in the modal.
4. Expect toast **"Sent N win-back messages!"**.
5. Check `notifications` for `type = 'win_back'` for that user.

### If something fails

- **"Expiring Soon" empty but I have active members**  
  Members need `renewal_due_date` between today and today+7. Check
  `users.renewal_due_date` and `users.membership_status` for your gym. If you
  use the `membership` table as SSOT, ensure `users.renewal_due_date` is still
  populated (e.g. by a sync or view) for the UI query.
- **Insert fails (RLS or constraint)**  
  Ensure you’re logged in as admin/owner for that gym. Ensure the selected user
  is a member of your gym (`users.gym_id` = your gym).
  If the table requires `gym_id`, the updated code now sends `gym_id: user?.gymId`
  on insert.
- **Member doesn’t see notification**  
  Member app must read from `notifications` where `user_id = auth.uid()` and
  show `type` in the list. Check member RLS and the notification bell query.

---

## If Something Fails

- **Migration fails (e.g. constraint, missing table)**  
  Ensure `notification_templates` and `notification_rules` exist (from
  `20260214_ai_retention_system.sql`). If you never ran that, run it first, then
  run `20260326_gym_retention_templates_and_rules.sql`.

- **Template count not 11**  
  Re-run the migration; it uses `ON CONFLICT (template_key) DO UPDATE`, so
  it's idempotent.

- **Rules have null template_ids**  
  Migration fills `template_ids` via subquery. Ensure the retention templates
  were inserted in the same migration run. Re-run the full migration and run
  verification again.
