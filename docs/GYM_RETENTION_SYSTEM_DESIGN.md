# Gym Retention System — Design Document

**Scope:** Gym-side retention only. Events retention will be designed separately using the same structure.  
**Principle:** Retention adapts to **membership type** and **training goal/category**. No one-size-fits-all.

---

## 1. Segmentation and Logic

### 1.1 Data Sources (Alignment with Schema)

| Concept | Source | Notes |
|--------|--------|------|
| **Membership type** | `gym_membership_plans.plan_type` + `plan_name` | daily, weekly, monthly, 3_months, 6_months, annual, custom. Plan name may encode program (e.g. "Boxing Monthly"). |
| **Training category** | `plan_name` or future `training_category` on plan/membership | gym (general), boxing, karate, yoga, etc. Used to tailor messaging and expected frequency. |
| **Access path** | `membership.access_mode` | gym_access vs event_access — retention applies only to gym_access for this doc. |
| **Attendance** | `attendance_logs` (user_id, checkin_time, gym_id) | Last check-in, count in last 7/30 days, first check-in ever. |
| **Member lifecycle** | `membership.approved_at`, first `attendance_logs.checkin_time` | New = within 7 days of approval or first check-in; returning = has history. |
| **Status** | `membership.membership_status` | active only for retention flows; pending/rejected/cancelled excluded. |

### 1.2 Segment Definitions

Segments are computed per **gym_access** member (one row per member for retention logic). A member belongs to exactly one **primary** segment for campaign selection; sub-dimensions refine messaging and triggers.

#### A. Membership type (plan duration)

- **Daily pass** — plan_type = daily (or plan_name indicates single-day).
- **Short-term** — weekly, or monthly with &lt; 30 days remaining.
- **Monthly** — plan_type = monthly (recurring or 30-day).
- **Medium-term** — 3_months, 6_months.
- **Long-term** — annual.
- **Custom** — plan_type = custom; treat as “unknown duration” and use attendance-based logic only.

#### B. Training category (program type)

- **Gym (general)** — open gym / weights / cardio; no specific program in plan name.
- **Boxing** — plan or plan_name indicates boxing.
- **Karate / martial arts** — plan or plan_name indicates karate or similar.
- **Classes / group** — includes_classes = true or plan suggests group classes.
- **Other / uncategorized** — fallback when no category detected.

*Implementation note:* If `training_category` (or equivalent) does not exist, derive from `plan_name` (e.g. keyword match) or gym-level config. This drives **message angle** and **expected frequency** (e.g. boxing 2–3x/week vs monthly gym 3–4x/week).

#### C. Attendance frequency (behavioral)

- **None yet** — zero check-ins ever (approved, never visited).
- **Very low** — &lt; 1 visit per 2 weeks over the last 30 days (or since join if &lt; 30 days).
- **Low** — 1–2 visits in last 14 days (below expected for their plan/category).
- **On track** — 2+ visits in last 7 days (or meets expected frequency for category).
- **High** — 4+ visits in last 7 days (or clearly above expected).

*Expected frequency by category (guideline):*

- Gym general: 3–4x/week typical.
- Boxing / martial arts: 2–3x/week (class-based).
- Daily pass: 1 visit per purchase; no recurrence expectation.

#### D. New vs returning

- **New member** — either:  
  - first check-in was within the last 7 days, or  
  - approved within last 7 days and 0 or 1 check-ins.  
- **Returning member** — has at least one check-in and either approved &gt; 7 days ago or first check-in &gt; 7 days ago.

#### E. At-risk (inactive)

- **At-risk 3d** — last check-in &gt; 3 days ago (and expected frequency suggests they should have been in by now).
- **At-risk 7d** — last check-in &gt; 7 days ago.
- **At-risk 14d** — last check-in &gt; 14 days ago.
- **Lapsed** — last check-in &gt; 21 days ago (or &gt; 50% of plan duration with no visit).

*At-risk is evaluated only for members whose plan implies regular visits* (exclude daily pass after first use; optionally soften for very new members in first 7 days).

### 1.3 Segment → Campaign Mapping (Logic Table)

| Segment combo (examples) | Primary campaign | Trigger / condition |
|--------------------------|------------------|----------------------|
| New + any plan + 0 visits | Onboarding (Day 0–7) | approved_at within 7d, 0 check-ins |
| New + any plan + 1 visit | Onboarding (Day 0–7) | first check-in within 7d |
| Returning + daily pass | No recurrence campaign | Optional: “Use your pass today” only on day of or day after purchase |
| Returning + any + Very low / None yet | Inactivity rescue (3d/7d/14d) | Last check-in &gt; 3d / 7d / 14d |
| Returning + any + On track / High | Weekly momentum + milestones | No rescue; only momentum and milestones |
| Any + monthly/medium/long + expiry window | Renewal / expiry flow | Plan end within 7d or 30d (configurable) |
| Any + streak / progress moment | Milestone reinforcement | Streak threshold, visit count threshold |

Each segment combination must map to **one primary** retention action at a time (no stacking the same user into multiple campaigns for the same trigger type).

---

## 2. Retention Strategy per Segment

### 2.1 Onboarding (Day 0–7) — New members

| Item | Specification |
|------|----------------|
| **Goal** | First visit and habit anchor; reduce “never showed up” drop-off. |
| **Behavioral trigger** | Member approved, 0 or 1 check-in; within 7 days of approval or first check-in. |
| **Messaging angle** | “You’re in. Your first session is the one that counts.” Identity: new member who belongs; one clear next step (come in, or book first class). |
| **Differentiation by category** | Gym: “Floor is ready for you.” Boxing/Karate: “Your first class is waiting.” |

### 2.2 Weekly momentum — On-track / high frequency

| Item | Specification |
|------|----------------|
| **Goal** | Reinforce consistency; link next session to their stated goal. |
| **Behavioral trigger** | Has 2+ visits in last 7 days; not in onboarding or rescue. |
| **Messaging angle** | Acknowledge momentum; tie next visit to progress (e.g. “Week 2 is where habits stick.”). No guilt, no “we miss you.” |
| **Differentiation** | Class-based: “Next class is [day]. You’re building the routine.” Gym: “Same time next week?” (if typical_gym_days known). |

### 2.3 Inactivity rescue — At-risk 3d / 7d / 14d

| Item | Specification |
|------|----------------|
| **Goal** | One return visit; re-anchor without sounding desperate. |
| **Behavioral trigger** | Last check-in &gt; 3d, or &gt; 7d, or &gt; 14d (by segment). Exclude daily pass (no expectation after use). |
| **Messaging angle** | “You’re one session away from being back on track.” Focus on identity and goal, not guilt. Escalate tone only with 14d (slightly more direct, still premium). |
| **Differentiation** | 3d: light nudge, “Your usual [day/time]?” 7d: “Your goal doesn’t take a break.” 14d: “One session resets the rhythm.” |

### 2.4 Milestone reinforcement — Streaks and progress

| Item | Specification |
|------|----------------|
| **Goal** | Recognize progress; strengthen identity as someone who shows up. |
| **Behavioral trigger** | Streak threshold (e.g. 3, 7, 14 days) or visit count (e.g. 5, 10, 25) from `user_streaks` / `attendance_logs`. |
| **Messaging angle** | “This is who you are now.” Short, celebratory, no ask except to keep going. |
| **Differentiation** | Class: “You haven’t missed a [boxing/karate] week.” Gym: “You’ve shown up X times. That’s the habit.” |

### 2.5 Membership renewal and expiry

| Item | Specification |
|------|----------------|
| **Goal** | Renew before expiry; avoid “surprise” lapse. |
| **Behavioral trigger** | Plan end date within 7 days (urgent) or 30 days (early nudge). Only for plans with a known end (monthly, 3/6/12 months). |
| **Messaging angle** | “Your access runs through [date]. Renew to keep your momentum.” Factual, confident, single CTA (renew). |
| **Differentiation** | By plan type: “Your monthly/quarterly/annual access…” Same tone; only duration wording changes. |

### 2.6 Daily pass (special case)

| Item | Specification |
|------|----------------|
| **Goal** | Maximize use of the single day; no post-use recurrence campaign. |
| **Behavioral trigger** | Day of or day after purchase; 0 check-ins for that pass. |
| **Messaging angle** | “Your pass is valid today. Doors open at [time].” One message only; no follow-up if already used. |

---

## 3. Copywriting: Motivated, No Desperation

### 3.1 Principles

- **Reinforce identity and progress** — “You’re the kind of person who shows up.” / “You’ve done X sessions.”
- **Remind what they’re working toward** — Goal from calibration or plan (e.g. “Your [goal] is one session away.”).
- **Confident and premium** — We’re the gym that respects their time and commitment; we don’t plead.
- **No pleading or guilt** — Avoid “We miss you,” “Don’t forget us,” “Haven’t seen you in a while.”
- **Short and direct** — One idea per message; one clear next action.
- **No generic filler** — No “Just checking in!” or “Hope you’re doing well” without a purpose.

### 3.2 Copy by Use Case (short, high-intent)

**Onboarding (Day 1–2, no visit yet)**  
- “You’re in. Your first session is the one that counts. [Gym name] — see you on the floor.”  
- Boxing/Karate: “You’re in. Your first class is waiting. [Gym name].”

**Onboarding (Day 4–5, still no visit)**  
- “Most people who stick with it show up in the first week. Your spot is ready.”  
- Class: “Your first week is the best time to lock in. [Class name] — [day/time].”

**3-day at-risk**  
- “You’re one session away from being back on track. [Gym name].”  
- With typical day: “Your usual [e.g. Tuesday] slot is open. One session resets the rhythm.”

**7-day at-risk**  
- “Your goal doesn’t take a break. One session and you’re back in the rhythm. [Gym name].”  
- Class: “One class puts you back on track. [Next class] — [day/time].”

**14-day at-risk**  
- “One session resets the rhythm. You’ve done it before — [Gym name], when you’re ready.”  
- Slightly more direct; still no guilt.

**Weekly momentum (on-track)**  
- “Week [N] is where the habit sticks. Same time next week?”  
- “You’ve shown up [X] times. That’s the habit. Keep it going.”

**Milestone (streak)**  
- “[X] days in a row. This is who you are now. Keep going.”  
- “[X] sessions. You’re not the same person who walked in the first day.”

**Renewal (7 days before expiry)**  
- “Your access runs through [date]. Renew to keep your momentum. [Link/CTA].”  
- “Your [monthly/quarterly] access ends [date]. Renew and keep the habit. [CTA].”

**Daily pass**  
- “Your pass is valid today. [Gym name] — doors open [time]. See you there.”

### 3.3 What we avoid

- “We miss you.” / “We haven’t seen you.”
- “Don’t forget about us.” / “Remember us?”
- “Just checking in!” (without a clear next action)
- “Hope you’re doing well” as opener only
- Multiple CTAs in one message
- Emoji overload (one at most, or none for premium tone)

---

## 4. Notification System Design

### 4.1 Channels and Purpose

| Channel | Purpose | When to use |
|---------|--------|-------------|
| **Push** | Time-sensitive nudge; one clear action. | Onboarding, rescue (3/7/14d), daily pass, renewal urgency. |
| **In-app pop-up** | Contextual moment (e.g. after login, or when opening app on a “gym day”). | Onboarding, milestone, or “today is your usual day” reminder. |
| **In-app inbox (bell)** | Record of message; no immediate interrupt. | All retention messages also stored as notification for history. |

Every message is tied to a **trigger** and **segment**; no ad-hoc or random sends.

### 4.2 Push: Templates and Timing Rules

- **Template key** — One per segment × trigger (e.g. `retention_onboarding_day2_no_visit`, `retention_rescue_7d`, `retention_renewal_7d`).
- **Variables** — `{gym_name}`, `{first_name}`, `{day}`, `{time}`, `{date}`, `{streak}`, `{visit_count}`, `{class_name}`, `{plan_end_date}` as needed.
- **Timing**  
  - **Quiet hours** — Use `users.quiet_hours` (e.g. 22:00–07:00); no push in that window.  
  - **Preferred time** — If `typical_gym_time` exists, send within ±1 hour of that time when possible (e.g. morning reminder before their usual slot).  
  - **Fallback** — 09:00–11:00 or 17:00–19:00 local (configurable), outside quiet hours.  
- **Frequency cap** — Max 1 retention push per user per day; max 2 per week for rescue (escalate 3d → 7d → 14d, don’t send all in one week). Use `can_send_notification(p_user_id)` and a retention-specific cap (e.g. 1 retention push per day in addition to existing 7/day total).

### 4.3 In-App Pop-Ups: UI Intent and Timing

- **Intent** — One primary action: “Plan first visit,” “See classes,” “Renew,” “View progress.”  
- **When shown**  
  - After login: only if segment = onboarding and 0 visits (once per day max).  
  - After login: if at-risk 7d or 14d and no retention pop-up in last 3 days (once per session).  
  - On milestone: after check-in when streak or visit count crosses threshold (once per milestone).  
- **Dismissal** — Clear “Later” or “Dismiss”; no dark patterns. Storing “dismissed at” to avoid repeat same day.

### 4.4 Frequency Caps (No Annoyance)

| Rule | Value | Scope |
|------|--------|--------|
| Retention push per user per day | 1 | All retention campaigns |
| Retention push per user per week | 3 | All retention campaigns |
| Min hours between any push | 2 | Use existing `can_send_notification` |
| Max touchpoints per day (all types) | 7 | Existing `notification_touchpoints_today` |
| In-app retention pop-up per user per day | 1 | Retention pop-ups only |
| In-app retention pop-up per session | 1 | Per app open |

Rescue sequence: send 3d once; if no check-in, send 7d once; if still no check-in, send 14d once. Do not send 3d and 7d in the same week.

### 4.5 Quiet Hours and Smart Timing

- **Quiet hours** — From `users.quiet_hours` (e.g. `{"start": "22:00", "end": "07:00"}`). No push in this window.  
- **Smart timing** — For “usual gym day” reminders, send in the 2-hour window before `typical_gym_time` on one of `typical_gym_days`.  
- **Timezone** — Use `users.timezone` (e.g. Africa/Nairobi) for all send-time calculations.

### 4.6 Notification Creation and Logging

- **Create** — On trigger evaluation (cron or event-driven), insert into `notifications` (member-facing) with `type`/`title`/`body` and link to retention campaign/template.  
- **Log** — Insert into `notifications_sent` with `notification_type` = e.g. `retention_onboarding_day2`, `retention_rescue_7d`, `retention_milestone_streak_7`, so analytics and caps can be enforced.  
- **Templates** — Store retention templates in `notification_templates` with category e.g. `retention_onboarding`, `retention_rescue`, `retention_milestone`, `retention_renewal`; reference from `notification_rules` for trigger_config and template_ids.

---

## 5. Campaign Structure

### 5.1 Day 0–7 Onboarding Retention

| Step | Trigger | Segment | Action | Channel |
|------|--------|--------|--------|---------|
| O1 | Approved, 0 visits, Day 1 | New, any plan | “You’re in. First session counts.” | Push |
| O2 | Approved, 0 visits, Day 3 | New, any plan | “Your spot is ready.” (or class variant) | Push |
| O3 | Approved, 0 visits, Day 5 | New, any plan | “Most people who stick show up in the first week.” | Push + optional in-app |
| O4 | First check-in, Day 0 | New, 1 visit | “First session done. Week 1 is where the habit sticks.” | In-app only (post check-in) |

No more than 3 onboarding pushes in 7 days; respect quiet hours and 1 push/day cap.

### 5.2 Weekly Momentum Loops

| Step | Trigger | Segment | Action | Channel |
|------|--------|--------|--------|---------|
| W1 | Start of week (e.g. Monday); user had 2+ visits last week | On-track / high | “Week [N]. Same time this week?” or “You’ve shown up X times. Keep it going.” | Push (once per week) |
| W2 | User opens app on typical_gym_day, no check-in yet today | On-track, has typical_gym_days | In-app: “Today’s a gym day. Ready when you are.” | In-app pop-up |

### 5.3 Inactivity Rescue (3d, 7d, 14d)

| Step | Trigger | Segment | Action | Channel |
|------|--------|--------|--------|---------|
| R3 | Last check-in &gt; 3 days | At-risk 3d, not daily pass | “One session away from back on track.” | Push |
| R7 | Last check-in &gt; 7 days (and no check-in after R3) | At-risk 7d | “Your goal doesn’t take a break. One session, back in rhythm.” | Push |
| R14 | Last check-in &gt; 14 days (and no check-in after R7) | At-risk 14d | “One session resets the rhythm. You’ve done it before.” | Push + optional in-app |

Only one rescue tier active per user at a time; advance from 3d → 7d → 14d as time passes without visit.

### 5.4 Milestone Reinforcement

| Step | Trigger | Segment | Action | Channel |
|------|--------|--------|--------|---------|
| M1 | Streak = 3, 7, or 14 (gym_visit or check_in) | Any with streak | “[X] days in a row. This is who you are now.” | In-app after check-in or push next day |
| M2 | Visit count = 5, 10, 25, 50 | Any | “[X] sessions. You’re not the same person who walked in day one.” | In-app after check-in |

One message per milestone; do not repeat same milestone.

### 5.5 Membership Renewal and Expiry

| Step | Trigger | Segment | Action | Channel |
|------|--------|--------|--------|---------|
| E1 | Plan end in 30 days | Monthly / medium / long | “Your access runs through [date]. Renew to keep your momentum.” | Push |
| E2 | Plan end in 7 days | Same | “Your access ends [date]. Renew and keep the habit.” | Push + in-app CTA |
| E3 | Plan expired (grace period, e.g. 1 day) | Same | “Your access has ended. Renew to get back in.” | Push |

Only for plans with a known end date (from payment or plan duration).

### 5.6 Campaign Priority (When Multiple Apply)

1. **Renewal/expiry** (E2, E3) — highest (time-bound).  
2. **Onboarding** (O1–O3) — high (first 7 days).  
3. **Rescue** (R14 &gt; R7 &gt; R3) — medium; only one tier per user.  
4. **Daily pass** — single send on valid day.  
5. **Momentum** (W1, W2) — lower; don’t send same day as rescue.  
6. **Milestone** — send when triggered; doesn’t block others but counts toward daily cap.

---

## 6. Visual and UX Requirements for Pop-Ups

### 6.1 Layout

- **Container** — Modal or bottom sheet; clear boundary from rest of app.  
- **Header** — Short title (e.g. “You’re in,” “One session,” “Your week”) or gym logo + one line.  
- **Body** — 1–2 sentences max; same tone as copywriting section.  
- **Primary CTA** — One button (e.g. “Plan my visit,” “See classes,” “Renew,” “View progress”).  
- **Secondary** — “Later” or “Dismiss” (text or low-emphasis button).  
- **No** — Multiple CTAs, long paragraphs, or “remind me tomorrow” that could spam.

### 6.2 CTA Wording (Exact Intent)

| Context | Primary CTA | User action we want |
|---------|-------------|----------------------|
| Onboarding, no visit | “Plan my first visit” or “See opening hours” | Opens schedule or gym info / check-in prep |
| Rescue (3/7/14d) | “Book a session” or “See classes” | Opens booking or class list or gym home |
| Milestone | “Keep going” or “View my progress” | Opens dashboard or progress |
| Renewal | “Renew now” | Opens payments / renewal flow |
| Weekly momentum | “See this week” or “I’ll be there” | Opens schedule or dismisses (intent recorded) |

CTA must match one clear next action; no vague “OK” or “Learn more” for retention.

### 6.3 Tone in Pop-Up

- **Confident and premium** — Same as copy: identity and goal, no guilt.  
- **Short** — Headline + one line body, or body only if headline is the message.  
- **Respectful** — “Later” is a valid choice; no pressure.

### 6.4 Exact User Action We Want Next

- **Onboarding** → Open app to schedule or see gym/class info; then show up.  
- **Rescue** → Open app and either book or show up.  
- **Milestone** → Acknowledge and continue (view progress or dismiss).  
- **Renewal** → Tap “Renew” and complete payment.

Tracking: log CTA tap (which button) and, if possible, downstream action (e.g. “opened payments,” “completed renewal”) for analytics.

---

## 7. Implementation Notes (Schema / Logic)

- **Segmentation** — Implement as a function or view: inputs `user_id`, `gym_id`; outputs segment dimensions (membership_type, training_category, attendance_bucket, new_vs_returning, at_risk_tier). Use `membership`, `attendance_logs`, `gym_membership_plans` (via payment or membership link to plan), and optionally `user_streaks`.  
- **Trigger evaluation** — Cron (e.g. daily) or event-driven (e.g. after check-in, after payment). For each active gym_access member, compute segment; then select single campaign from priority order; then check frequency caps and quiet hours; then create notification and log to `notifications_sent`.  
- **Templates** — Add retention template keys to `notification_templates` and retention rules to `notification_rules`; reference template_ids from rules.  
- **Training category** — If not in schema, add to `gym_membership_plans` (e.g. `training_category TEXT`) or derive from `plan_name` until then.

---

## 8. Summary

- **Segmentation** is by membership type, training category, attendance frequency, new vs returning, and at-risk tier; each segment drives a specific retention action.  
- **Strategy** per segment has a clear goal, behavioral trigger, and messaging angle; no generic “we miss you.”  
- **Copy** is short, identity- and goal-focused, confident, and never desperate.  
- **Notifications** use push + in-app pop-ups with strict caps, quiet hours, and smart timing.  
- **Campaigns** are onboarding (Day 0–7), weekly momentum, inactivity rescue (3/7/14d), milestones, and renewal/expiry; priority and one-primary-campaign-per-user rules avoid spam.  
- **Pop-ups** have a defined layout, single primary CTA, and clear intended next action.

This completes the gym-side retention design. Events retention can be designed next with the same segmentation, strategy, copy, notification, and campaign discipline applied to event-specific triggers and segments.
