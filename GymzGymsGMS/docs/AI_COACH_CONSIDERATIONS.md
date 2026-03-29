# AI Coach: Considerations Left Out (and What to Do)

This doc lists important considerations that were **not** fully covered by the Personal Nutrition & Performance Coach role and context work. Use it as a checklist for future improvements.

---

## 1. **Safety & liability**

- **Medical boundary**: The AI should not give medical advice. It should recommend seeing a doctor or dietitian for: eating disorders, pregnancy, diabetes, heart conditions, allergies (especially anaphylaxis), or when the user describes serious symptoms.
- **Allergies**: There is no dedicated `allergies` column. If the user mentions an allergy, it should be stored (e.g. in `key_memories` with a prefix like "Allergy: nuts") and the AI must never suggest foods that could trigger it. Consider adding an `allergies` column and surfacing it prominently in the system prompt.
- **Action**: Add a short "SAFETY" block to the base system prompt (in DB and/or default prompt): e.g. "You are a coach, not a doctor. Do not give medical or diagnostic advice. For eating disorders, allergies, pregnancy, or chronic conditions, recommend they speak to a doctor or dietitian. Never suggest foods that conflict with stated allergies."

---

## 2. **Context already fetched but not in the system summary**

- **gold_hour** (preferred workout time): Fetched in profile but not in `buildUserSystemSummary`. Useful for meal timing and "train at X" advice.
- **primary_goal** / **qualitative_hooks** from `user_ai_memory`: Not in the summary. Would help the AI sound more personalized (e.g. "Training for a wedding").
- **dietary_preferences** (in `user_ai_memory`, e.g. keto, sweet_tooth): Different from `users.dietary_restrictions`. Not surfaced; would improve nutrition personalization.
- **workout_preferences** (e.g. morning_crew, cardio_hater): In `user_ai_memory` but not in summary. Useful for tone and workout suggestions.
- **Action**: Add these to `buildUserSystemSummary` (e.g. "Preferred workout time: {gold_hour}. Memory primary_goal / qualitative_hooks. Dietary preferences: … Workout preferences: …") or at least the ones that fit in the token budget.

---

## 3. **Key memories cap**

- Only the **first 3** key_memories are shown (`slice(0, 3)`). For deep personalization (e.g. allergies, injuries, events) more might be needed.
- **Action**: Increase to 5–7 or make it configurable; or add a rule: "If any key_memory contains 'Allergy:' or 'Injury:', always treat it as critical."

---

## 4. **Time and first message**

- **server_time** / **is_first_message_today** are in `contextData` but not in the system summary. The AI could use them for "Good morning" vs "Good evening" and for a warmer first message of the day.
- **Action**: Add one line to the summary, e.g. "Current time (UTC): {server_time}. First message today: yes/no."

---

## 5. **GMS (web) coach parity**

- **MemberAIChat** and **AdminAIChat** in GMS call `sendMessageToAI` → `sendToOpenAIChat` **without** passing a built system prompt. So the Edge Function gets no user-specific block (no profile, today's nutrition, memory, dietary restrictions, etc.).
- **Action**: In GMS, before calling the OpenAI chat:
  - Fetch the same context (profile, goals, today stats, memory, etc.) — either by reusing the same logic as the mobile app or by adding a small API/Edge Function that returns `getUserFullContext(userId)` and then building the same `buildUserSystemSummary` (or a shared helper).
  - Pass `basePrompt + userSummary` as `system_prompt` to the Edge Function so web and mobile get the same level of personalization.

---

## 6. **Language / locale**

- No `preferred_language` or locale in profile or summary. For a global product, the AI could adapt language or slang.
- **Action**: If you add a language/locale field, include it in the summary and instruct the AI to match language when appropriate.

---

## 7. **Token budget**

- Adding more context (gold_hour, qualitative_hooks, more key_memories, time, etc.) increases tokens per request. Monitor context length and model limits.
- **Action**: Prefer a compact format; optionally truncate or summarize key_memories if over N items; consider a "lite" summary for very long contexts.

---

## 8. **Make.com webhook**

- When provider is Make (not OpenAI), the mobile app sends the full enhanced prompt (base + user summary). Make must receive and use that payload as the system prompt. Confirm the Make scenario uses the same payload so behavior matches.

---

## Summary table

| Consideration                   | Status         | Suggested action                                   |
|---------------------------------|----------------|----------------------------------------------------|
| Safety / medical boundary       | Not in prompt  | Add SAFETY block to system prompt                  |
| Allergies                       | No dedicated   | key_memory or allergies column                     |
| gold_hour                       | Fetched only   | Add to buildUserSystemSummary                      |
| qualitative_hooks/primary_goal  | Not in summary | Add to MEMORY or WHO YOU ARE TALKING TO             |
| dietary_preferences (memory)    | Not in summary | Add next to dietary_restrictions                   |
| workout_preferences             | Not in summary | Add to summary if token budget allows              |
| Key memories cap (3)            | Limited        | Increase or add Allergy/Injury rule                 |
| server_time / first msg         | In data only   | Add one line to summary                            |
| GMS web coach                   | No user context | Build and pass same system prompt as mobile          |
| Language/locale                 | Missing        | Add when you have the field                        |
| Token budget                    | —              | Monitor; keep summary compact                      |
