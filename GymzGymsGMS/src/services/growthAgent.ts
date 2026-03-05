import { supabase } from "@/integrations/supabase/client";
import { sendToMakeAI, randomUUID } from "./aiChat";

export interface GrowthContext {
    userId: string;
    name: string;
    goal?: string;
    membershipStatus: string;
    daysUntilExpiry?: number;

    // Workout Intelligence
    totalWorkouts?: number;
    lastWorkoutDate?: string;
    daysSinceLastWorkout?: number;
    favoriteExercises?: string[];
    personalBests?: { exercise: string; weight: number }[];

    // Attendance Patterns
    averageWeeklyVisits?: number;
    longestStreak?: number;
    currentStreak?: number;

    // Nutrition Intelligence (Level 4)
    nutrition?: {
        recentLogsCount: number;
        lastLogDate?: string;
        averageCalories?: number;
        problemArea?: string; // e.g. "Low Protein", "High Sugar"
    };

    // AI Memory (Level 4)
    memory?: {
        communicationStyle?: string;
        motivationDriver?: string;
        keyMemories?: string[];
        lastSentiment?: string;
    };
}

/**
 * Build a RICH context including Nutrition and AI Memory
 */
export async function buildGrowthContext(userId: string): Promise<GrowthContext | null> {
    try {
        // 1. Basic User Profile
        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();

        if (error || !user) return null;

        // ... [Existing calculation logic for expiry/duration] ...
        let daysUntilExpiry = 0;
        if (user.renewal_due_date) {
            daysUntilExpiry = Math.ceil(
                (new Date(user.renewal_due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );
        }

        // 2. Attendance & Workouts
        const { data: attendanceLogs } = await supabase
            .from("attendance_logs")
            .select("checkin_time")
            .eq("user_id", userId)
            .order("checkin_time", { ascending: false })
            .limit(100);

        const totalCheckIns = attendanceLogs?.length || 0;
        const lastCheckIn = attendanceLogs?.[0]?.checkin_time;
        const daysSinceLastWorkout = lastCheckIn ? Math.ceil((new Date().getTime() - new Date(lastCheckIn).getTime()) / (1000 * 60 * 60 * 24)) : 0;

        // 3. Nutrition Intelligence (Level 4)
        const { data: nutritionLogs } = await supabase
            .from("daily_nutrition_logs")
            .select("calories, protein, sugar, logged_at")
            .eq("user_id", userId)
            .order("logged_at", { ascending: false })
            .limit(7);

        let nutritionInfo = undefined;
        if (nutritionLogs && nutritionLogs.length > 0) {
            const avgCal = nutritionLogs.reduce((sum, log) => sum + (log.calories || 0), 0) / nutritionLogs.length;
            const avgProt = nutritionLogs.reduce((sum, log) => sum + (log.protein || 0), 0) / nutritionLogs.length;

            let problem = "";
            if (avgProt < 50) problem = "Low Protein";

            nutritionInfo = {
                recentLogsCount: nutritionLogs.length,
                lastLogDate: nutritionLogs[0].logged_at,
                averageCalories: Math.round(avgCal),
                problemArea: problem
            };
        }

        // 4. AI Memory (Level 4)
        // Try/Catch block in case table doesn't exist yet
        let memoryInfo = undefined;
        try {
            const { data: memory } = await supabase
                .from("user_ai_memory")
                .select("*")
                .eq("user_id", userId)
                .maybeSingle();

            if (memory) {
                memoryInfo = {
                    communicationStyle: memory.communication_style,
                    motivationDriver: memory.motivation_driver,
                    keyMemories: memory.key_memories,
                    lastSentiment: memory.last_interaction_sentiment
                };
            }
        } catch (e) {
            // Table might not exist yet, ignore
            console.log("Memory table check skipped");
        }

        return {
            userId: user.id,
            name: user.name || "friend",
            goal: user.goal || "fitness",
            membershipStatus: user.membership_status || "Inactive",
            daysUntilExpiry,

            // Workout Context
            totalWorkouts: totalCheckIns,
            lastWorkoutDate: lastCheckIn,
            daysSinceLastWorkout,

            // New Level 4 Context
            nutrition: nutritionInfo,
            memory: memoryInfo
        };
    } catch (err) {
        console.error("Error building growth context:", err);
        return null;
    }
}

/**
 * Generate Draft with Dynamic Hook Selection (Level 4 Randomization)
 */
export async function generateDraft(context: GrowthContext, type: 'renewal' | 'win_back'): Promise<string> {

    // Dynamic Hook Selector
    const hook = selectConversationHook(context);

    const prompt = `
    You are the personal growth coach for ${context.name}.
    Context:
    - Status: ${type === 'renewal' ? 'Expiring soon' : 'Inactive/Missing'}
    - Goal: ${context.goal}
    - Communication Style: ${context.memory?.communicationStyle || 'Supportive but direct'}
    
    CURRENT SITUATION (Focus on this):
    ${hook.description}
    
    Task: Write a short, personal text (max 2 sentences).
    - Use the "Hook" above to make it specific.
    - If style is 'tough_love', be firmer. If 'supportive', be gentler.
    - NO generic marketing fluff.
    `;

    try {
        const response = await sendToMakeAI("admin", context.userId, randomUUID(), randomUUID(), prompt);
        return response.reply;
    } catch (err) {
        return "";
    }
}

function selectConversationHook(context: GrowthContext): { type: string, description: string } {
    const hooks = [];

    // 1. Nutrition Hook
    if (context.nutrition && context.nutrition.recentLogsCount > 0) {
        if (context.nutrition.problemArea) {
            hooks.push({
                type: 'nutrition_gap',
                description: `User has been logging food but is struggling with ${context.nutrition.problemArea}. Offer a specific tip.`
            });
        } else {
            hooks.push({
                type: 'nutrition_win',
                description: `User has tracked ${context.nutrition.recentLogsCount} meals recently. Celebrate their consistency.`
            });
        }
    }

    // 2. Workout Hook
    if (context.daysSinceLastWorkout && context.daysSinceLastWorkout > 14) {
        hooks.push({
            type: 'workout_ghost',
            description: `It's been ${context.daysSinceLastWorkout} days since last workout. Acknowledge the slump without shame.`
        });
    } else if (context.totalWorkouts && context.totalWorkouts > 50) {
        hooks.push({
            type: 'veteran_status',
            description: `They are a veteran with ${context.totalWorkouts} visits. Appeal to their identity as a consistent person.`
        });
    }

    // 3. Memory Hook
    if (context.memory?.keyMemories && context.memory.keyMemories.length > 0) {
        // Pick random memory
        const memory = context.memory.keyMemories[Math.floor(Math.random() * context.memory.keyMemories.length)];
        hooks.push({
            type: 'memory_callback',
            description: `Reference this specific memory: "${memory}". Ask how it's going.`
        });
    }

    // Default Fallback
    if (hooks.length === 0) {
        return {
            type: 'general_checkin',
            description: `General wellness check-in. user is working towards ${context.goal}.`
        };
    }

    // Random selection weighted by novelty could go here, for now simple random
    return hooks[Math.floor(Math.random() * hooks.length)];
}

export async function saveDraft(userId: string, message: string, type: string, metadata: any = {}): Promise<any> {
    const { data, error } = await supabase
        .from("pending_outreach")
        .insert({
            user_id: userId,
            message,
            type,
            metadata,
            status: 'drafted'
        })
        .select()
        .single();
    if (error) return null;
    return data;
}

/**
 * Scan for all at-risk members and generate drafts for them.
 */
export async function draftAllAtRiskMembers(): Promise<{ renewals: number, winbacks: number }> {
    const today = new Date();
    const next7Days = new Date();
    next7Days.setDate(today.getDate() + 7);
    const past7Days = new Date();
    past7Days.setDate(today.getDate() - 7);

    let renewalsDrafted = 0;
    let winbacksDrafted = 0;

    // Get expiring users
    const { data: expiring } = await supabase
        .from("users")
        .select("id")
        .eq("role", "member")
        .eq("membership_status", "Active")
        .gte("renewal_due_date", today.toISOString())
        .lte("renewal_due_date", next7Days.toISOString());

    // Get recently expired users
    const { data: expired } = await supabase
        .from("users")
        .select("id")
        .eq("role", "member")
        .eq("membership_status", "Inactive")
        .gte("renewal_due_date", past7Days.toISOString())
        .lt("renewal_due_date", today.toISOString());

    const hasRecentOutreach = async (userId: string) => {
        const last7DaysCheck = new Date();
        last7DaysCheck.setDate(today.getDate() - 7);
        const { data } = await supabase
            .from("pending_outreach")
            .select("id")
            .eq("user_id", userId)
            .gte("created_at", last7DaysCheck.toISOString())
            .limit(1);
        return (data || []).length > 0;
    };

    // Process Expiring
    for (const u of (expiring || [])) {
        if (await hasRecentOutreach(u.id)) continue;
        const context = await buildGrowthContext(u.id);
        if (context) {
            const message = await generateDraft(context, 'renewal');
            if (message) {
                await saveDraft(u.id, message, 'renewal', {
                    auto_generated: true,
                    context_summary: selectConversationHook(context).description
                });
                renewalsDrafted++;
            }
        }
    }

    // Process Expired
    for (const u of (expired || [])) {
        if (await hasRecentOutreach(u.id)) continue;
        const context = await buildGrowthContext(u.id);
        if (context) {
            const message = await generateDraft(context, 'win_back');
            if (message) {
                await saveDraft(u.id, message, 'win_back', {
                    auto_generated: true,
                    context_summary: selectConversationHook(context).description
                });
                winbacksDrafted++;
            }
        }
    }

    return { renewals: renewalsDrafted, winbacks: winbacksDrafted };
}
