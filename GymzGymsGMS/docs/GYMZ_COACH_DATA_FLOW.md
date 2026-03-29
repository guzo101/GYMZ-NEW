# AI Coach (AI Chat) – Structure and Data Mapping

Step-by-step view of where the coach lives in the app, the JSON at each layer, and how data maps into the DB (including `ai_token_usage` for OAC).

---

## 1. Where the coach lives in the app

| What | Where |
|------|--------|
| **Member-facing coach** | GMS route `/member/ai-chat` → component `MemberAIChat.tsx` |
| **Sidebar label** | "AI Chat" (MemberSidebar) |
| **Screen title** | "AI Assistant" |
| **Admin-facing chat** | GMS route `/admin/ai-chat` → `AdminAIChat.tsx` (same backend, `senderType: "admin"`) |

There is no separate "AI Coach" product name in the member UI; the coach is this **AI Chat / AI Assistant** backed by `sendMessageToAI()` and (when provider is OpenAI) the Edge Function that writes to `ai_token_usage`.

---

## 2. Tables involved

| Table | Purpose |
|-------|--------|
| **conversations** | One row per message (user / admin / ai). Persists chat history. |
| **users** | `thread_id` = permanent thread per user; used to group conversations. |
| **ai_settings** | Active AI provider (`openai` vs `make`), webhook, API key, etc. |
| **ai_token_usage** | One row per AI request when using OpenAI path; used by OAC Token Analytics. |

---

## 3. JSON and data flow (step by step)

### Step A – User sends a message in the coach (MemberAIChat)

**UI:** User types in the "AI Assistant" chat and sends.

**1) Store user message in `conversations`**

`storeMessage(user.id, threadId, chatId, "user", userMessage)` inserts one row.

**JSON shape of one `conversations` row:**

```json
{
  "user_id": "0312fa84-36ba-479e-ad3b-ed7e8aa4c9fb",
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "chat_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "sender": "user",
  "message": "How do I start with weights?",
  "timestamp": "2026-03-11T17:46:17.000Z"
}
```

- **thread_id**: From `users.thread_id` or created once per user; never changes.
- **chat_id**: Session; same until "New Chat" / "Clear" or 24h inactivity.
- **sender**: `"user"` | `"admin"` | `"ai"`.

**Schema (conversations):**  
`id`, `user_id`, `thread_id`, `chat_id`, `sender`, `message`, `timestamp`, `created_at`.

---

**2) Call AI: `sendMessageToAI("user", user.id, threadId, chatId, userMessage, { gymId, featureType: "AI_CHAT" })`**

- Reads **ai_settings** (active row): `ai_provider`, `webhook_url`, etc.
- If `ai_provider === "openai"`: calls **Edge Function** `openai-chat` (next step).
- If `ai_provider === "make"`: calls Make webhook (different payload; token logging only if webhook returns `usage`).

---

### Step B – Request from GMS to Edge Function (OpenAI path)

**Request:** `POST /functions/v1/openai-chat`  
**Headers:** `Authorization: Bearer <user's Supabase access_token>`, `Content-Type: application/json`

**Body JSON (exact shape from `sendToOpenAIChat`):**

```json
{
  "user_id": "0312fa84-36ba-479e-ad3b-ed7e8aa4c9fb",
  "gym_id": "c9e45177-aaca-4771-9a75-17ceeab98094",
  "feature_type": "AI_CHAT",
  "message": "How do I start with weights?",
  "system_prompt": null,
  "model": null,
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "chat_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
}
```

**Field mapping (GMS → body):**

| Body key | Source |
|----------|--------|
| `user_id` | `user.id` (from useAuth) |
| `gym_id` | `user.gym_id` (required when provider is openai) |
| `feature_type` | Always `"AI_CHAT"` for member/admin AI chat (coach) |
| `message` | User’s message text |
| `system_prompt` | Optional; from ai_settings or context |
| `model` | Optional; defaults to `gpt-4o-mini` in Edge Function |
| `thread_id` | From `getOrCreateThreadId(user.id)` |
| `chat_id` | From `getOrCreateChatId(user.id, threadId)` |

---

### Step C – Edge Function: OpenAI call and DB writes

1. Validates `user_id`, `gym_id`, `feature_type`, `message`.
2. Calls OpenAI `chat/completions` with `message` (and optional `system_prompt`).
3. Reads from **users**: `gender`, `age` (for demographics on the usage row).
4. Inserts **one row** into **ai_token_usage** (this is what OAC Token Analytics reads).

**JSON shape of one `ai_token_usage` row (as written by Edge Function):**

```json
{
  "user_id": "0312fa84-36ba-479e-ad3b-ed7e8aa4c9fb",
  "gym_id": "c9e45177-aaca-4771-9a75-17ceeab98094",
  "feature_type": "AI_CHAT",
  "tokens_input": 8,
  "tokens_output": 27,
  "tokens_total": 35,
  "model_used": "gpt-4o-mini",
  "request_cost_usd": "0.000017",
  "user_gender": null,
  "user_age_group": null
}
```

**Mapping (Edge Function → ai_token_usage):**

| ai_token_usage column | Source |
|------------------------|--------|
| `user_id` | Request body `user_id` |
| `gym_id` | Request body `gym_id` |
| `feature_type` | Request body `feature_type` (e.g. `AI_CHAT`) |
| `tokens_input` | `usage.prompt_tokens` from OpenAI response |
| `tokens_output` | `usage.completion_tokens` from OpenAI response |
| `tokens_total` | `tokens_input + tokens_output` |
| `model_used` | Body `model` or default `gpt-4o-mini` |
| `request_cost_usd` | Computed from model pricing × tokens |
| `user_gender` | `users.gender` for `user_id` |
| `user_age_group` | Derived from `users.age` (e.g. `25_34`) |
| `created_at` | Default `NOW()` |

5. Edge Function returns to GMS:

```json
{
  "reply": "...",
  "thread_id": "...",
  "chat_id": "...",
  "usage": { "prompt_tokens": 8, "completion_tokens": 27, "total_tokens": 35 },
  "model_used": "gpt-4o-mini"
}
```

---

### Step D – GMS stores AI reply and updates UI

- `storeMessage(user.id, threadId, response.chat_id, "ai", response.reply)` → another **conversations** row with `sender: "ai"`.
- UI appends the AI message to the chat.

**Conversations row for the AI reply:**

```json
{
  "user_id": "0312fa84-36ba-479e-ad3b-ed7e8aa4c9fb",
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "chat_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "sender": "ai",
  "message": "You can start with weights by...",
  "timestamp": "2026-03-11T17:46:18.000Z"
}
```

---

## 4. End-to-end mapping summary

| Data | conversations (per message) | openai-chat request body | ai_token_usage (per AI request) |
|------|-----------------------------|---------------------------|----------------------------------|
| Who | `user_id` | `user_id` | `user_id` |
| Gym | – | `gym_id` | `gym_id` |
| Feature | – | `feature_type`: `"AI_CHAT"` | `feature_type`: `"AI_CHAT"` |
| User text | `message` | `message` | – |
| Session | `thread_id`, `chat_id` | `thread_id`, `chat_id` | – |
| Sender | `sender`: user/admin/ai | – | – |
| Tokens/cost | – | – | `tokens_*`, `model_used`, `request_cost_usd` |
| Demographics | – | – | `user_gender`, `user_age_group` |

So: **conversations** = full chat history (user + AI messages). **ai_token_usage** = one row per AI call, used for OAC token spend; it does **not** store the message text, only `user_id`, `gym_id`, `feature_type`, token counts, and cost.

---

## 5. Why coach usage shows (or doesn’t) in OAC

- Rows **only** appear in **ai_token_usage** when the **OpenAI** path is used (Edge Function `openai-chat`). Make path does not write here unless the webhook returns `usage`.
- **OAC Token Analytics** reads `ai_token_usage` (with optional embed of `gyms`, `users`). The viewer must be allowed by RLS.
  - By default, the only SELECT policy was `platform_admin_ai_token_usage_all` (USING `is_platform_admin()`). So the request must be **authenticated** and the user’s `public.users.role` must be exactly `platform_admin` or `super_admin`. If the OAC app sent requests as **anon** (e.g. session not attached to the Supabase client), RLS returned 0 rows and token usage did not show.
  - **Fix:** Migration `20260408_oac_ai_token_usage_select_authenticated.sql` adds policy `oac_anon_select_ai_token_usage` so the **anon** role can SELECT from `ai_token_usage`. After applying it, the Token Analytics page can load coach (and all) token usage even when the request is unauthenticated. If you need to restrict token data to platform admins only, remove this policy and ensure OAC always sends the logged-in user’s JWT.
- **Time range** in OAC is based on `ai_token_usage.created_at`; your sample row has `created_at: "2026-03-11 17:46:17..."`, so filters must include that date (e.g. "This month" or "Last 7 days" including March 11).

This doc matches the current implementation: **AI coach** = member/admin AI Chat → `sendMessageToAI` → `openai-chat` → `ai_token_usage`; the JSON structures and mappings above are how its data is structured and mapped end to end.
