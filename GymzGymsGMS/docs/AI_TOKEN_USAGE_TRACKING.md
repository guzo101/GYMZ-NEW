# AI Token Usage Tracking System

## Final schema and integration points

### Database tables (migration: `20260312_ai_token_tracking_system.sql`)

| Table | Purpose |
|-------|--------|
| **ai_token_usage** | One row per AI request. Fields: id, user_id, gym_id, feature_type, tokens_input, tokens_output, tokens_total, model_used, request_cost_usd, user_gender, user_age_group, created_at. |
| **ai_token_usage_summary** | Monthly aggregates per gym: gym_id, month, year, total_tokens_used, total_cost_usd, total_requests, tokens_by_feature (JSONB). |
| **ai_token_limits** | Per-gym / per-feature controls: gym_id, feature_type, daily_token_limit, user_daily_limit, cooldown_seconds, is_feature_enabled. |
| **ai_token_balance** | Platform token accounting: tokens_purchased, purchase_cost_usd, purchased_at, tokens_used_total, tokens_remaining (generated). |

### RPCs

- **refresh_ai_token_usage_summary(p_gym_id, p_year, p_month)** — Aggregates `ai_token_usage` for that gym/month into `ai_token_usage_summary`. Call after bulk imports or periodically.
- **get_ai_token_usage_totals()** — Returns `{ total_tokens_used }` for the platform (platform_admin only). Used by OAC balance card.

### Centralized logging and limits

- **`GymzGymsGMS/src/services/aiTokenUsage.ts`**
  - `logTokenUsage(params)` — Inserts one row into `ai_token_usage`. Use when you have **actual** token counts (e.g. from OpenAI response or webhook).
  - `checkTokenLimits(gymId, userId, featureType)` — Returns `{ allowed, reason? }`. Call before any AI request to enforce daily limits and cooldown.
  - `fetchUserDemographics(userId)` — Returns gender/age for logging.

- **`GymzGymsGMS/src/services/aiChat.ts`**
  - **`sendMessageToAI(senderType, userId, threadId, chatId, message, options?)`** — **Single entry point for UI.** Reads `ai_provider` from `ai_settings`; if `openai`, calls Edge Function `openai-chat` (which logs usage server-side); if `make`, calls webhook and logs usage when the webhook response includes `usage`.
  - `sendToOpenAIChat(...)` — Calls Supabase Edge Function `openai-chat`; usage is logged inside the function.
  - `sendToMakeAI(..., options?)` — Calls Make webhook; runs `checkTokenLimits`; if response has `usage`, calls `logTokenUsage`.
  - `sendToMakeAIWithCommunityChat(..., options?)` — Same for community chat; limit check and optional usage logging.

### Integration points (where every AI request must be tracked)

| Feature | Where it’s called | How it’s tracked |
|--------|-------------------|------------------|
| **AI Chat (admin)** | `AdminAIChat.tsx` → `sendMessageToAI()` | Provider openai → Edge Function logs. Provider make → webhook; log if response has `usage`. |
| **AI Chat (member)** | `MemberAIChat.tsx` → `sendMessageToAI()` | Same as above. |
| **Community chat** | `aiChat.ts`: `sendToMakeAIWithCommunityChat`, `sendMessageToWebhookImmediately`, `processNoticeBoardConversations` | Limit check before send; log when webhook returns `usage`. |
| **Food scan / Nutrition AI** | (Wherever OpenAI or webhook is called for scan) | Call `logTokenUsage()` after the API response with real `usage` (or use an Edge Function that logs). |

**Important:** Do not guess token numbers. Use the **actual token usage** from the OpenAI API response (e.g. `response.usage.prompt_tokens`, `response.usage.completion_tokens`) or from a webhook that returns the same.

### OAC dashboard

- **Route:** `/token-analytics` (OAC app).
- **Page:** `OAC/src/pages/TokenAnalytics.tsx`.
- **Features:**
  - Filters: gym, feature type, time range (today / week / month / year).
  - Metrics: total tokens used, total cost USD, total requests, tokens remaining (purchased − all-time used).
  - Charts: token usage by gym (bar), by feature (pie), monthly trend (bar).
  - Top token-consuming users table.
  - Token limits table (read-only list of `ai_token_limits`).
  - Token purchases: “Record purchase” dialog inserts into `ai_token_balance`.

### Token control (Phase 5)

- Limits are stored in **ai_token_limits** (per gym and optionally per feature_type; use `ALL` for gym-wide).
- **checkTokenLimits()** is called inside `sendToMakeAI` and `sendToMakeAIWithCommunityChat` before sending. When using **sendMessageToAI()**, the openai path uses the same limits (Edge Function can enforce server-side if desired; currently limits are enforced in client before calling).
- OAC Token Analytics page shows existing limits; adding/editing limits can be done via Supabase dashboard or a future “Set limit” form (table and RLS are ready).

### Platform token accounting (Phase 6)

- **ai_token_balance**: Record purchases with “Record purchase” in OAC (tokens_purchased, purchase_cost_usd, notes).
- **Remaining balance** in the dashboard: `sum(ai_token_balance.tokens_purchased) − get_ai_token_usage_totals().total_tokens_used`.

### Verification checklist (Phase 7)

- [ ] Apply migration `20260312_ai_token_tracking_system.sql`.
- [ ] Deploy Edge Function `openai-chat` (Supabase Dashboard or `supabase functions deploy openai-chat`). Set `OPENAI_API_KEY` or ensure `ai_settings.openai_api_key` is set when using provider “openai”.
- [ ] Ensure every AI request path either: (1) goes through `sendMessageToAI` / `sendToMakeAI` / `sendToMakeAIWithCommunityChat`, or (2) calls `logTokenUsage()` after receiving real usage.
- [ ] Confirm token usage appears in OAC Token Analytics (filters: gym, feature, time range).
- [ ] Confirm totals match OpenAI (or webhook) usage when using the openai path or when webhook returns usage.
- [ ] Set a limit in `ai_token_limits` and confirm it blocks or throttles as intended.
- [ ] Record a purchase in OAC and confirm “Tokens remaining” updates.

### Feature types (enum)

`AI_CHAT` | `COMMUNITY_CHAT` | `FOOD_SCAN` | `AI_COACH` | `NUTRITION_AI` | `OTHER`

Use these in `ai_token_usage.feature_type` and `ai_token_limits.feature_type` (and `ALL` for gym-wide limits).

### Troubleshooting: “Coach chats not showing in OAC token spend”

1. **Only OpenAI path logs to `ai_token_usage` from GMS.**  
   In GMS, member/admin AI chat uses `sendMessageToAI()`. If the gym’s active AI provider is **openai**, each message goes to the Edge Function `openai-chat`, which inserts one row into `ai_token_usage`. If the provider is **make**, tokens are only logged when the webhook response includes `usage`; otherwise coach chats will not appear in OAC.  
   **Fix:** Use **OpenAI** as the AI provider in AI Settings if you need coach/member chat to appear in Token Analytics.

2. **Members must have `gym_id` set.**  
   When provider is openai, `sendMessageToAI` requires the user to have `gym_id`; otherwise it throws and the message is not sent (and not logged).  
   **Fix:** Ensure each member has `users.gym_id` set to their gym.

3. **OAC must be able to read `users` for the embed.**  
   Token Analytics embeds `users(name, email)` into `ai_token_usage`. If RLS on `users` blocks the platform admin, usage rows still load but names/emails show as blank or as a short user id.  
   **Fix:** Apply migration `20260407_platform_admin_users_select_for_token_analytics.sql` so `is_platform_admin()` can SELECT from `public.users`. Then OAC will show user names in the “Top token-consuming users” table and related views.
