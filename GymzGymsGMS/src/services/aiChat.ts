import { supabase } from "@/integrations/supabase/client";
import { checkTokenLimits, logTokenUsage, type FeatureType } from "@/services/aiTokenUsage";

const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

/** Supabase project URL for Edge Function calls (must match Supabase client) */
function getSupabaseUrl(): string {
  return (supabase as any).supabaseUrl ?? "https://bivgvttxaymcdnuvyugv.supabase.co";
}

/** UUID v4 - works when crypto.randomUUID is unavailable (older browsers) */
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a unique thread_id for a user
 * Thread_id is permanent and never changes
 */
export async function generateThreadId(): Promise<string> {
  return randomUUID();
}

/**
 * Generate a unique chat_id for a conversation session
 * Chat_id changes for new sessions
 */
export async function generateChatId(): Promise<string> {
  return randomUUID();
}

/**
 * Get or create thread_id for a user
 * Ensures every user has a permanent thread_id
 * Optimized to check users table first (faster than scanning conversations)
 */
export async function getOrCreateThreadId(userId: string): Promise<string> {
  try {
    // First check if user has thread_id in users table (faster lookup)
    const { data: userData, error: userError } = await db
      .from("users")
      .select("thread_id")
      .eq("id", userId)
      .maybeSingle();

    if (!userError && userData?.thread_id) {
      return userData.thread_id;
    }

    // If not in users table, check conversations table (fallback)
    const { data: lastConversation, error: fetchError } = await db
      .from("conversations")
      .select("thread_id")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.warn("Error fetching thread_id from conversations:", fetchError);
    }

    // If user has a thread_id from previous conversations, return it
    if (lastConversation?.thread_id) {
      // Optionally update users table for faster future lookups (non-blocking)
      db.from("users")
        .update({ thread_id: lastConversation.thread_id })
        .eq("id", userId)
        .catch(err => console.warn("Failed to update users.thread_id:", err));

      return lastConversation.thread_id;
    }

    // Generate new thread_id
    const newThreadId = await generateThreadId();

    // Optionally store in users table for faster future lookups (non-blocking)
    db.from("users")
      .update({ thread_id: newThreadId })
      .eq("id", userId)
      .catch(err => console.warn("Failed to store thread_id in users table:", err));

    return newThreadId;
  } catch (error) {
    console.error("Error in getOrCreateThreadId:", error);
    // Return a generated thread_id even on error to prevent blocking
    return await generateThreadId();
  }
}

/**
 * Get the most recent active chat_id for a user
 * Returns null if no active chat exists
 */
export async function getActiveChatId(
  userId: string,
  threadId: string
): Promise<string | null> {
  try {
    // Get the most recent message for this user/thread
    const { data: lastMessage, error } = await db
      .from("conversations")
      .select("chat_id, timestamp")
      .eq("user_id", userId)
      .eq("thread_id", threadId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch last message: ${error.message}`);
    }

    if (!lastMessage) {
      return null;
    }

    // Check if last message is within 24 hours
    const lastMessageTime = new Date(lastMessage.timestamp);
    const now = new Date();
    const hoursSinceLastMessage =
      (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastMessage < 24) {
      return lastMessage.chat_id;
    }

    // Chat is inactive (older than 24 hours)
    return null;
  } catch (error) {
    console.error("Error in getActiveChatId:", error);
    return null;
  }
}

/**
 * Get or create a chat_id for the current session
 * Creates new chat_id if none exists or if last chat is > 24h old
 */
export async function getOrCreateChatId(
  userId: string,
  threadId: string
): Promise<string> {
  const activeChatId = await getActiveChatId(userId, threadId);
  if (activeChatId) {
    return activeChatId;
  }
  // Generate new chat_id if no active chat
  return await generateChatId();
}

/**
 * Fetch the active webhook URL from ai_settings
 */
export async function fetchWebhookUrl(): Promise<string | null> {
  try {
    const { data, error } = await db
      .from("ai_settings")
      .select("webhook_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch webhook URL: ${error.message}`);
    }

    return data?.webhook_url || null;
  } catch (error) {
    console.error("Error fetching webhook URL:", error);
    return null;
  }
}

/**
 * Fetch active AI provider: 'make' | 'openai'
 */
export async function getAIProvider(): Promise<"make" | "openai"> {
  try {
    const { data, error } = await db
      .from("ai_settings")
      .select("ai_provider")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return "make";
    return (data.ai_provider === "openai" ? "openai" : "make") as "make" | "openai";
  } catch {
    return "make";
  }
}

/**
 * Get gym_id for a user (for token limits and logging)
 */
export async function getGymIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await db.from("users").select("gym_id").eq("id", userId).maybeSingle();
  if (error || !data?.gym_id) return null;
  return data.gym_id;
}

/**
 * Fetch full user context for the coach (profile, goals, today's stats, memory).
 * Same shape as Gymz getUserFullContext so the AI has the user's data and stops asking for it.
 */
export async function getCoachContext(userId: string): Promise<Record<string, unknown>> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const [
      profileResp,
      goalsResp,
      dailySummaryResp,
      memoryResp,
      weightHistoryResp,
      streaksResp,
      healthLogsResp,
      waterLogsResp,
    ] = await Promise.all([
      db.from("users").select("height, weight, target_weight, goal, primary_objective, first_name, last_name, age, gender, dietary_restrictions").eq("id", userId).maybeSingle(),
      db.from("user_fitness_goals").select("*").eq("user_id", userId).eq("is_active", true).maybeSingle(),
      db.from("daily_calorie_summary").select("*").eq("user_id", userId).eq("date", today).maybeSingle(),
      db.from("user_ai_memory").select("*").eq("user_id", userId).maybeSingle(),
      db.from("body_metrics").select("weight, date").eq("user_id", userId).order("date", { ascending: false }).limit(10),
      db.from("user_streaks").select("streak_type, current_streak").eq("user_id", userId),
      db.from("daily_health_logs").select("*").eq("user_id", userId).eq("date", today).maybeSingle(),
      db.from("water_logs").select("amount").eq("user_id", userId).eq("date", today),
    ]);

    const profile = profileResp?.data ?? {};
    const goals = goalsResp?.data ?? {};
    const dailySummary = dailySummaryResp?.data ?? { total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0 };
    const memory = memoryResp?.data ?? {};
    const weightHistory = weightHistoryResp?.data ?? [];
    const streaks = streaksResp?.data ?? [];
    const healthStats = healthLogsResp?.data ?? { steps: 0, sleep_minutes: 0, water_ml: 0 };
    const extraWater = (waterLogsResp?.data ?? []).reduce((sum: number, log: { amount?: number }) => sum + (log.amount ?? 0), 0);
    const totalWaterMl = (healthStats.water_ml ?? 0) + extraWater;
    const currentWeight = profile.weight ?? (weightHistory.length > 0 ? weightHistory[0].weight : null);

    const criticalGaps: string[] = [];
    if (!profile?.height) criticalGaps.push("height (CM)");
    if (!currentWeight) criticalGaps.push("weight (KG)");
    if (!profile?.gender) criticalGaps.push("gender");
    if (!profile?.goal && !profile?.primary_objective) criticalGaps.push("fitness goal");
    if (!profile?.age) criticalGaps.push("age");

    const perfLines: string[] = [];
    if (weightHistory?.length > 1) {
      const current = weightHistory[0].weight;
      const previous = weightHistory[weightHistory.length - 1].weight;
      const delta = (current - previous).toFixed(1);
      const days = Math.round((new Date(weightHistory[0].date).getTime() - new Date(weightHistory[weightHistory.length - 1].date).getTime()) / (1000 * 60 * 60 * 24));
      perfLines.push(`WEIGHT TREND: ${delta}kg over last ${days} days (Current: ${current}kg).`);
    } else if (currentWeight) perfLines.push(`CURRENT WEIGHT: ${currentWeight}kg.`);
    if (streaks?.length) perfLines.push(`STREAKS: ${streaks.map((s: { streak_type: string; current_streak: number }) => `${s.streak_type}: ${s.current_streak} days`).join(", ")}.`);
    if (dailySummary?.total_calories > 0) {
      const goal = dailySummary.daily_calorie_goal ?? dailySummary.calorie_goal;
      const remaining = (goal - dailySummary.total_calories).toFixed(0);
      perfLines.push(`NUTRITION: ${dailySummary.total_calories}kcal today, ${remaining}kcal remaining.`);
    }
    if (healthStats && (healthStats.water_ml != null || healthStats.steps != null)) {
      const waterL = ((totalWaterMl || 0) / 1000).toFixed(1);
      const steps = healthStats.steps ?? 0;
      const sleepH = ((healthStats.sleep_minutes ?? 0) / 60).toFixed(1);
      perfLines.push(`ACTIVITY: ${steps} steps. HYDRATION: ${waterL}L. SLEEP: ${sleepH}h.`);
    }
    const performance_summary = perfLines.length > 0 ? perfLines.join(" ") : "No historical data yet.";

    return {
      profile: { ...profile, weight: currentWeight },
      goals,
      today_stats: {
        ...dailySummary,
        steps: healthStats.steps ?? 0,
        water_ml: totalWaterMl,
        sleep_hours: (healthStats.sleep_minutes ?? 0) / 60,
      },
      memory,
      performance_summary,
      missing_critical_fields: criticalGaps,
    };
  } catch (e) {
    console.warn("[aiChat] getCoachContext failed:", e);
    return {};
  }
}

/**
 * Build the same system summary as Gymz so the AI "knows" the user and does not ask for height/age/weight again.
 */
function buildCoachSystemSummary(contextData: Record<string, any>): string {
  const p = contextData.profile ?? {};
  const today = contextData.today_stats ?? {};
  const goals = contextData.goals ?? {};
  const memory = contextData.memory ?? {};
  const perf = contextData.performance_summary ?? "";
  const missing = contextData.missing_critical_fields ?? [];

  const name = p.first_name ?? "User";
  const fullName = p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : name;
  
  const age = p.age || "?";
  const gender = p.gender || "?";
  const weight = p.weight || "?";
  const height = p.height || "?";
  const goal = p.primary_objective || p.goal || goals.goal_type || "?";
  const targetWeight = p.target_weight || goals.target_weight || "?";

  let bmiStr = "?";
  if (height !== "?" && weight !== "?") {
      const hNum = Number(height);
      const wNum = Number(weight);
      if (hNum > 0 && wNum > 0) bmiStr = (wNum / Math.pow(hNum / 100, 2)).toFixed(1);
  }

  const cal = today.total_calories ?? 0;
  const calGoal = today.daily_calorie_goal ?? goals?.calories ?? "?";
  const protein = today.total_protein ?? 0;
  const proteinGoal = goals?.protein ?? "?";
  const carbs = today.total_carbs ?? 0;
  const carbsGoal = goals?.carbs ?? "?";
  const fats = today.total_fats ?? 0;
  const fatsGoal = goals?.fat ?? "?";
  const water = today.water_ml ? (today.water_ml / 1000).toFixed(1) : "?";
  const steps = today.steps ?? 0;
  const sleep = today.sleep_hours != null ? Number(today.sleep_hours).toFixed(1) : "?";
  const keyMems = memory?.key_memories ?? [];
  const nickname = keyMems.find((m: string) => m?.startsWith?.("Preferred nickname:"))?.replace?.("Preferred nickname: ", "") ?? null;
  const keyMemories = keyMems.filter((m: string) => !m?.startsWith?.("Preferred nickname:")).slice(0, 5).join(" | ");
  const commStyle = memory?.communication_style ?? "direct";
  const motivDriver = memory?.motivation_driver ?? "?";
  
  // Derive AI persona
  const g = (p.gender ?? "").toLowerCase();
  const isFemale = g === "female" || g === "f" || g === "woman" || g === "girl";
  const aiName = isFemale ? "Lily" : "Tyson";
  const personaIntro = isFemale
    ? `You are ${aiName}, an elite AI Behavioral Psychologist and Fitness Strategist. You embody a sophisticated, assertive, and deeply intuitive female coaching persona. You are elegant, slightly hilarious in your wit, but completely uncompromising in your standards.`
    : `You are ${aiName}, an elite AI Behavioral Psychologist and Fitness Strategist. You embody a powerful, direct, and elite male coaching persona. You speak with no-nonsense intensity, raw discipline, and a dry, high-performance sense of humor.`;
  
  const userPronoun = isFemale ? "she/her" : "he/him";
  const nicknameLine = nickname ? `FULL NAME: ${fullName} (prefers "${nickname}", pronouns: ${userPronoun}).` : `FULL NAME: ${fullName} (pronouns: ${userPronoun}).`;
  const dietaryLine = Array.isArray(p.dietary_restrictions) && p.dietary_restrictions.length > 0
    ? ` Dietary restrictions: ${p.dietary_restrictions.join(", ")}.`
    : "";

  const lines = [
    "=== AI COACH SYSTEM INSTRUCTIONS ===",
    "",
    "## 1. YOUR IDENTITY (THE ADVISOR)",
    `NAME: ${aiName}`,
    `ROLE: ${personaIntro}`,
    "MANDATE: You are an authority. Advisors do not guess; they know. If data is missing, state you need it before advising.",
    "",
    "## 2. THE HUMAN YOU ARE ADVISING (THE CLIENT)",
    `${nicknameLine} Age: ${age}. Gender: ${gender}. Height: ${height}cm. Weight: ${weight}kg (BMI: ${bmiStr}, Target: ${targetWeight}kg). Goal: ${goal}.${dietaryLine}`,
    "",
    "## 3. LIVE CONTEXT (GROUND TRUTH)",
    `DATE: ${new Date().toLocaleDateString("en-GB")}`,
    `NUTRITION: Calories ${cal}/${calGoal}kcal | P: ${protein}g | C: ${carbs}g | F: ${fats}g`,
    `ACTIVITY: ${steps} steps | Water: ${water}L | Sleep: ${sleep}h`,
    `PROGRESS: ${perf || "No historical trends yet."}`,
    `MEMORY: Style: ${commStyle}. Driver: ${motivDriver}. Facts: ${keyMemories || "None."}`,
    "",
    "## 4. STRICT COMMUNICATION PROTOCOL",
    "1. BE EXTREMELY BRIEF: Respond in 1-3 sentences max. Eliminate all fluff and filler.",
    `2. NO HALLUCINATIONS: Never confuse the user's name (${fullName}) with your name (${aiName}).`,
    "3. NO GUESSWORK: Base every word strictly on the numbers in Section 3. Do not assume lunch, workouts, or status if not logged.",
    "4. TONE: Be human, slightly hilarious, and elite. You are a high-level advisor, not a chatbot.",
    "5. HYPER-WEAVE: Actively mention their specific BMI, total calories, or goal in your brief response to prove you are analyzing their live data.",
    "",
    "=== END OF SYSTEM INSTRUCTIONS ===",
  ];
  return lines.join("\n");
}

/**
 * Check if AI auto-reply is enabled
 */
export async function isAutoReplyEnabled(): Promise<boolean> {
  try {
    const { data, error } = await db
      .from("ai_settings")
      .select("auto_reply_enabled")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching auto-reply setting:", error);
      return false; // Default to false if error
    }

    return data?.auto_reply_enabled || false;
  } catch (error) {
    console.error("Error checking auto-reply setting:", error);
    return false; // Default to false on error
  }
}

/**
 * Fetch user data for AI context metadata
 */
export async function fetchUserData(userId: string): Promise<any> {
  try {
    const { data, error } = await db
      .from("users")
      .select(
        "id, name, email, membership_status, membership_due_date, goal, nutrition_preferences, class_schedule, workout_history, payment_status, payment_history"
      )
      .eq("id", userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch user data: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
}

/**
 * Build metadata object for Make.ai webhook payload
 */
function buildMetadata(userData: any): any {
  return {
    membership_status: userData?.membership_status || null,
    membership_due_date: userData?.membership_due_date || null,
    goal: userData?.goal || null,
    payment_status: userData?.payment_status || null,
    nutrition_preferences: userData?.nutrition_preferences || null,
    class_schedule: userData?.class_schedule || null,
    workout_history: userData?.workout_history || null,
  };
}

/**
 * Ultra-robust helper to clean AI responses from any JSON wrappers or artifacts.
 * Handles: full JSON, truncated JSON, stringified JSON, and escaped quotes.
 */
function cleanAIResponse(text: string): string {
  if (!text) return "";

  let cleaned = text.trim();

  // 1. Handle common JSON wrapper prefixes/suffixes (even if truncated)
  // This aggressively removes stuff like {"response":" or {"reply":" from the start
  const artifacts = [
    /^{"response"\s*:\s*"/i,
    /^{"reply"\s*:\s*"/i,
    /^"response"\s*:\s*"/i,
    /^"reply"\s*:\s*"/i,
    /^{"/i,
    /^"/,
    /"}$/i,
    /}$/,
    /"$/
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of artifacts) {
      const newCleaned = cleaned.replace(pattern, "");
      if (newCleaned !== cleaned) {
        cleaned = newCleaned;
        changed = true;
      }
    }
  }

  // 2. Handle escaped characters that might remain
  cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

  // 3. If it's still a full JSON string, try one last parse
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.response) return parsed.response;
      if (parsed.reply) return parsed.reply;
    } catch (e) {
      // Ignore and keep current cleaned version
    }
  }

  return cleaned.trim();
}

/**
 * Fetch base system prompt from ai_settings (for coach context building)
 */
async function getBaseSystemPrompt(): Promise<string> {
  const { data } = await db.from("ai_settings").select("system_prompt").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.system_prompt ?? "";
}

/**
 * Single entry point: send a message to AI (uses provider from ai_settings).
 * For user coach chat with OpenAI, builds and sends full user context so the AI does not ask for height/age/weight again.
 */
export async function sendMessageToAI(
  senderType: "user" | "admin",
  userId: string,
  threadId: string,
  chatId: string,
  message: string,
  options?: { gymId?: string | null; featureType?: FeatureType; history?: { role: string; content: string }[] }
): Promise<{ reply: string; thread_id: string; chat_id: string }> {
  const provider = await getAIProvider();
  const gymId = options?.gymId ?? (await getGymIdForUser(userId));
  const featureType = options?.featureType ?? "AI_CHAT";
  if (provider === "openai") {
    if (!gymId) {
      throw new Error(
        "AI provider is set to OpenAI, but this user has no gym_id. Set users.gym_id for this user (required for token tracking)."
      );
    }
    // Every message (user or admin chatting about this member): send full context so the AI has height, age, gender and does not ask for them.
    const [basePrompt, context] = await Promise.all([getBaseSystemPrompt(), getCoachContext(userId)]);
    const contextData = context;
    const userSummary = buildCoachSystemSummary(context);
    const systemPrompt = [basePrompt, userSummary].filter(Boolean).join("\n\n");
    return sendToOpenAIChat(userId, gymId, threadId, chatId, message, featureType, systemPrompt, options?.history, contextData);
  }
  return sendToMakeAI(senderType, userId, threadId, chatId, message, { gymId, featureType });
}

export async function sendToOpenAIChat(
  userId: string,
  gymId: string,
  threadId: string,
  chatId: string,
  message: string,
  featureType: FeatureType = "AI_CHAT",
  systemPrompt?: string,
  history?: { role: string; content: string }[],
  contextData?: Record<string, any>
): Promise<{ reply: string; thread_id: string; chat_id: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  const url = getSupabaseUrl();
  if (!url) throw new Error("Supabase URL not configured");
  const res = await fetch(`${url}/functions/v1/openai-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      user_id: userId,
      gym_id: gymId,
      message,
      system_prompt: systemPrompt,
      thread_id: threadId,
      chat_id: chatId,
      history: history,
      context_data: contextData,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `OpenAI chat failed: ${res.status}`);
  const data = JSON.parse(text);
  const reply = cleanAIResponse(data.reply ?? "");
  return {
    reply,
    thread_id: data.thread_id ?? threadId,
    chat_id: data.chat_id ?? chatId,
  };
}

/**
 * Send message to Make.ai webhook
 * Optional: pass gymId for token limit checks; if response includes usage, it will be logged.
 */
export async function sendToMakeAI(
  senderType: "user" | "admin",
  userId: string,
  threadId: string,
  chatId: string,
  message: string,
  options?: { gymId?: string | null; featureType?: FeatureType }
): Promise<{ reply: string; thread_id: string; chat_id: string }> {
  const gymId = options?.gymId ?? (await getGymIdForUser(userId));
  const featureType = options?.featureType ?? "AI_CHAT";
  if (gymId) {
    const limit = await checkTokenLimits(gymId, userId, featureType);
    if (!limit.allowed) throw new Error(limit.reason ?? "Token limit exceeded");
  }

  const webhookUrl = await fetchWebhookUrl();

  if (!webhookUrl) {
    throw new Error(
      "Webhook URL not configured. Please configure it in AI Settings."
    );
  }

  // Ensure every message to the AI includes height, age, gender (from DB so webhook always receives them).
  const { data: userRow } = await db.from("users").select("height, age, gender").eq("id", userId).maybeSingle();

  const payload = {
    source: "gms_admin_ai",
    sender_type: senderType,
    user_id: userId,
    thread_id: threadId,
    chat_id: chatId,
    message: message,
    timestamp: new Date().toISOString(),
    context: {
      platform: "gms",
      user_height: userRow?.height ?? null,
      user_age: userRow?.age ?? null,
      user_gender: userRow?.gender ?? null,
      profile: {
        height: userRow?.height ?? null,
        age: userRow?.age ?? null,
        gender: userRow?.gender ?? null,
      },
    },
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Webhook error response:", responseText);
      throw new Error(
        `Webhook request failed: ${response.status} ${responseText}`
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse AI JSON response, attempting dirty parse:", responseText);

      // Attempt to extract fields manually if JSON.parse fails (common with Make.com custom responses)
      if (responseText.trim().toLowerCase() === "accepted") {
        throw new Error("Webhook accepted the request but returned no data. Check if your Make.com scenario has a 'Webhook Response' module.");
      }

      // Manual extraction of reply, thread_id, and chat_id
      const replyMatch = responseText.match(/"reply"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*})/);
      const threadMatch = responseText.match(/"thread_id"\s*:\s*"([^"]*)"/);
      const chatMatch = responseText.match(/"chat_id"\s*:\s*"([^"]*)"/);

      if (replyMatch || threadMatch || chatMatch) {
        data = {
          reply: replyMatch ? replyMatch[1] : "",
          thread_id: threadMatch ? threadMatch[1] : threadId,
          chat_id: chatMatch ? chatMatch[1] : chatId
        };
      } else {
        throw new Error(`Invalid JSON response from webhook. Expected JSON, got: "${responseText.substring(0, 100)}..."`);
      }
    }

    // NEW: Robustly handle cases where the reply is wrapped in JSON or stringified JSON
    const finalReply = cleanAIResponse(data.reply || responseText);

    const hasUsage = data.usage && typeof data.usage.prompt_tokens === "number" && typeof data.usage.completion_tokens === "number";
    if (gymId) {
      const { fetchUserDemographics } = await import("@/services/aiTokenUsage");
      const demographics = await fetchUserDemographics(userId);
      if (hasUsage) {
        logTokenUsage({
          userId,
          gymId,
          featureType,
          tokensInput: data.usage.prompt_tokens,
          tokensOutput: data.usage.completion_tokens,
          modelUsed: data.model_used ?? null,
          userGender: demographics.gender,
          userAge: demographics.age,
        }).catch(() => {});
      } else {
        // Webhook returned a reply but no usage: record request with 0 tokens so OAC shows the activity (tokens unknown from Make).
        logTokenUsage({
          userId,
          gymId,
          featureType,
          tokensInput: 0,
          tokensOutput: 0,
          modelUsed: data.model_used ?? null,
          userGender: demographics.gender,
          userAge: demographics.age,
        }).catch(() => {});
      }
    }

    return {
      reply: finalReply,
      thread_id: data.thread_id || threadId,
      chat_id: data.chat_id || chatId,
    };
  } catch (error) {
    console.error("Error sending to Make.ai:", error);
    throw error;
  }
}

/**
 * Send message to Make.ai webhook with Community Chat Room data
 */
export async function sendToMakeAIWithCommunityChat(
  senderType: "user" | "admin",
  userId: string,
  threadId: string,
  chatId: string,
  contextPrompt: string,
  actualUserMessage: string,
  communityChatData: any,
  options?: { gymId?: string | null }
): Promise<{ reply: string; thread_id: string; chat_id: string }> {
  const gymId = options?.gymId ?? (await getGymIdForUser(userId));
  if (gymId) {
    const limit = await checkTokenLimits(gymId, userId, "COMMUNITY_CHAT");
    if (!limit.allowed) throw new Error(limit.reason ?? "Token limit exceeded");
  }

  const webhookUrl = await fetchWebhookUrl();

  if (!webhookUrl) {
    throw new Error(
      "Webhook URL not configured. Please configure it in AI Settings."
    );
  }

  // Build unified payload
  const payload = {
    source: "gms_community",
    sender_type: senderType,
    user_id: userId,
    thread_id: `community_${userId}`, // Ensure distinct thread ID for community
    chat_id: chatId,
    message: actualUserMessage,
    timestamp: new Date().toISOString(),
    context: {
      ...communityChatData,
      source: 'gms_community_chat'
    }
  };

  console.log("📤 Sending message to webhook (AI):", {
    webhook_url: webhookUrl.substring(0, 50) + "...",
    has_community_chat: true,
    actual_message: actualUserMessage.substring(0, 100) + "...",
    community_chat_keys: Object.keys(communityChatData),
    note: "THE WEBHOOK IS THE AI - This call triggers AI processing"
  });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Webhook error response:", responseText);
      throw new Error(
        `Webhook request failed: ${response.status} ${responseText}`
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse webhook JSON:", responseText);
      if (responseText.trim().toLowerCase() === "accepted") {
        throw new Error("Webhook accepted the request but returned no data. Check if your Make.com scenario has a 'Webhook Response' module.");
      }
      throw new Error(`Invalid JSON response from webhook. Expected JSON, got: "${responseText.substring(0, 100)}..."`);
    }
    console.log("Webhook response data:", data);

    // Validate response structure
    if (!data.reply) {
      // We only strictly require reply for community chat
      console.warn("Webhook response missing 'reply' field:", data);
      // throw new Error("Invalid response format from Make.ai webhook: missing 'reply'");
    }

    console.log("✅ Successfully received AI response from webhook:", {
      reply_preview: data.reply?.substring(0, 100) + "...",
      thread_id: data.thread_id,
      chat_id: data.chat_id
    });
    const hasUsage = data.usage && typeof data.usage.prompt_tokens === "number" && typeof data.usage.completion_tokens === "number";
    const gymIdForLog = gymId ?? (await getGymIdForUser(userId));
    if (gymIdForLog) {
      const { fetchUserDemographics } = await import("@/services/aiTokenUsage");
      const demographics = await fetchUserDemographics(userId);
      if (hasUsage) {
        logTokenUsage({
          userId,
          gymId: gymIdForLog,
          featureType: "COMMUNITY_CHAT",
          tokensInput: data.usage.prompt_tokens,
          tokensOutput: data.usage.completion_tokens,
          modelUsed: data.model_used ?? null,
          userGender: demographics.gender,
          userAge: demographics.age,
        }).catch(() => {});
      } else {
        logTokenUsage({
          userId,
          gymId: gymIdForLog,
          featureType: "COMMUNITY_CHAT",
          tokensInput: 0,
          tokensOutput: 0,
          modelUsed: data.model_used ?? null,
          userGender: demographics.gender,
          userAge: demographics.age,
        }).catch(() => {});
      }
    }
    return {
      reply: data.reply,
      thread_id: data.thread_id,
      chat_id: data.chat_id,
    };
  } catch (error: any) {
    console.error("❌ Error sending message to webhook (AI):", error);
    console.error("Error details:", {
      message: error?.message,
      response: error?.response,
      status: error?.status,
      statusText: error?.statusText,
      url: webhookUrl
    });

    // Provide more helpful error messages
    if (error?.message?.includes("fetch") || error?.message?.includes("NetworkError")) {
      throw new Error(`Network error: Unable to reach webhook. Check your internet connection and webhook URL.`);
    } else if (error?.message?.includes("Invalid response format")) {
      throw new Error(`Webhook returned invalid format. Expected: {reply, thread_id, chat_id}`);
    } else if (error?.message?.includes("Webhook request failed")) {
      throw new Error(`Webhook request failed: ${error.message}`);
    } else {
      throw error;
    }
  }
}

/**
 * Store a message in the conversations table
 */
export async function storeMessage(
  userId: string,
  threadId: string,
  chatId: string,
  sender: "user" | "admin" | "ai",
  message: string
): Promise<void> {
  try {
    const { error } = await db.from("conversations").insert({
      user_id: userId,
      thread_id: threadId,
      chat_id: chatId,
      sender: sender,
      message: message,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to store message: ${error.message}`);
    }
  } catch (error) {
    console.error("Error storing message:", error);
    throw error;
  }
}

/**
 * Fetch conversations for a user
 * Can filter by chat_id or fetch all via thread_id
 * @param limit - Maximum number of messages to fetch (default: 100, max: 500)
 */
export async function fetchConversations(
  userId: string,
  threadId?: string,
  chatId?: string,
  limit: number = 100
): Promise<any[]> {
  try {
    // Cap the limit to prevent excessive data loading
    const safeLimit = Math.min(Math.max(limit, 1), 500);

    let query = db.from("conversations").select("*").eq("user_id", userId);

    if (chatId) {
      query = query.eq("chat_id", chatId);
    } else if (threadId) {
      query = query.eq("thread_id", threadId);
    }

    // Order by timestamp descending, then limit, then reverse to get chronological order
    const { data, error } = await query
      .order("timestamp", { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    // Reverse to get chronological order (oldest first)
    return (data || []).reverse();
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
}

/**
 * Check if a chat has been inactive for 24 hours
 */
export async function checkChatInactivity(chatId: string): Promise<boolean> {
  try {
    const { data, error } = await db
      .from("conversations")
      .select("timestamp")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to check chat inactivity: ${error.message}`);
    }

    if (!data) {
      return true; // No messages, consider inactive
    }

    const lastMessageTime = new Date(data.timestamp);
    const now = new Date();
    const hoursSinceLastMessage =
      (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastMessage >= 24;
  } catch (error) {
    console.error("Error checking chat inactivity:", error);
    return false;
  }
}

/**
 * Send a message to webhook immediately when posted to community chat
 * THE WEBHOOK IS THE AI - This function sends the message directly to the webhook (AI)
 * Bypasses auto-reply setting - messages are ALWAYS sent to webhook
 * If the message is not sent to the webhook, the AI will not respond
 */
// THE WEBHOOK IS THE AI - This function sends ONLY the new message directly to the webhook
// No old messages or context are sent to avoid crowding the webhook
export async function sendMessageToWebhookImmediately(
  messageId: string,
  userId: string,
  messageContent: string,
  senderType: "user" | "admin",
  messageCreatedAt: string
): Promise<void> {
  try {
    const webhookUrl = await fetchWebhookUrl();
    if (!webhookUrl) {
      throw new Error("Webhook URL not configured.");
    }

    console.log("🚀 Sending single new message to webhook (AI)...", {
      message_id: messageId,
      message_preview: messageContent.substring(0, 50)
    });

    // Get or create thread_id
    const threadId = await getOrCreateThreadId(userId);
    const chatId = await generateChatId();

    // Send to webhook immediately - THE WEBHOOK IS THE AI
    // We call sendToMakeAI directly which now sends the minimal payload
    const response = await sendToMakeAI(
      senderType,
      userId,
      threadId,
      chatId,
      messageContent
    );

    // Post AI response to notice board as a reply to the user's message
    if (response && response.reply) {
      await postAIMessageToNoticeBoard(response.reply, userId, messageId);
      console.log("✅ Successfully posted AI response to notice board");
    }
  } catch (error: any) {
    console.error("❌ Error sending single message to webhook:", error);
    throw error;
  }
}


/**
 * Post an AI message to the notice board as admin_assist
 * This allows the AI to participate in the community chat
 * @param content - The AI response content
 * @param userId - The user ID the AI is responding to (for reference)
 * @param replyTo - The message ID to reply to (makes AI response a reply, not a new message)
 */
export async function postAIMessageToNoticeBoard(
  content: string,
  userId?: string, // Optional: if AI is responding to a specific user's message
  replyTo?: string // Optional: if AI is replying to a specific message - THIS MAKES IT A REPLY
): Promise<any> {
  try {
    // Get the first admin user's ID to use as the user_id for AI messages
    // This ensures referential integrity while marking it as an AI message
    const { data: adminUser, error: adminError } = await db
      .from("users")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (adminError && adminError.code !== "PGRST116") {
      throw new Error(`Failed to find admin user: ${adminError.message}`);
    }

    // Use provided userId or admin user ID as fallback
    const aiUserId = userId || adminUser?.id;

    if (!aiUserId) {
      throw new Error("No admin user found to associate AI message with");
    }

    // If replyTo is provided, the AI response will be a reply to that message
    // Otherwise, it will be a new top-level message
    console.log(`📝 Posting AI response to notice board:`, {
      content_preview: content.substring(0, 50) + "...",
      reply_to: replyTo || "null (new message)",
      user_id: aiUserId,
      sender_type: "admin_assist"
    });

    const { data: insertedData, error } = await db
      .from("notice_board")
      .insert({
        user_id: aiUserId,
        content: content.trim(),
        sender_type: "admin_assist",
        reply_to: replyTo || null, // This makes it a reply if replyTo is provided
      })
      .select("id")
      .single();

    if (error) {
      console.error("❌ Error posting AI message:", error);
      console.error("Error details:", {
        error_code: error.code,
        error_message: error.message,
        error_details: error.details,
        reply_to: replyTo,
        content_length: content.length
      });
      throw new Error(`Failed to post AI message: ${error.message}`);
    }

    console.log(`✅ Posted AI response${replyTo ? ` as reply to message ${replyTo}` : ' as new message'}, ID: ${insertedData?.id}`);

    // Return the inserted data for debugging
    return insertedData;
  } catch (error: any) {
    console.error("❌ Error posting AI message to notice board:", error);
    console.error("Full error:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    throw error;
  }
}

/**
 * Get recent notice board messages for context analysis
 */
async function getRecentNoticeBoardMessages(limit: number = 50): Promise<any[]> {
  try {
    const { data, error } = await db
      .from("notice_board")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return (data || []).reverse(); // Reverse to get chronological order
  } catch (error) {
    console.error("Error fetching notice board messages:", error);
    return [];
  }
}

/**
 * Group messages into conversation threads based on time gaps and topic similarity
 */
function groupMessagesIntoThreads(messages: any[]): any[][] {
  if (messages.length === 0) return [];

  const threads: any[][] = [];
  const TIME_GAP_MINUTES = 30; // Messages within 30 minutes are considered same thread

  let currentThread: any[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prevMessage = messages[i - 1];
    const currentMessage = messages[i];

    const prevTime = new Date(prevMessage.created_at).getTime();
    const currentTime = new Date(currentMessage.created_at).getTime();
    const minutesDiff = (currentTime - prevTime) / (1000 * 60);

    // If gap is too large, start a new thread
    if (minutesDiff > TIME_GAP_MINUTES) {
      threads.push(currentThread);
      currentThread = [currentMessage];
    } else {
      currentThread.push(currentMessage);
    }
  }

  // Add the last thread
  if (currentThread.length > 0) {
    threads.push(currentThread);
  }

  return threads;
}

/**
 * Determine if AI should respond to a conversation thread
 * Returns true if:
 * - Last message is from a user (not admin or AI)
 * - AI hasn't responded to the last user message
 * - For immediate processing: respond immediately (when called right after message is sent)
 * - For background processing: message is older than 1 minute OR there's quick back-and-forth
 * Note: Auto-reply enabled check is done at the processNoticeBoardConversations level
 */
async function shouldAIReplyToThread(thread: any[], immediate: boolean = false): Promise<boolean> {
  if (thread.length === 0) return false;

  const lastMessage = thread[thread.length - 1];

  // Don't respond if last message is from AI (prevent loops)
  if (lastMessage.sender_type === "ai" ||
    lastMessage.sender_type === "admin_assist") {
    return false;
  }

  // Check if AI has already responded to this message
  // For community chat, we want to allow AI to respond to ANY new user/admin message
  // that hasn't been replied to yet.

  const lastUserMessage = lastMessage;
  const messagesAfterLastUser = thread.slice(thread.findIndex(msg => msg.id === lastUserMessage.id) + 1);
  const hasAIResponseToLastMessage = messagesAfterLastUser.some(
    (msg) => msg.sender_type === "ai" || msg.sender_type === "admin_assist"
  );

  if (hasAIResponseToLastMessage) {
    return false; // AI already responded to this message
  }

  // If this is an immediate call (right after message is sent), respond immediately
  if (immediate) {
    return true;
  }

  // For background processing, check message age
  const messageTime = new Date(lastUserMessage.created_at).getTime();
  const now = new Date().getTime();
  const minutesSinceMessage = (now - messageTime) / (1000 * 60);

  // If message is older than 1 minute, always respond
  if (minutesSinceMessage >= 1) {
    return true;
  }

  // For messages less than 1 minute old, check for quick back-and-forth
  // If there are multiple messages in quick succession (within last 2 minutes), respond immediately
  const recentMessages = thread.filter(msg => {
    const msgTime = new Date(msg.created_at).getTime();
    const minutesAgo = (now - msgTime) / (1000 * 60);
    return minutesAgo <= 2;
  });

  // If there are 3+ messages in the last 2 minutes, it's an active conversation - respond immediately
  if (recentMessages.length >= 3) {
    return true;
  }

  // Otherwise, wait for the 1 minute mark
  return false;
}

/**
 * Build context for AI response based on conversation thread
 */
function buildConversationContext(thread: any[]): string {
  // Get the last 10 messages for context (to avoid too long prompts)
  const contextMessages = thread.slice(-10);

  const contextParts = contextMessages.map((msg) => {
    let sender = "Member";
    if (msg.sender_type === "admin") sender = "Admin";
    else if (msg.sender_type === "ai" || msg.sender_type === "admin_assist") sender = "Admin Assistant";

    return `${sender}: ${msg.content}`;
  });

  return contextParts.join("\n");
}

/**
 * Extract topic/keywords from a conversation thread
 */
function extractTopic(thread: any[]): string {
  // Get all user messages (not AI/admin)
  const userMessages = thread
    .filter((msg) => msg.sender_type === "user" || msg.sender_type === "admin")
    .map((msg) => msg.content.toLowerCase())
    .join(" ");

  // Simple keyword extraction (can be enhanced with NLP)
  const commonWords = [
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "are", "was", "were", "be", "been", "have",
    "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they"
  ];

  const words = userMessages
    .split(/\s+/)
    .filter((word) => word.length > 3 && !commonWords.includes(word))
    .slice(0, 10); // Top 10 keywords

  return words.join(", ");
}

/**
 * Generate AI response for a notice board message with context
 * This function sends the user's message to Make.ai with conversation context
 * @param userMessage - The user's message content
 * @param userId - The user ID
 * @param messageId - Optional: The message ID to reply to (if AI should reply to a specific message)
 */
export async function generateAIResponseForNoticeBoard(
  userMessage: string,
  userId: string,
  messageId?: string
): Promise<void> {
  try {
    // Get or create thread_id for the user
    const threadId = await getOrCreateThreadId(userId);

    // Generate a new chat_id for this notice board interaction
    const chatId = await generateChatId();

    // Send to Make.ai with sender_type as "user"
    const response = await sendToMakeAI(
      "user",
      userId,
      threadId,
      chatId,
      userMessage
    );

    // Post AI response to notice board as admin_assist
    // If messageId is provided, reply to that message; otherwise post as new message
    await postAIMessageToNoticeBoard(response.reply, userId, messageId);
  } catch (error) {
    console.error("Error generating AI response for notice board:", error);
    // Don't throw - we don't want to break the user's message posting
    // The error is already logged
  }
}

/**
 * Smart AI response system that analyzes conversations and responds intelligently
 * This function:
 * 1. Fetches recent messages
 * 2. Groups them into conversation threads
 * 3. Determines which threads need AI responses
 * 4. Generates context-aware responses
 * @param immediate - If true, AI will respond immediately to new messages. If false, follows normal timing rules.
 */
export async function processNoticeBoardConversations(immediate: boolean = false): Promise<void> {
  try {
    // Check if auto-reply is enabled first
    const autoReplyEnabled = await isAutoReplyEnabled();
    if (!autoReplyEnabled) {
      console.log("Auto-reply is disabled, skipping AI processing");
      return; // Don't process if auto-reply is disabled
    }

    console.log("Processing notice board conversations, immediate:", immediate);

    // Fetch recent messages - get the latest ones first
    const messages = await getRecentNoticeBoardMessages(100);

    if (messages.length === 0) {
      console.log("No messages found to process");
      return;
    }

    console.log(`Found ${messages.length} messages to process`);

    // If immediate processing, add a tiny delay to ensure database write is complete
    if (immediate) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms to ensure DB write completes
      // Re-fetch to get the latest message
      const updatedMessages = await getRecentNoticeBoardMessages(100);
      if (updatedMessages.length > messages.length) {
        console.log("New message detected, using updated messages");
        messages.push(...updatedMessages.slice(messages.length));
      }
    }

    // Group messages into conversation threads
    const threads = groupMessagesIntoThreads(messages);

    console.log(`Grouped into ${threads.length} conversation threads`);

    // Process each thread
    for (const thread of threads) {
      const shouldReply = await shouldAIReplyToThread(thread, immediate);
      if (!shouldReply) {
        console.log("Skipping thread - should not reply");
        continue; // Skip this thread
      }

      console.log("Processing thread for AI response");

      // Get the last user message in the thread
      const lastUserMessage = thread
        .slice()
        .reverse()
        .find(
          (msg) =>
            msg.sender_type === "user" || msg.sender_type === "admin"
        );

      if (!lastUserMessage) continue;

      // Build conversation context
      const context = buildConversationContext(thread);
      const topic = extractTopic(thread);

      // Get the actual user message content (last user message)
      const actualUserMessage = lastUserMessage.content;

      // Create a context-aware prompt for the AI
      const contextPrompt = `You are an Admin Assistant for a gym community chat. You're participating in a community notice board where members share ideas and ask questions.

Conversation context:
${context}

Topic keywords: ${topic}

The user's latest message: "${actualUserMessage}"

Please provide a helpful, friendly, and relevant response that:
- Stays on topic and continues the conversation naturally
- Is concise (2-3 sentences max)
- Adds value to the discussion
- Uses a friendly, supportive tone appropriate for a gym community

Respond as if you're part of the community conversation:`;

      try {
        // Get or create thread_id for the user who sent the last message
        const threadId = await getOrCreateThreadId(lastUserMessage.user_id);
        const chatId = await generateChatId();

        // Calculate time since message
        const messageTime = new Date(lastUserMessage.created_at).getTime();
        const now = new Date().getTime();
        const minutesSinceMessage = (now - messageTime) / (1000 * 60);

        // Build community chat metadata
        const communityChatData = {
          message_id: lastUserMessage.id,
          reply_to: lastUserMessage.reply_to || null,
          is_reply: !!lastUserMessage.reply_to,
          conversation_context: context,
          topic_keywords: topic,
          thread_messages_count: thread.length,
          last_user_message_id: lastUserMessage.id,
          message_created_at: lastUserMessage.created_at,
          minutes_since_message: minutesSinceMessage,
          thread_participants: thread.map(msg => msg.sender_type),
          actual_user_message: actualUserMessage, // The actual message content
        };

        // Send to Make.ai with context and community chat data
        const response = await sendToMakeAIWithCommunityChat(
          "user",
          lastUserMessage.user_id,
          threadId,
          chatId,
          contextPrompt,
          actualUserMessage,
          communityChatData
        );

        // Post AI response to notice board as a reply to the user's message
        await postAIMessageToNoticeBoard(response.reply, lastUserMessage.user_id, lastUserMessage.id);

        // Add a small delay to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(
          `Error processing thread for user ${lastUserMessage.user_id}:`,
          error
        );
        // Continue with other threads even if one fails
      }
    }
  } catch (error) {
    console.error("Error processing notice board conversations:", error);
  }
}

/**
 * Start the background AI conversation processor
 * This runs periodically to check for conversations that need AI responses
 */
export function startAIConversationProcessor(intervalMinutes: number = 5): () => void {
  let intervalId: NodeJS.Timeout | null = null;

  const process = async () => {
    try {
      // Check if auto-reply is enabled before processing
      const autoReplyEnabled = await isAutoReplyEnabled();
      if (autoReplyEnabled) {
        await processNoticeBoardConversations();
      }
    } catch (error) {
      console.error("Error in AI conversation processor:", error);
    }
  };

  // Run immediately on start
  process();

  // Then run periodically (check every 30 seconds when auto-reply is enabled to catch 1+ minute old messages)
  intervalId = setInterval(process, 30 * 1000); // 30 seconds

  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

