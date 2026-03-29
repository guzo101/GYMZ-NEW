# AI token usage diagnostic (study case: bnn@gmail.com)

Use these **facts-only** checks to see why tokens are or are not in OAC. Run in Supabase SQL Editor against the same project GMS and OAC use.

---

## 1. User row (id, gym_id, email)

```sql
SELECT id, email, gym_id, role
FROM public.users
WHERE email = 'bnn@gmail.com';
```

**Facts:** If `gym_id` is NULL and the active AI provider is **openai**, `sendMessageToAI` throws and the user cannot get a reply. If the user gets replies, either `gym_id` is set or the provider is **make**.

---

## 2. Active AI config (single row for the whole app)

```sql
SELECT id, is_active, ai_provider, webhook_url IS NOT NULL AS has_webhook
FROM public.ai_settings
WHERE is_active = true;
```

**Facts:** Only one row has `is_active = true` (unique partial index). `getAIProvider()` returns `'openai'` only when `ai_provider = 'openai'`; otherwise it returns `'make'`. So:

- If `ai_provider` is not exactly `'openai'`, **all** member/admin AI chat uses **Make** (webhook). Tokens are written to `ai_token_usage` only when the webhook response includes `usage.prompt_tokens` and `usage.completion_tokens`. If the webhook does not return that, **no row is inserted** and usage is “unrecorded”.

---

## 3. Conversations (proof the user chatted and got replies)

```sql
SELECT c.id, c.user_id, c.sender, c.timestamp, LEFT(c.message, 60) AS message_preview
FROM public.conversations c
JOIN public.users u ON u.id = c.user_id
WHERE u.email = 'bnn@gmail.com'
ORDER BY c.timestamp DESC
LIMIT 20;
```

**Facts:** Rows with `sender = 'ai'` mean the user received an AI reply. If there are such rows but no matching `ai_token_usage` (see below), the reply came from the **Make** path and the webhook did not return usage (or provider is openai but insert failed, which would have returned 500 to the client).

---

## 4. Token usage rows for this user

```sql
SELECT u.email, atu.id, atu.feature_type, atu.tokens_total, atu.created_at
FROM public.ai_token_usage atu
JOIN public.users u ON u.id = atu.user_id
WHERE u.email = 'bnn@gmail.com'
ORDER BY atu.created_at DESC
LIMIT 20;
```

**Facts:** If this returns 0 rows while (3) shows AI replies, then:

- Either the active provider is **make** and the webhook never returns `usage`, so `logTokenUsage` is never called, or  
- The provider is **openai** but the Edge Function insert failed (then the client would have seen an error, not a reply).

---

## 5. One-shot diagnostic (all above in one script)

Replace `'bnn@gmail.com'` if needed.

```sql
-- User
SELECT 'USER' AS step, id, email, gym_id, role FROM public.users WHERE email = 'bnn@gmail.com';

-- Active AI config (global)
SELECT 'AI_SETTINGS' AS step, id, is_active, ai_provider FROM public.ai_settings WHERE is_active = true;

-- Recent conversations for this user
SELECT 'CONVERSATIONS' AS step, c.sender, c.timestamp, LEFT(c.message, 50) AS msg
FROM public.conversations c
JOIN public.users u ON u.id = c.user_id
WHERE u.email = 'bnn@gmail.com'
ORDER BY c.timestamp DESC LIMIT 10;

-- Token usage for this user
SELECT 'AI_TOKEN_USAGE' AS step, atu.feature_type, atu.tokens_total, atu.created_at
FROM public.ai_token_usage atu
JOIN public.users u ON u.id = atu.user_id
WHERE u.email = 'bnn@gmail.com'
ORDER BY atu.created_at DESC LIMIT 10;
```

---

## Summary (code-backed)

| Fact | Location in code |
|------|------------------|
| Provider is one global value | `ai_settings` single row with `is_active = true`; `getAIProvider()` in `aiChat.ts` |
| OpenAI path writes every request | Edge Function `openai-chat/index.ts` inserts into `ai_token_usage` after OpenAI call |
| Make path writes only when webhook returns usage | `sendToMakeAI` in `aiChat.ts`: `logTokenUsage` only if `data.usage.prompt_tokens` and `data.usage.completion_tokens` are numbers |
| If provider is make and webhook does not return usage | No `logTokenUsage` call → no row → “tokens unrecorded” while user still gets replies |

So for bnn@gmail.com: if he gets replies but has no rows in `ai_token_usage`, the active provider is **make** and the webhook response does not include `usage`.

**Code fix (done):** When the provider is Make and the webhook returns a reply but **no** `usage`, the app now still inserts one row into `ai_token_usage` with `tokens_input = 0`, `tokens_output = 0` (so the request is visible in OAC; token count is “unknown from Make”, not guessed). This applies to both direct AI chat (`sendToMakeAI`) and community chat (`sendToMakeAIWithCommunityChat`), and only when the user has a `gym_id` (required for the insert).

**Other options:** (1) Set active config to **OpenAI** so every request goes through the Edge Function and gets real token counts. (2) Have the Make scenario return `usage: { prompt_tokens, completion_tokens }` in the response so real tokens are logged.
