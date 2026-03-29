import { supabase, SUPABASE_URL } from './supabase';
export { supabase };
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedAISettings, fetchWithTimeout, clearAISettingsCache } from './aiUtils';
import type { ChatCredentials, WebhookResponse } from './aiTypes';
export type { ChatCredentials, WebhookResponse };
// Lazy import to break circular dependency
let postToOpenAI: any = null;
const getPostToOpenAI = async () => {
    if (!postToOpenAI) {
        const aiOpenAIModule = await import('./aiOpenAI');
        postToOpenAI = aiOpenAIModule.postToOpenAI;
    }
    return postToOpenAI;
};

/**
 * Call the Supabase Edge Function openai-chat so coach usage is logged to ai_token_usage (OAC).
 * Use this for mobile coach when provider is openai so tokens are tracked.
 */
async function postToOpenAIEdgeFunction(
    creds: ChatCredentials,
    messageText: string,
    contextData: any,
    systemPrompt?: string,
    history?: { role: string; content: string }[]
): Promise<WebhookResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const { data: userRow } = await (supabase as any).from('users').select('gym_id').eq('id', creds.userId).maybeSingle();
    const gymId = userRow?.gym_id;
    if (!gymId) throw new Error('User has no gym. Token tracking requires users.gym_id.');

    const url = `${SUPABASE_URL}/functions/v1/openai-chat`;
    console.log('[EdgeFn] Sending system_prompt preview:', (systemPrompt || 'NONE').slice(0, 300));
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            user_id: creds.userId,
            gym_id: gymId,
            feature_type: 'AI_COACH',
            message: messageText,
            system_prompt: systemPrompt ?? undefined,
            thread_id: creds.threadId,
            chat_id: creds.chatId,
            history: history ?? undefined,
            context_data: contextData ?? undefined,
        }),
    }, 30000);

    const text = await res.text();
    if (!res.ok) throw new Error(text || `OpenAI chat failed: ${res.status}`);
    const data = JSON.parse(text);
    return {
        reply: data.reply ?? '',
        thread_id: data.thread_id ?? creds.threadId,
        chat_id: data.chat_id ?? creds.chatId,
    };
}

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
const WEBHOOK_URL = "https://hook.eu2.make.com/73oa7gubrayjuavgupd3amxd2flch7fq";

// Types are now imported from ./aiTypes to break circular dependency

/**
 * Log one AI request to ai_token_usage for OAC (e.g. COMMUNITY_CHAT from mobile).
 * Fire-and-forget; does not throw. Requires user_id and gym_id.
 */
async function logCommunityChatTokenUsage(
    userId: string,
    usage: { prompt_tokens?: number; completion_tokens?: number } | null,
    modelUsed?: string | null
): Promise<void> {
    try {
        const { data: userRow } = await (supabase as any).from('users').select('gym_id').eq('id', userId).maybeSingle();
        if (!userRow?.gym_id) return;
        const tokensInput = usage && typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
        const tokensOutput = usage && typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;
        await (supabase as any).from('ai_token_usage').insert({
            user_id: userId,
            gym_id: userRow.gym_id,
            feature_type: 'COMMUNITY_CHAT',
            tokens_input: tokensInput,
            tokens_output: tokensOutput,
            tokens_total: tokensInput + tokensOutput,
            model_used: modelUsed ?? null,
        });
    } catch (_) {
        // Do not block chat if logging fails
    }
}

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------
export const createUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

// ------------------------------------------------------------------
// CORE SERVICE
// ------------------------------------------------------------------

/**
 * Retrieves persistent identifiers for the conversation.
 * Connects to Supabase to fetch or store the permanent thread_id.
 */
/**
 * Retrieves persistent identifiers for the conversation.
 * Connects to Supabase to fetch or store the permanent thread_id.
 */
export const getSessionIdentifiers = async (userId: string): Promise<ChatCredentials> => {
    try {
        const storageKey = `Gymz_ai_instructor_${userId}`;

        // 1. Try to get from local storage first (fast)
        const rawData = await AsyncStorage.getItem(storageKey);
        let credentials = rawData ? JSON.parse(rawData) : null;

        // 3. PERSISTENCE & CONTINUITY FIX:
        // Always check DB for the absolute newest conversation for this user.
        // Even if we have local credentials, they might be from an old session if the user
        // starting a "New Chat" on another device or if the local cache is stale.
        console.log('[AI Service] Verifying latest session from server...');

        const { data: latestConv, error: dbError } = await (supabase as any)
            .from('conversations')
            .select('thread_id, chat_id, timestamp')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (dbError) {
            console.warn('[AI Service] DB check failed, using local/fallback:', dbError);
        }

        // If DB has a newer session than our local one (or if we have no local one), use it.
        // We compare chatIds; if they differ, the server "wins" as the source of truth for continuity.
        if (latestConv?.chat_id && (!credentials || credentials.chatId !== latestConv.chat_id)) {
            console.log('[AI Service] Continuity Sync: Server has newer/different session:', latestConv.chat_id);
            credentials = {
                userId,
                threadId: latestConv.thread_id,
                chatId: latestConv.chat_id,
            };
            // Update local storage so we don't hit DB every single time (though we still check once per session init)
            await AsyncStorage.setItem(storageKey, JSON.stringify(credentials));
        } else if (!credentials) {
            // Truly new user with no history at all
            console.log('[AI Service] No previous history found. Creating fresh session.');
            credentials = {
                userId,
                threadId: createUUID(),
                chatId: createUUID(),
            };
            await AsyncStorage.setItem(storageKey, JSON.stringify(credentials));
        }

        return credentials;

    } catch (e) {
        console.warn("[AI Service] Session retrieval fallback logic triggered", e);
        // Fallback only on critical failure
        return {
            userId,
            threadId: createUUID(),
            chatId: createUUID(),
        };
    }
};

/**
 * Deletes all messages for a specific chat session and clears local backup.
 * If userId is provided, it performs a thorough wipe of ALL chat history for that user.
 */
export const clearChatMessages = async (chatId: string, userId?: string) => {
    try {
        console.log('[AI Service] Initiating thorough chat clear for:', { chatId, userId });

        // 1. Clear from Supabase
        if (userId) {
            // Wipe primary tables
            // Note: ai_messages was legacy and may not exist in all environments
            const tables = ['conversations', 'ai_chat_history'];

            await Promise.all(tables.map(async (tableName) => {
                try {
                    const { error } = await (supabase as any)
                        .from(tableName)
                        .delete()
                        .eq('user_id', userId);

                    if (error) {
                        // Silently handle missing tables to avoid breaking the UX
                        if (error.code === 'PGRST205') {
                            console.log(`[AI Service] Note: Table ${tableName} does not exist, skipping.`);
                        } else {
                            console.warn(`[AI Service] Error clearing ${tableName}:`, error);
                        }
                    } else {
                        console.log(`[AI Service] Cleared ${tableName} for user:`, userId);
                    }
                } catch (err) {
                    console.warn(`[AI Service] Critical failure clearing ${tableName}:`, err);
                }
            }));

            console.log('[AI Service] DB wipe completed for known tables.');
        } else {
            await (supabase as any).from('conversations').delete().eq('chat_id', chatId);
        }

        // 2. Clear from Local Storage
        if (userId) {
            const historyKey = `chat_history_${userId}`;
            const sessionKey = `Gymz_ai_instructor_${userId}`;

            await AsyncStorage.multiRemove([historyKey, sessionKey]);
            console.log('[AI Service] Local identifiers and history wiped for user:', userId);
        }

        return true;
    } catch (e) {
        console.warn("[AI Service] Failed to clear chat messages:", e);
        return false;
    }
};

/**
 * Fetches user AI memory qualitative profile from Supabase.
 */
export const getUserMemory = async (userId: string) => {
    try {
        const { data, error } = await (supabase as any)
            .from('user_ai_memory')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (e) {
        console.warn("[AI Service] Failed to fetch user memory:", e);
        return null;
    }
};

/**
 * COMPREHENSIVE CONTEXT HELPER (Phase 4)
 * Fetches profile stats, fitness goals, and qualitative memory.
 * This ensures the AI has REAL data to work with.
 */
export const getUserFullContext = async (userId: string) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // PARALLEL FETCHING: All context queries run simultaneously
        const [
            profileResp,
            goalsResp,
            mealsResp,
            memory,
            weightHistoryResp,
            streaksResp,
            messageCountResp,
            healthLogsResp,
            waterLogsResp
        ] = await Promise.all([
            // 1. Profile
            (supabase as any).from('users').select('height, weight, target_weight, goal, primary_objective, membership_status, gold_hour, first_name, last_name, name, full_name, age, gender, dietary_restrictions').eq('id', userId).maybeSingle(),
            // 2. Goals (SSOT Columns: daily_calorie_goal, daily_protein_goal, etc.)
            (supabase as any).from('user_fitness_goals').select('daily_calorie_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal, goal_type').eq('user_id', userId).eq('is_active', true).maybeSingle(),
            // 3. Today's Meals (Real Source of Truth)
            (supabase as any).from('daily_nutrition_logs').select('food_name, calories, protein, carbs, fats, meal_type, logged_at').eq('user_id', userId).gte('logged_at', startOfToday.toISOString()).order('logged_at', { ascending: true }),
            // 4. AI Memory
            getUserMemory(userId),
            // 5. Weight History (Latest logs)
            (supabase as any).from('body_metrics').select('weight, date').eq('user_id', userId).order('date', { ascending: false }).limit(10),
            // 6. Streaks
            (supabase as any).from('user_streaks').select('streak_type, current_streak').eq('user_id', userId),
            // 7. First Message Check
            (supabase as any).from('conversations').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('sender', 'user').gte('timestamp', startOfToday.toISOString()),
            // 8. Health Logs (Steps, Sleep, Active Mins)
            (supabase as any).from('daily_health_logs').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
            // 9. Raw Water Logs (Sum for today)
            (supabase as any).from('water_logs').select('amount').eq('user_id', userId).eq('date', today)
        ]);

        const profile = profileResp.data || {};
        const goals = goalsResp.data || {};
        const meals = mealsResp.data || [];
        const weightHistory = weightHistoryResp.data || [];
        const streaks = streaksResp.data || [];
        const messageCount = messageCountResp.count || 0;
        const healthStats = healthLogsResp.data || { steps: 0, sleep_minutes: 0, water_ml: 0 };

        // Aggregate Today's Nutrition from Real Meals
        const todayStats = meals.reduce((acc: any, meal: any) => {
            acc.total_calories += (meal.calories || 0);
            acc.total_protein += (meal.protein || 0);
            acc.total_carbs += (meal.carbs || 0);
            acc.total_fats += (meal.fats || 0);
            return acc;
        }, { total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0 });

        // Calculate total water from all sources
        const extraWater = (waterLogsResp.data || []).reduce((sum: number, log: any) => sum + (log.amount || 0), 0);
        const totalWaterMl = (healthStats.water_ml || 0) + extraWater;

        // WEIGHT FALLBACK: If profile.weight is null, use the most recent body_metric log
        const currentWeight = profile.weight || (weightHistory.length > 0 ? weightHistory[0].weight : null);

        // 8. Identify Missing Critical Data
        const criticalGaps: string[] = [];
        if (!profile?.height) criticalGaps.push('height (CM)');
        if (!currentWeight) criticalGaps.push('weight (KG)');
        if (!profile?.gender) criticalGaps.push('gender');
        if (!profile?.goal && !profile?.primary_objective && !goals?.goal_type) criticalGaps.push('fitness goal');
        if (!profile?.age) criticalGaps.push('age');

        // 9. Generate Aggregated Summary for AI Context
        const performanceSummary = generatePerformanceSummary({
            weightHistory,
            streaks,
            todayStats: { ...todayStats, daily_calorie_goal: goals.daily_calorie_goal },
            healthStats: {
                ...healthStats,
                water_ml: totalWaterMl
            },
            currentWeight
        });

        return {
            profile: { ...profile, weight: currentWeight },
            goals: goals,
            today_stats: {
                ...todayStats,
                steps: healthStats.steps || 0,
                water_ml: totalWaterMl,
                sleep_hours: (healthStats.sleep_minutes || 0) / 60
            },
            meals: meals.map((m: any) => `${m.meal_type || 'meal'}: ${m.food_name} (${m.calories}kcal)`),
            memory: memory || {},
            performance_summary: performanceSummary,
            missing_critical_fields: criticalGaps,
            is_data_incomplete: criticalGaps.length > 0,
            server_time: new Date().toISOString(),
            is_first_message_today: (messageCount || 0) <= 1
        };
    } catch (e) {
        console.warn("[AI Service] Failed to fetch full context:", e);
        // Fallback: fetch at least height, age, gender so every AI message still receives demographics.
        try {
            const { data: fallbackProfile } = await (supabase as any)
                .from('users')
                .select('height, age, gender')
                .eq('id', userId)
                .maybeSingle();
            const profile = fallbackProfile || {};
            return {
                profile: { ...profile, weight: null },
                goals: {},
                today_stats: { total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0, steps: 0, water_ml: 0, sleep_hours: 0 },
                meals: [],
                memory: {},
                performance_summary: '',
                missing_critical_fields: [!profile?.height && 'height (CM)', !profile?.gender && 'gender', !profile?.age && 'age'].filter(Boolean) as string[],
                is_data_incomplete: true,
                server_time: new Date().toISOString(),
                is_first_message_today: true,
            };
        } catch (fallbackErr) {
            console.warn("[AI Service] Fallback demographics fetch failed:", fallbackErr);
            return {};
        }
    }
};

/**
 * AGGREGATOR: Cognitive Sync Performance Summary
 * Converts raw database history into a dense, descriptive summary for the AI Coach.
 */
const generatePerformanceSummary = (data: {
    weightHistory: any[],
    streaks: any[],
    todayStats: any,
    healthStats: any,
    currentWeight: number | null
}) => {
    const lines: string[] = [];

    // 1. Weight Analysis
    if (data.weightHistory && data.weightHistory.length > 1) {
        const current = data.weightHistory[0].weight;
        const previous = data.weightHistory[data.weightHistory.length - 1].weight;
        const delta = (current - previous).toFixed(1);
        const days = Math.round((new Date(data.weightHistory[0].date).getTime() - new Date(data.weightHistory[data.weightHistory.length - 1].date).getTime()) / (1000 * 60 * 60 * 24));
        lines.push(`WEIGHT TREND: ${delta}kg over the last ${days} days (Current: ${current}kg).`);
    } else if (data.currentWeight) {
        lines.push(`CURRENT WEIGHT: ${data.currentWeight}kg.`);
    }

    // 2. Consistency Analysis (Streaks)
    if (data.streaks && data.streaks.length > 0) {
        const streakText = data.streaks.map((s: any) => `${s.streak_type}: ${s.current_streak} days`).join(', ');
        lines.push(`STREAKS: ${streakText}.`);
    }

    // 3. Adherence Context (Today vs Goal)
    if (data.todayStats && data.todayStats.total_calories > 0) {
        const goal = data.todayStats.daily_calorie_goal || data.todayStats.calorie_goal;
        const remaining = (goal - data.todayStats.total_calories).toFixed(0);
        lines.push(`NUTRITION: Consumed ${data.todayStats.total_calories}kcal today. ${remaining}kcal remaining for goal.`);
    }

    // 4. Hydration & Activity
    if (data.healthStats) {
        const waterLitres = (data.healthStats.water_ml / 1000).toFixed(1);
        const steps = data.healthStats.steps || 0;
        const sleepHours = (data.healthStats.sleep_minutes / 60).toFixed(1);
        lines.push(`ACTIVITY: ${steps} steps today. HYDRATION: ${waterLitres}L. SLEEP: ${sleepHours} hours.`);
    }

    return lines.length > 0
        ? lines.join(' ')
        : "CRITICAL: No historical performance data found. System is running on default baselines. Data precision is required for accurate coaching.";
};

/**
 * Initializes AI memory for a new user based on their assessment answers.
 */
export const initializeUserMemory = async (userId: string, goals: string) => {
    try {
        const { error } = await (supabase as any)
            .from('user_ai_memory')
            .upsert({
                user_id: userId,
                personality_type: "Determined",
                communication_style: "Encouraging",
                primary_goal: goals,
                qualitative_hooks: ["Newly joined Gymz Athlete", "Focused on goal: " + goals],
                last_updated: new Date().toISOString()
            });

        if (error) throw error;
        console.log('[AI Service] Initial memory established for user');
    } catch (e) {
        console.warn('[AI Service] Memory initialization failed:', e);
    }
};

/**
 * Ultra-robust helper to clean AI responses from any JSON wrappers or artifacts.
 * Handles: full JSON, truncated JSON, stringified JSON, and escaped quotes.
 * Recursively attempts to find the deepest string value.
 */
const cleanAIResponse = (input: any): string => {
    if (!input) return "";

    // 1. If it's an object, extract the meaningful string
    if (typeof input === 'object' && input !== null) {
        // Prioritize known keys
        const candidate = input.reply || input.response || input.message || input.content || input.text;

        if (candidate) {
            // Recurse on the found value (it might be a JSON string itself)
            return cleanAIResponse(candidate);
        }

        // Check if any value is a long string (likely the message)
        for (const val of Object.values(input)) {
            if (typeof val === 'string' && val.length > 20) {
                return cleanAIResponse(val);
            }
        }

        // If no known key, fallback to stringifying (but this is last resort)
        return JSON.stringify(input);
    }

    // 2. If it's a string, handle JSON encoding or artifacts
    if (typeof input === 'string') {
        let text = input.trim();

        // Check if it's valid JSON
        if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
            try {
                const parsed = JSON.parse(text);
                return cleanAIResponse(parsed);
            } catch (e) {
                // Not valid JSON as a whole, try extracting JSON from within
                const start = text.indexOf('{');
                const end = text.lastIndexOf('}');
                if (start !== -1 && end !== -1 && end > start) {
                    try {
                        const extracted = text.substring(start, end + 1);
                        const parsed = JSON.parse(extracted);
                        return cleanAIResponse(parsed);
                    } catch (e2) { }
                }
            }
        }

        // Handle specific JSON-like key/value extraction if parsing failed
        const patterns = [
            /"response"\s*:\s*"((?:[^"\\]|\\.)*)"/i,
            /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/i,
            /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/i
        ];

        for (const p of patterns) {
            const match = text.match(p);
            if (match && match[1]) {
                return cleanAIResponse(match[1]);
            }
        }

        // Cleanup: remove leading/trailing quotes and common JSON artifacts
        let cleaned = text
            .replace(/^\s*{\s*"response"\s*:\s*"/i, '')
            .replace(/^\s*{\s*"reply"\s*:\s*"/i, '')
            .replace(/^\s*{\s*"/, '')
            .replace(/"\s*}\s*$/i, '')
            .replace(/}\s*$/, '')
            .replace(/^"/, '')
            .replace(/"$/, '');

        // Unescape common characters
        cleaned = cleaned
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '');

        return cleaned.trim();
    }

    return String(input);
};

/**
 * ACTION BRIDGE: Processes "Action Commands" returned by the AI to modify user settings.
 * Supports: Goals, Nutrition, Workouts, Tracking, Coaching Style, Tribes
 */
export async function handleAIActionTool(userId: string, actionJson: any) {
    try {
        console.log('[AI Action] Processing action:', actionJson.type, actionJson.data);

        switch (actionJson.type) {
            // === PROFILE MANAGEMENT (v6.0) ===
            case 'update_official_name':
                await (supabase as any)
                    .from('users')
                    .update({ first_name: actionJson.data.name })
                    .eq('id', userId);
                console.log('[AI Action] Updated official name to:', actionJson.data.name);
                break;

            case 'update_nickname':
                // Store nickname in key memories
                const nicknameMemory = `Preferred nickname: ${actionJson.data.nickname}`;
                try {
                    const { data: currentMemory } = await (supabase as any)
                        .from('user_ai_memory')
                        .select('key_memories')
                        .eq('user_id', userId)
                        .maybeSingle();

                    const existing = currentMemory?.key_memories || [];
                    const filtered = existing.filter((m: string) => !m.startsWith('Preferred nickname:'));

                    await (supabase as any)
                        .from('user_ai_memory')
                        .update({
                            key_memories: [...filtered, nicknameMemory],
                            last_updated: new Date().toISOString()
                        })
                        .eq('user_id', userId);
                    console.log('[AI Action] Updated nickname memory:', actionJson.data.nickname);
                } catch (e) {
                    console.warn('[AI Action] Nickname save failed:', e);
                }
                break;

            // === GOAL MANAGEMENT ===
            case 'update_user_profile':
                if (actionJson.data.name) {
                    await (supabase as any)
                        .from('users')
                        .update({ first_name: actionJson.data.name })
                        .eq('id', userId);
                    console.log('[AI Action] Updated official name to:', actionJson.data.name);
                }
                if (actionJson.data.nickname) {
                    // Store nickname in key memories since we don't have a column yet
                    const nicknameMemory = `Preferred nickname: ${actionJson.data.nickname}`;
                    try {
                        const { data: currentMemory } = await (supabase as any)
                            .from('user_ai_memory')
                            .select('key_memories')
                            .eq('user_id', userId)
                            .maybeSingle();

                        const existing = currentMemory?.key_memories || [];
                        // Remove old nickname memories to avoid clutter
                        const filtered = existing.filter((m: string) => !m.startsWith('Preferred nickname:'));

                        await (supabase as any)
                            .from('user_ai_memory')
                            .update({
                                key_memories: [...filtered, nicknameMemory],
                                last_updated: new Date().toISOString()
                            })
                            .eq('user_id', userId);
                        console.log('[AI Action] Updated nickname memory:', actionJson.data.nickname);
                    } catch (e) {
                        console.warn('[AI Action] Nickname save failed:', e);
                    }
                }
                break;

            case 'update_goal':
            case 'change_goal':
                await (supabase as any)
                    .from('users')
                    .update({ primary_objective: actionJson.data.goal })
                    .eq('id', userId);
                console.log('[AI Action] Updated primary goal to:', actionJson.data.goal);
                break;

            case 'update_target_weight':
                await (supabase as any)
                    .from('users')
                    .update({ target_weight: actionJson.data.weight })
                    .eq('id', userId);
                console.log('[AI Action] Updated target weight to:', actionJson.data.weight);
                break;

            case 'update_height':
                await (supabase as any)
                .from('users')
                .update({ height: actionJson.data.height })
                .eq('id', userId);
                console.log('[AI Action] Updated height to:', actionJson.data.height);
                break;
            
            case 'log_weight':
                await (supabase as any)
                .from('body_metrics')
                .insert({
                    user_id: userId,
                    weight: actionJson.data.weight,
                    date: new Date().toISOString().split('T')[0]
                });
                // Also update the main profile for immediate context sync
                await (supabase as any)
                .from('users')
                .update({ weight: actionJson.data.weight })
                .eq('id', userId);
                console.log('[AI Action] Logged new weight:', actionJson.data.weight);
                break;

            // === NUTRITION ADJUSTMENTS ===
            case 'update_calories':
                await (supabase as any)
                    .from('user_fitness_goals')
                    .update({ calories: actionJson.data.calories })
                    .eq('user_id', userId)
                    .eq('is_active', true);
                console.log('[AI Action] Updated calorie target to:', actionJson.data.calories);
                break;

            case 'update_macros':
                const macroUpdate: any = {};
                if (actionJson.data.protein) macroUpdate.protein = actionJson.data.protein;
                if (actionJson.data.carbs) macroUpdate.carbs = actionJson.data.carbs;
                if (actionJson.data.fat) macroUpdate.fat = actionJson.data.fat;

                await (supabase as any)
                    .from('user_fitness_goals')
                    .update(macroUpdate)
                    .eq('user_id', userId)
                    .eq('is_active', true);
                console.log('[AI Action] Updated macros:', macroUpdate);
                break;

            case 'update_dietary_restrictions':
                await (supabase as any)
                    .from('users')
                    .update({ dietary_restrictions: actionJson.data.restrictions })
                    .eq('id', userId);
                console.log('[AI Action] Updated dietary restrictions:', actionJson.data.restrictions);
                break;

            // === WORKOUT PREFERENCES ===
            case 'update_gold_hour':
            case 'update_workout_time':
                await (supabase as any)
                    .from('users')
                    .update({ preferred_workout_time: actionJson.data.time })
                    .eq('id', userId);
                console.log('[AI Action] Updated Gold Hour to:', actionJson.data.time);
                break;

            case 'update_workout_intensity':
                await (supabase as any)
                    .from('users')
                    .update({ workout_intensity: actionJson.data.intensity })
                    .eq('id', userId);
                console.log('[AI Action] Updated workout intensity to:', actionJson.data.intensity);
                break;

            case 'update_workout_focus':
                await (supabase as any)
                    .from('users')
                    .update({ workout_focus: actionJson.data.focus })
                    .eq('id', userId);
                console.log('[AI Action] Updated workout focus to:', actionJson.data.focus);
                break;

            // === TRACKING PREFERENCES ===
            case 'update_water_goal':
                await (supabase as any)
                    .from('user_fitness_goals')
                    .update({ water: actionJson.data.water })
                    .eq('user_id', userId)
                    .eq('is_active', true);
                console.log('[AI Action] Updated water goal to:', actionJson.data.water);
                break;

            case 'update_steps_goal':
                await (supabase as any)
                    .from('user_fitness_goals')
                    .update({ steps: actionJson.data.steps })
                    .eq('user_id', userId)
                    .eq('is_active', true);
                console.log('[AI Action] Updated steps goal to:', actionJson.data.steps);
                break;

            case 'update_sleep_goal':
                await (supabase as any)
                    .from('user_fitness_goals')
                    .update({ sleep_hours: actionJson.data.hours })
                    .eq('user_id', userId)
                    .eq('is_active', true);
                console.log('[AI Action] Updated sleep goal to:', actionJson.data.hours);
                break;

            // === AI COACHING STYLE ===
            case 'update_communication_style':
                await (supabase as any)
                    .from('user_ai_memory')
                    .update({
                        communication_style: actionJson.data.style,
                        last_updated: new Date().toISOString()
                    })
                    .eq('user_id', userId);
                console.log('[AI Action] Updated coaching style to:', actionJson.data.style);
                break;

            case 'update_notification_frequency':
                await (supabase as any)
                    .from('users')
                    .update({ notification_frequency: actionJson.data.frequency })
                    .eq('id', userId);
                console.log('[AI Action] Updated notification frequency to:', actionJson.data.frequency);
                break;

            case 'update_motivation_driver':
                await (supabase as any)
                    .from('user_ai_memory')
                    .update({
                        motivation_driver: actionJson.data.driver,
                        last_updated: new Date().toISOString()
                    })
                    .eq('user_id', userId);
                console.log('[AI Action] Updated motivation driver to:', actionJson.data.driver);
                break;

            case 'update_key_memory':
                // Use RPC or custom logic for array append
                // For simplicity here, we'll try to fetch and append if possible, 
                // but a better way is using .update({ key_memories: supabase.sql`array_append(key_memories, ${actionJson.data.memory})` }) if supported by client
                // Alternatively, just log it. 
                try {
                    const { data: currentMemory } = await (supabase as any)
                        .from('user_ai_memory')
                        .select('key_memories')
                        .eq('user_id', userId)
                        .maybeSingle();

                    const existing = currentMemory?.key_memories || [];
                    if (!existing.includes(actionJson.data.memory)) {
                        await (supabase as any)
                            .from('user_ai_memory')
                            .update({
                                key_memories: [...existing, actionJson.data.memory],
                                last_updated: new Date().toISOString()
                            })
                            .eq('user_id', userId);
                        console.log('[AI Action] Added key memory:', actionJson.data.memory);
                    }
                } catch (e) {
                    console.warn('[AI Action] Memory append failed:', e);
                }
                break;

            default:
                console.warn('[AI Action] Unknown action type:', actionJson.type);
        }
    } catch (e) {
        console.error('[AI Action] Execution failed:', e);
    }
}


/**
 * QUERY DISPATCHER: Fetches historical data from Supabase based on AI request.
 */
export async function handleAIQueryTool(userId: string, query: {
    metric_group: string,
    time_frame: string,
    granularity?: string
}) {
    try {
        console.log('[AI Query] Fetching:', query.metric_group, query.time_frame);

        const days = query.time_frame === '7_days' ? 7 :
            query.time_frame === '30_days' ? 30 :
                query.time_frame === '90_days' ? 90 : 180;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];

        let data: any = [];

        switch (query.metric_group) {
            case 'body_comp':
                const { data: weight } = await (supabase as any)
                    .from('body_metrics')
                    .select('date, weight, body_fat_percentage')
                    .eq('user_id', userId)
                    .gte('date', startDateStr)
                    .order('date', { ascending: true });
                data = weight || [];
                break;

            case 'nutrition':
                // Using daily_nutrition_logs (granular)
                const { data: nutrition } = await (supabase as any)
                    .from('daily_nutrition_logs')
                    .select('logged_at, calories, protein, carbs, fats')
                    .eq('user_id', userId)
                    .gte('logged_at', startDateStr)
                    .order('logged_at', { ascending: true });
                data = nutrition || [];
                break;

            case 'activity':
                // Using attendance_logs
                const { data: attendance } = await (supabase as any)
                    .from('attendance_logs')
                    .select('checkin_time, status')
                    .eq('user_id', userId)
                    .gte('checkin_time', startDate.toISOString())
                    .order('checkin_time', { ascending: true });
                data = attendance || [];
                break;

            case 'strength':
                // Using workout_sessions (Phase 4 schema) - handling potential missing table
                const { data: strength, error: sError } = await (supabase as any)
                    .from('workout_sessions')
                    .select('completed_at, duration') // Removed calories_burned as it wasn't in create_trackit_tables.sql
                    .eq('user_id', userId)
                    .gte('completed_at', startDate.toISOString())
                    .order('completed_at', { ascending: true });

                if (sError) {
                    console.warn('[AI Query] Strength table missing or error:', sError.message);
                    data = [];
                } else {
                    data = strength || [];
                }
                break;
        }

        // Apply sampling if needed for large datasets to stay within token limits
        if (Array.isArray(data) && data.length > 20) {
            const step = Math.ceil(data.length / 15);
            data = data.filter((_: any, i: number) => i % step === 0);
        }

        return data;
    } catch (e) {
        console.error('[AI Query] Failed to execute historical query:', e);
        return { error: "Failed to fetch historical data from the server." };
    }
}

/**
 * Builds a compact, token-efficient system instructions block for the AI coach.
 * Covers: identity, today's nutrition/macros, activity, weight progress, streaks, and memory directives.
 */
function buildUserSystemSummary(contextData: any): string {
    const p = contextData.profile || {};
    const today = contextData.today_stats || {};
    const goals = contextData.goals || {};
    const meals = contextData.meals || [];
    const memory = contextData.memory || {};
    const perf = contextData.performance_summary || '';

    // UNIVERSAL ROBUSTNESS: Support both camelCase (App) and snake_case (DB)
    const firstName = p.firstName || p.first_name;
    const lastName = p.lastName || p.last_name;
    const displayName = p.name || p.full_name || p.displayName;
    const name = firstName || displayName || 'User';
    const fullName = firstName && lastName ? `${firstName} ${lastName}` : (displayName || name);
    
    // Core Health Metrics
    const age = p.age || '?';
    const gender = p.gender || '?';
    const weight = p.weight || p.currentWeight || '?';
    const height = p.height || '?';
    const goal = p.primary_objective || p.goal || p.primaryObjective || goals.goalType || goals.goal_type || '?';
    const targetWeight = p.target_weight || p.targetWeight || '?';

    let bmiStr = '?';
    if (height !== '?' && weight !== '?') {
        const hNum = Number(height);
        const wNum = Number(weight);
        if (hNum > 0 && wNum > 0) bmiStr = (wNum / Math.pow(hNum / 100, 2)).toFixed(1);
    }

    // Today's Macros (Mapping to SSOT columns)
    const cal = today.total_calories || 0;
    const calGoal = goals.daily_calorie_goal || '?';
    const protein = today.total_protein || 0;
    const proteinGoal = goals.daily_protein_goal || '?';
    const carbs = today.total_carbs || 0;
    const carbsGoal = goals.daily_carbs_goal || '?';
    const fats = today.total_fats || 0;
    const fatsGoal = goals.daily_fats_goal || '?';
    
    // Other Activity
    const water = today.water_ml ? (today.water_ml / 1000).toFixed(1) : '?';
    const steps = today.steps || 0;
    const sleep = today.sleep_hours ? today.sleep_hours.toFixed(1) : '?';

    // Memory cues
    const nickname = (memory.key_memories || []).find((m: string) => m.startsWith('Preferred nickname:'))?.replace('Preferred nickname: ', '') || null;
    const keyMemories = (memory.key_memories || []).filter((m: string) => !m.startsWith('Preferred nickname:')).slice(0, 3).join(' | ');
    const commStyle = memory.communication_style || 'direct';
    const motivDriver = memory.motivation_driver || '?';

    // Derive AI persona from gender — checked BEFORE every reply
    const g = (p.gender || '').toLowerCase();
    const isFemale = g === 'female' || g === 'f' || g === 'woman' || g === 'girl';
    const aiName = isFemale ? 'Lily' : 'Tyson';
    
    const personaIntro = isFemale
        ? `You are ${aiName}, an elite AI Behavioral Psychologist and Fitness Strategist. You embody a sophisticated, assertive, and deeply intuitive female coaching persona. You are elegant, slightly hilarious in your wit, but completely uncompromising in your standards.`
        : `You are ${aiName}, an elite AI Behavioral Psychologist and Fitness Strategist. You embody a powerful, direct, and elite male coaching persona. You speak with no-nonsense intensity, raw discipline, and a dry, high-performance sense of humor.`;
    
    const userPronoun = isFemale ? 'she/her' : 'he/him';
    const nicknameLine = nickname
        ? `FULL NAME: ${fullName} (prefers "${nickname}", pronouns: ${userPronoun}).`
        : `FULL NAME: ${fullName} (pronouns: ${userPronoun}).`;
    const dietaryLine = (p.dietary_restrictions && Array.isArray(p.dietary_restrictions) && p.dietary_restrictions.length > 0)
        ? ` Dietary restrictions: ${p.dietary_restrictions.join(', ')}.`
        : '';

    const lines: string[] = [
        `=== GYMZ COACH SYSTEM INSTRUCTIONS ===`,
        ``,
        `## 1. YOUR IDENTITY (THE ADVISOR)`,
        `NAME: ${aiName}`,
        `ROLE: ${personaIntro}`,
        `MANDATE: You are an authority. Advisors do not guess; they know. If data is missing, state you need it before advising.`,
        ``,
        `## 2. THE HUMAN YOU ARE ADVISING (THE CLIENT)`,
        `${nicknameLine} Age: ${age}. Gender: ${gender}. Height: ${height}cm. Weight: ${weight}kg (BMI: ${bmiStr}, Target: ${targetWeight}kg). Goal: ${goal}.${dietaryLine}`,
        ``,
        `## 3. LIVE CONTEXT (GROUND TRUTH)`,
        `DATE: ${new Date().toLocaleDateString('en-GB')}`,
        `MEALS LOGGED TODAY: ${meals.length > 0 ? meals.join(' | ') : 'No meals logged yet today.'}`,
        `NUTRITION: Calories ${cal}/${calGoal}kcal | P: ${protein}/${proteinGoal}g | C: ${carbs}/${carbsGoal}g | F: ${fats}/${fatsGoal}g`,
        `ACTIVITY: ${steps} steps | Water: ${water}L | Sleep: ${sleep}h`,
        `PROGRESS: ${perf || 'No historical trends yet.'}`,
        `MEMORY: Style: ${commStyle}. Driver: ${motivDriver}. Facts: ${keyMemories || 'None.'}`,
        ``,
        `## 4. STRICT COMMUNICATION PROTOCOL`,
        `1. BE EXTREMELY BRIEF: Respond in 1-3 sentences max. Eliminate all fluff and filler.`,
        `2. NO HALLUCINATIONS: Never confuse the user's name (${fullName}) with your name (${aiName}).`,
        `3. NO GUESSWORK: Base every word strictly on the numbers in Section 3. Do not assume lunch, workouts, or status if not logged.`,
        `4. TONE: Be human, slightly hilarious, and elite. You are a high-level advisor, not a chatbot.`,
        `5. HYPER-WEAVE: Actively mention their specific BMI, total calories, or goal in your brief response to prove you are analyzing their live data.`,
        ``,
        `=== END OF SYSTEM INSTRUCTIONS ===`,
    ];

    return lines.join('\n');
}

/**
 * UNIFIED AI ROUTER (Phase 2)
 * Decides whether to use Direct OpenAI or Make.com Webhook.
 * Now uses cached ai_settings to avoid duplicate DB queries.
 */
export const postToAI = async (
    creds: ChatCredentials,
    messageText: string,
    contextData: any = {},
    interactionType: 'coach' | 'community' = 'coach',
    history?: { role: string; content: string }[]
): Promise<WebhookResponse> => {
    try {
        // 1. Fetch AI settings (CACHED — no duplicate DB hit)
        const settings = await getCachedAISettings();
        const provider = settings?.ai_provider || 'make';

        // 2. Normalize profile for consistency
        const age = contextData.profile?.age || contextData.age;
        const height = contextData.profile?.height || contextData.height;
        const weight = contextData.profile?.weight || contextData.weight || contextData.currentWeight || contextData.profile?.currentWeight;
        const gender = contextData.profile?.gender || contextData.gender;
        const name = contextData.profile?.firstName || contextData.profile?.first_name || contextData.profile?.name || contextData.name || contextData.firstName;

        if (!contextData.profile && (age || height || weight || gender || name)) {
            contextData.profile = { age, height, weight, gender, firstName: name };
        } else if (contextData.profile) {
            if (!contextData.profile.age && age) contextData.profile.age = age;
            if (!contextData.profile.height && height) contextData.profile.height = height;
            if (!contextData.profile.weight && weight) contextData.profile.weight = weight;
            if (!contextData.profile.gender && gender) contextData.profile.gender = gender;
            if (!contextData.profile.firstName && !contextData.profile.first_name && name) contextData.profile.firstName = name;
        }

        // Ensure height, age, gender always reach the AI: if still missing after normalization, fetch from DB.
        const p = contextData.profile ?? {};
        const missingDemographics = (p.height == null || p.height === '') || (p.age == null || p.age === '') || (p.gender == null || p.gender === '');
        if (missingDemographics && creds?.userId) {
            try {
                const { data: row } = await (supabase as any).from('users').select('height, age, gender').eq('id', creds.userId).maybeSingle();
                if (row) {
                    if (!contextData.profile) contextData.profile = {};
                    if (p.height == null || p.height === '') contextData.profile.height = row.height;
                    if (p.age == null || p.age === '') contextData.profile.age = row.age;
                    if (p.gender == null || p.gender === '') contextData.profile.gender = row.gender;
                }
            } catch (_) {
                // Non-fatal; edge function will fill from DB when using OpenAI
            }
        }

        // 3. Build comprehensive system instructions (coach mode only)
        const basePrompt = settings?.system_prompt || '';
        const userSummary = interactionType === 'coach' ? buildUserSystemSummary(contextData) : '';
        const enhancedSystemPrompt = [basePrompt, userSummary].filter(Boolean).join('\n\n');

        // 🔍 DEBUG: Print the exact system prompt being sent
        console.log('\n========= [AI SYSTEM PROMPT] =========');
        console.log(`Provider: ${provider} | Mode: ${interactionType}`);
        console.log(`Gender: ${contextData.profile?.gender || 'NOT FOUND'}`);
        console.log(userSummary || '(no user summary built)');
        console.log('======================================\n');

        if (provider === 'openai' && interactionType === 'coach') {
            try {
                return await postToOpenAIEdgeFunction(creds, messageText, contextData, enhancedSystemPrompt, history);
            } catch (edgeErr) {
                console.warn('[AI Router] Edge Function openai-chat failed, falling back to direct OpenAI', edgeErr);
                const postToOpenAIFn = await getPostToOpenAI();
                return await postToOpenAIFn(creds, messageText, contextData, interactionType, { ...settings, system_prompt: enhancedSystemPrompt });
            }
        }

        return await postToInstructor(creds, messageText, contextData, interactionType);

    } catch (error) {
        console.warn('[AI Router] Primary provider failed, falling back to Make.com', error);
        return await postToInstructor(creds, messageText, contextData, interactionType);
    }
};

/**
 * Sends a message to the Make.com webhook.
 * Connects to the URL configured in ai_settings table.
 */
export const postToInstructor = async (
    creds: ChatCredentials,
    messageText: string,
    contextData: any = {},
    interactionType: 'coach' | 'community' = 'coach'
): Promise<WebhookResponse> => {
    // 1. Fetch Dynamic Webhook URL
    const webhookUrl = await fetchWebhookUrl() || WEBHOOK_URL;

    // Build system instructions for this message
    const systemInstructions = interactionType === 'community'
        ? "PUBLIC FORUM: Use user name/vibe but DO NOT REVEAL specific health stats. Keep it general."
        : buildUserSystemSummary(contextData);

    // 2. Construct Unified Payload
    const payload = {
        source: interactionType === 'community' ? "mobile_community_chat" : "mobile_personal_ai",
        sender_type: "user",
        user_id: creds.userId,
        thread_id: creds.threadId,
        chat_id: creds.chatId,
        message: messageText,
        timestamp: new Date().toISOString(),
        system_instructions: systemInstructions,
        context: {
            ...contextData,
            platform: "mobile",
            interaction_role: interactionType,
        }
    };

    try {
        // 3. Network Request (with 30s timeout to prevent infinite hangs)
        const response = await fetchWithTimeout(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        }, 30000);

        const responseText = await response.text();

        if (!response.ok) {
            console.error("AI Instructor Webhook Error:", responseText);
            throw new Error(`Webhook Error: ${response.status}`);
        }

        // 4. Parse & Clean Response
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.warn("Failed to parse AI JSON response, attempting clean string extraction", responseText);
            data = { reply: responseText };
        }

        // 5. EXTRACT ACTIONS (NEW)
        if (data.action) {
            handleAIActionTool(creds.userId, data.action);
        } else if (typeof data.reply === 'string' && data.reply.includes('{"action":')) {
            // Check if action is embedded in the reply string
            try {
                const match = data.reply.match(/\{"action":.*\}/);
                if (match) {
                    const actionJson = JSON.parse(match[0]);
                    handleAIActionTool(creds.userId, actionJson.action);
                }
            } catch (e) { }
        }

        const finalReply = cleanAIResponse(data);

        if (interactionType === 'community') {
            const usage = data.usage && (typeof data.usage.prompt_tokens === 'number' || typeof data.usage.completion_tokens === 'number')
                ? data.usage
                : null;
            logCommunityChatTokenUsage(creds.userId, usage, data.model_used ?? null).catch(() => {});
        }

        return {
            reply: finalReply,
            thread_id: data.thread_id || creds.threadId,
            chat_id: data.chat_id || creds.chatId,
        };

    } catch (error) {
        console.error("AI Instructor Network Error:", error);
        throw error;
    }
};

// Helper to save to local storage
async function saveToLocalHistory(userId: string, msg: any) {
    try {
        const key = `chat_history_${userId}`;
        const raw = await AsyncStorage.getItem(key);
        const history = raw ? JSON.parse(raw) : [];
        // Prepend new message (assuming newest first logic in standard, but let's check)
        // Usually we retrieve newest first (desc).
        history.unshift(msg);
        // Limit to 100 locally for safety
        if (history.length > 200) history.pop();
        await AsyncStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
        console.warn("Local save failed", e);
    }
}

/**
 * Stores a user or AI message in Supabase + Local Backup.
 */
export const storeMessage = async (
    creds: ChatCredentials,
    sender: 'user' | 'ai',
    message: string
): Promise<any> => {
    // 1. Prepare Message Object
    const msgObj = {
        user_id: creds.userId,
        chat_id: creds.chatId,
        thread_id: creds.threadId,
        sender,
        message,
        timestamp: new Date().toISOString()
    };

    // 2. Local Backup Save (Fire & Forget)
    saveToLocalHistory(creds.userId, {
        id: createUUID(),
        sender,
        text: message,
        time: msgObj.timestamp,
        chatId: creds.chatId
    });

    // 3. Supabase Save
    try {
        const { data, error } = await (supabase as any)
            .from('conversations')
            .insert([msgObj])
            .select();

        if (error) {
            console.error('[AI Service] DB Store Error:', error);
            // Don't throw if local worked, just return null or throw to let UI know DB failed?
            // User prefers "It just works". If local works, we are good for now.
            return null;
        }
        console.log("[DB] Message stored successfully:", data);
        return data;
    } catch (dbError) {
        console.error('[AI Service] DB Connection Error:', dbError);
        return null;
    }
};

// Keep old name for backward compatibility
export const logMessageToHistory = storeMessage;

/**
 * Fetches recent conversations for the user.
 * ROBUST STRATEGY: Checks 'conversations' -> 'ai_messages' -> Local Storage.
 */
export async function fetchConversations(
    userId: string,
    threadId: string,
    chatId?: string,
    limit: number = 50,
    beforeTimestamp?: Date
): Promise<any[]> {
    let dbData: any[] = [];
    let dbError = null;

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('History lookup timed out')), 5000)
        );

        // Strategy 1: Try 'conversations' table (Primary)
        let query = (supabase as any)
            .from('conversations')
            .select('id, sender, message, timestamp, chat_id')
            .eq('user_id', userId);

        // MERGED HISTORY: specific chat filter only if NOT 'ALL'
        if (chatId && chatId !== 'ALL') {
            query = query.eq('chat_id', chatId);
        } else if (!chatId && threadId) {
            query = query.eq('thread_id', threadId);
        }
        // If chatId is 'ALL', we skip both above and get everything for user

        if (beforeTimestamp) query = query.lt('timestamp', beforeTimestamp.toISOString());

        query = query.order('timestamp', { ascending: false }).limit(limit);

        const { data, error } = await Promise.race([query, timeoutPromise]) as any;

        if (!error && data) {
            dbData = data.map((msg: any) => ({
                id: msg.id || msg.timestamp,
                sender: msg.sender,
                text: msg.message,
                time: new Date(msg.timestamp),
                chatId: msg.chat_id
            }));
            if (dbData.length > 0) {
                // Sync local storage if we got DB data? (Optional, maybe later)
            }
        } else if (error) {
            dbError = error;
            console.log('[AI Service] DB Query issued, but failed or blocked:', error.message);
        }

    } catch (e) {
        dbError = e;
    }

    // Strategy 2: If DB returned nothing (new user OR error), check Local Storage
    if (dbData.length === 0) {
        try {
            const key = `chat_history_${userId}`;
            const raw = await AsyncStorage.getItem(key);
            if (raw) {
                const localData = JSON.parse(raw);
                // Filter if needed? Local data is usually everything.
                // Apply limit
                let filteredLocalData = localData;
                if (chatId && chatId !== 'ALL') {
                    filteredLocalData = localData.filter((msg: any) => msg.chatId === chatId);
                } else if (!chatId && threadId) {
                    // If no chatId but threadId, filter by threadId (legacy)
                    filteredLocalData = localData.filter((msg: any) => msg.threadId === threadId); // Assuming local history also stores threadId
                }

                console.log('[AI Service] Recovered history from Local Storage');
                return filteredLocalData.slice(0, limit);
            }
        } catch (localError) {
            console.warn('Local history fetch failed', localError);
        }
    }

    return dbData;
}

/**
 * Fetches unique chat sessions for the user to allow "picking a topic".
 */
/**
 * Fetches unique chat sessions for the user to allow "picking a topic".
 */
export async function getChatHistoryGroups(userId: string): Promise<any[]> {
    try {
        const groups: any[] = [];
        const seenChats = new Set();

        // 1. Fetch from 'conversations'
        const { data: primaryData } = await (supabase as any)
            .from('conversations')
            .select('chat_id, message, timestamp')
            .eq('user_id', userId)
            .eq('sender', 'user')
            .order('timestamp', { ascending: false });

        if (primaryData) {
            for (const msg of primaryData) {
                if (!seenChats.has(msg.chat_id)) {
                    seenChats.add(msg.chat_id);
                    groups.push({
                        chatId: msg.chat_id,
                        title: msg.message.substring(0, 40) + (msg.message.length > 40 ? '...' : ''),
                        timestamp: new Date(msg.timestamp)
                    });
                }
            }
        }

        // 2. Fetch from 'ai_messages' (Fallback)
        try {
            const { data: legacyData, error: legacyError } = await (supabase as any)
                .from('ai_messages')
                .select('session_id, message, created_at')
                .eq('user_id', userId)
                .eq('sender', 'user')
                .order('created_at', { ascending: false });

            if (legacyData && !legacyError) {
                for (const msg of legacyData) {
                    const cid = msg.session_id;
                    if (!seenChats.has(cid)) {
                        seenChats.add(cid);
                        groups.push({
                            chatId: cid,
                            title: (msg.message || '').substring(0, 40) + ((msg.message?.length || 0) > 40 ? '...' : ''),
                            timestamp: new Date(msg.created_at)
                        });
                    }
                }
            } else if (legacyError && legacyError.code !== 'PGRST205') {
                console.warn("[AI Service] Legacy history fetch error:", legacyError);
            }
        } catch (e) {
            console.warn("[AI Service] Legacy history catch error:", e);
        }

        // Sort combined results by timestamp desc
        return groups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    } catch (error) {
        console.error("Error fetching chat history groups:", error);
        return [];
    }
}



/**
 * Fetches the active webhook URL from ai_settings.
 */
export async function fetchWebhookUrl(): Promise<string | null> {
    try {
        const { data, error } = await (supabase as any)
            .from("ai_settings")
            .select("webhook_url")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) return null;
        return data?.webhook_url || WEBHOOK_URL;
    } catch (error) {
        return WEBHOOK_URL;
    }
}

/**
 * Send message to Make.ai webhook specifically for Community Chat.
 */
export async function sendMessageToWebhookImmediately(
    messageId: string,
    userId: string,
    messageContent: string,
    senderType: string = 'user',
    messageCreatedAt: string = new Date().toISOString(),
    additionalContext: any = {}
) {
    try {
        const webhookUrl = await fetchWebhookUrl() || WEBHOOK_URL;

        const communityThreadId = `community_${userId}`;

        // Privacy Guard Logic
        const privacyInstruction = "PUBLIC FORUM (NOTICE BOARD): Use user name/vibe but DO NOT REVEAL specific health stats, weight, or medical goals. Focus on community support.";

        const payload = {
            source: "mobile_community_chat",
            sender_type: senderType,
            user_id: userId,
            thread_id: communityThreadId,
            chat_id: `session_${messageId}`,
            message: messageContent,
            timestamp: messageCreatedAt,
            context: {
                ...additionalContext,
                message_id: messageId,
                original_source: 'mobile_community_board',
                interaction_role: 'community',
                privacy_instruction: privacyInstruction
            }
        };

        const response = await fetchWithTimeout(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        }, 30000);

        const responseText = await response.text();

        if (!response.ok) {
            // Use warn so users don't see LogBox overlay; AI reply is optional, chat still works
            console.warn("[Community AI] Webhook unavailable:", responseText);
            return;
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { reply: responseText };
        }

        const finalReply = cleanAIResponse(data);

        const usage = data.usage && (typeof data.usage.prompt_tokens === 'number' || typeof data.usage.completion_tokens === 'number')
            ? data.usage
            : null;
        logCommunityChatTokenUsage(userId, usage, data.model_used ?? null).catch(() => {});

        if (finalReply) {
            await postAIMessageToNoticeBoard(finalReply, userId, messageId);
        }
    } catch (error) {
        // Fire-and-forget: don't surface to user; their message was already posted
        console.warn("[Community AI] Webhook request failed:", error);
    }
}

/**
 * Post an AI message to the notice board as admin_assist.
 */
export async function postAIMessageToNoticeBoard(
    content: string,
    userId?: string,
    replyTo?: string
): Promise<void> {
    try {
        const { data: adminUser } = await (supabase as any)
            .from("users")
            .select("id")
            .eq("role", "admin")
            .limit(1)
            .maybeSingle();

        const aiUserId = userId || adminUser?.id;
        if (!aiUserId) return;

        await (supabase as any).from("notice_board").insert({
            user_id: aiUserId,
            content: content.trim(),
            sender_type: "admin_assist",
            reply_to: replyTo || null,
        });
    } catch (error) {
        console.error("Error posting AI reply to notice board:", error);
    }
}
