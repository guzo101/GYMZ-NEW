/**
 * AI Chat Service
 * 
 * Manages all AI Chat interactions with the "Coach" personality.
 * Handles proactive messages, data-aware responses, and template management.
 * 
 * Coach Personality:
 * - Supportive but direct
 * - Data-aware (references metrics)
 * - Accountability-focused
 * - Celebrates wins
 * - Non-judgmental
 * - Gym-centric
 */

import { supabase } from './supabase';
export { supabase };
import { engagementCoordinator, EngagementScenario } from './engagementCoordinator';
import { gymRetentionService } from './gymRetentionService';
import { streakService } from './streakService';

// Re-export legacy functions from aiChat.ts for backward compatibility
import * as legacy from './aiChat';
export const getSessionIdentifiers = legacy.getSessionIdentifiers;
export const clearChatMessages = legacy.clearChatMessages;
export const getUserMemory = legacy.getUserMemory;
export const getUserFullContext = legacy.getUserFullContext;
export const postToAI = legacy.postToAI;
export const fetchConversations = legacy.fetchConversations;
export const getChatHistoryGroups = legacy.getChatHistoryGroups;
export const createUUID = legacy.createUUID;
export const storeMessage = legacy.storeMessage;
export type ChatCredentials = legacy.ChatCredentials;

interface ChatMessage {
    id: string;
    userId: string;
    messageType: 'ai_proactive' | 'ai_response' | 'user_message';
    content: string;
    context?: Record<string, any>;
    createdAt: Date;
}

interface ProactiveMessageOptions {
    userId: string;
    scenario: EngagementScenario;
    context?: Record<string, any>;
}

interface AIResponse {
    content: string;
    tokensUsed: number;
    cost: number;
    generationTime: number;
}

/**
 * Message templates organized by category
 * Variables: {streak}, {gym_visits_week}, {first_name}, {day}, {time}, {metric}
 */
const MESSAGE_TEMPLATES = {
    // ===== MISSED GYM DAY =====
    missed_gym_day: [
        "Hey {first_name}! 👋 I noticed you usually hit the gym on {day} mornings. Everything okay? 💙",
        "Missing you today! You're usually here by now. Still planning to come? 💪",
        "{day}s are usually your gym day. Life got in the way? No judgment, just checking in. 💙",
        "Hey! Noticed you haven't checked in yet. Your body might be missing that {day} workout. 🏋️",
        "Quick check-in: You good? You usually crush it on {day}s. Everything alright? 💙",
        "Haven't seen you today and it's your usual gym slot. Rest day or just running late? 😊",
        "Your {day} streak is strong! Don't let today break it. Still got time! 💪",
        "Real talk: I know {day}s can be tough, but your future self will thank you for going. 💙",
    ],

    // ===== POST GYM CHECK-IN =====
    post_gym_checkin: [
        "Saw you crushed a gym session! 💪 How'd it go? What did you train today?",
        "Nice! You checked in. What are we hitting today? Legs? Back? Arms? 🔥",
        "You showed up! That's 80% of the battle. What's the focus today? 💪",
        "Let's go! 🔥 Another gym visit in the books. Log your workout so we can track progress!",
        "Love the consistency! How's the energy today? Crushing it or just surviving? 😅",
        "You're here! 💪 Remember to log your workout after so I can celebrate with you! 🎉",
        "Another check-in! You're building a real habit here. What's on the menu today? 🏋️",
        "The hardest part was showing up. You did it! Now make it count. 🔥",
    ],

    // ===== NO DAILY LOG =====
    no_daily_log: [
        "Hey! You haven't logged anything today. Too busy or just forgot? Quick meal entry? 📝",
        "Your {streak}-day streak is waiting for you. One quick log keeps it alive! 🔥",
        "No logs today yet. Everything okay? Even a quick breakfast entry counts! 💙",
        "Just a reminder: You've got a {streak}-day logging streak. Don't break it now! 💪",
        "Hey {first_name}! Missing your log today. What did you eat? Let's keep the streak going! 📝",
        "Quick nudge: One meal log before midnight keeps your streak alive. You got this! 🔥",
        "I know life gets busy. But 30 seconds to log = streak protected. Worth it! 💙",
        "Real talk: Logging is boring, but it works. Quick entry? 📝",
    ],

    // ===== STREAK IN DANGER (Evening) =====
    streak_danger: [
        "‼️ QUICK! Log one meal before midnight. Your {streak}-day streak is too valuable! 🔥",
        "⏰ Streak alert! {streak} days on the line. 10 seconds. One entry. Let's go! 💪",
        "Your {streak}-day streak is about to break! Don't let it end like this! 🔥",
        "HOLD UP! 🚨 {streak} days of consistency. Don't lose it now. Quick log? 📝",
        "You've logged {streak} days in a row. That's too impressive to lose. One entry! ⏰",
        "⚠️ Midnight approaching. {streak}-day streak at risk. You got this! 💙",
    ],

    // ===== STREAK MILESTONE =====
    streak_milestone: [
        "🔥 {streak} DAYS! 🔥 You're not messing around. This is REAL consistency! 💪",
        "MILESTONE UNLOCKED! {streak} days straight! You should be proud of yourself! 🎉",
        "{streak} days! 💪 Most people quit after 3. You're building something real here! 🔥",
        "Look at you! {streak} consecutive days. That's not luck, that's discipline! 💙",
        "{streak} DAYS! The person you were {streak} days ago would be proud. 🎉",
        "🎊 {streak}-DAY STREAK! 🎊 You're in the top 1% of our members! Keep going! 🔥",
        "{streak} days of showing up. That's how champions are built. 💪",
    ],

    // ===== LAPSED USER (2 DAYS) =====
    lapsed_2_days: [
        "Haven't heard from you in 2 days. Everything okay? 💙",
        "Hey! 2 days MIA. Life got busy? No judgment, just checking in. 😊",
        "Missing you! It's been 2 days. Everything alright? 💙",
        "Quick check-in: You've been quiet for 2 days. All good? 💪",
        "Hey {first_name}! Haven't seen you in a couple days. Taking a break or need support? 💙",
        "2 days off the grid. Rest days are important, but don't forget your goals! 😊",
    ],

    // ===== LAPSED USER (7 DAYS) =====
    lapsed_7_days: [
        "Real talk: It's been a week. Are you still working toward your fitness goals? Let's chat. 💙",
        "I haven't heard from you in 7 days. Are we still doing this? 💪",
        "One week silence. That's not like you. What's going on? 💙",
        "Hey... 7 days. That's usually when people give up. But you're not most people, right? 💪",
        "Been a whole week. Life happens, I get it. But your goals are still waiting. Ready to come back? 💙",
        "7 days gone. The gym hasn't forgotten about you. Have you forgotten about it? 💪",
        "Week-long break. Rest is good. But too much rest is just quitting. Where are you at? 💙",
    ],

    // ===== PATTERN DETECTED (Weekend Drop) =====
    pattern_detected: [
        "I noticed something: You crush it Mon-Fri but weekends are hit or miss. Let's fix that pattern! 💪",
        "Pattern alert: Your logging drops every weekend. What's the blocker? 💙",
        "You're a weekday warrior! But weekends matter too. What makes them harder? 🤔",
        "Data doesn't lie: Weekends are your weak spot. Let's strategize! 💪",
        "Weekdays: 💪 Weekends: 😴. I see you! Let's talk about evening what's happening. 💙",
    ],

    // ===== WEEKLY CONSISTENCY CELEBRATION =====
    weekly_recap: [
        "Week recap: {gym_visits_week} gym visits! 💪 You're building real momentum! 🔥",
        "This week: {gym_visits_week} check-ins. That's {percent}% better than last week! 📈",
        "Weekly check-in: {gym_visits_week} gym sessions + {log_days} days logged. Solid work! 💪",
        "You hit the gym {gym_visits_week} times this week! That consistency adds up! 🔥",
        "Week in review: You showed up {gym_visits_week} times. That's how progress happens! 💙",
    ],

    // ===== POST-WORKOUT LOGGING REMINDER =====
    post_workout_log: [
        "You crushed that session! 💪 Log your workout while it's fresh. What did you hit?",
        "Great workout! Don't forget to log it. Your future self wants to see that progress! 📝",
        "Nice session! Quick log = progress tracked. What exercises did you crush? 🔥",
        "Workout complete! 💪 30 seconds to log it. Let's capture that progress! 📝",
        "You put in the work. Now log it so we can celebrate the gains! 💪",
    ],

    // ===== POST-WORKOUT NUTRITION =====
    post_workout_nutrition: [
        "Recovery starts NOW! 🍗 What's your post-workout meal? Protein is key! 💪",
        "You trained. Now fuel the recovery! Log that post-workout nutrition. 📝",
        "Workout = done. Nutrition = ? Don't skip the recovery meal! 🍗",
        "Your muscles are begging for protein right now! What are you eating? 💪",
        "Post-workout window! This is prime nutrition time. Log your meal! 📝",
    ],

    // ===== MORNING NUTRITION =====
    morning_nutrition: [
        "Morning {first_name}! 🌅 Pre-workout fuel or breakfast? Log it! 🥑",
        "Good morning! Your gym performance starts with breakfast. What are you eating? 🍳",
        "Rise and grind! ☀️ Breakfast logged yet? Fuel matters! 📝",
        "Morning! Don't skip breakfast before the gym. What's on the plate? 🥞",
        "New day, new opportunity! Start with a solid breakfast. Log it! 🌅",
    ],

    // ===== LUNCH NUTRITION =====
    lunch_nutrition: [
        "Lunch break! 🍽️ Recovery nutrition matters. What are you having? 📝",
        "Midday fuel check! Lunch logged yet? Keep that metabolism fired up! 🔥",
        "Lunch time! Your afternoon performance depends on this meal. Log it! 🍗",
        "Halfway through the day. Have you logged lunch? Let's see it! 📝",
    ],

    // ===== DINNER NUTRITION =====
    dinner_nutrition: [
        "Dinner time! 🌙 End your day with good nutrition. What's for dinner? 🍽️",
        "Evening! Wrap up your nutrition for the day. Log dinner! 📝",
        "Last meal of the day. Make it count! What are you eating? 🌙",
        "Dinner = final nutrition win of the day. Log it! 💪",
    ],

    // ===== GYM VISIT REMINDER (Morning) =====
    gym_visit_reminder: [
        "Morning! ☀️ It's {day}. Your usual gym day! You going? 💪",
        "{day} morning! I've got you down for a gym session. Still on? 🏋️",
        "Rise and grind! Your typical gym time is {time}. See you there? 💪",
        "Hey! {day}s are your day! Don't break the pattern. 🔥",
        "Gym reminder: You usually go on {day}s. Keeping the routine? 💪",
    ],
};

/**
 * System prompt generator for AI Coach personality
 */
const getAICoachSystemPrompt = (gender: string, firstName: string, age?: number, weight?: number, height?: number) => {
  const isFemale = (gender || '').toLowerCase() === 'female';
  const name = isFemale ? "Lily" : "Tyson";
  
  const metricsContext = `
USER DATA:
- Age: ${age || "Not provided"}
- Weight: ${weight || "Not provided"} ${weight ? 'kg' : ''}
- Height: ${height || "Not provided"} ${height ? 'cm' : ''}
`;
  
  const personaIntro = isFemale
    ? `You are "${name}", an elite AI Behavioral Psychologist and Fitness Strategist. You embody a sophisticated, assertive, and deeply intuitive female coaching persona. You are elegant but uncompromising.`
    : `You are "${name}", an elite AI Behavioral Psychologist and Fitness Strategist. You embody a powerful, direct, and elite male coaching persona. You speak with no-nonsense intensity and focus on raw discipline.`;

  return `${personaIntro} You are also known as "The Compass" because you see the truth in the user's data better than they do.
${metricsContext}
CORE DOCTRINE:
- TRUTH OVER COMFORT: You provide the data ${firstName} NEEDS, not the words they WANT.
- NO SPECULATION: If they ask for Metabolic or Nutrition deep-dives without provided metrics (Height/Weight), you REFUSE and demand the data first.
- PATTERN RECOGNITION: You analyze streaks, gaps, and WoW (Week-over-Week) trends to diagnose behavioral friction.

PERSONALITY TRAITS:
- Assertive & Direct: You speak with absolute authority. No "I think" or "Maybe".
- High-Performance Standards: You expect discipline. If ${firstName} is failing their protein target or logging inconsistently, confront the data point.
- Wise & Analytical: You are a clinical expert. Your advice is surgical and context-aware.

COMMUNICATION STYLE:
- Punchy and Powerful. 1-2 diagnostic sentences > long-winded fluff.
- Use "we" for the goal, "you" for the accountability.
- Use strategic emojis: 🎯, 📊, 🧠, 🔥.
- Reference their context naturally (e.g., "At your age of [Age]..." or "As a ${isFemale ? 'woman' : 'man'}...").

DATA INTEGRITY:
- If critical data is MISSING, you are "operationally limited". PUSH ${firstName} to fill the gap.
- "I don't guess. I diagnose. Give me your [Field] so we can fix the trajectory."`;
};

class AIChatService {
    /**
     * Send proactive AI message based on behavior trigger
     */
    async sendProactiveMessage(options: ProactiveMessageOptions): Promise<{ success: boolean; message?: string }> {
        try {
            const { userId, scenario, context = {} } = options;

            // 1. Check if we can send via engagement coordinator
            const routing = await engagementCoordinator.routeMessage(userId, scenario, context);

            if (!routing.canSend || routing.channel === 'push') {
                return { success: false, message: routing.reason };
            }

            // 2. Get user data for template personalization
            const userData = await this.getUserDataForTemplate(userId);

            // 3. Select and populate template
            const messageContent = await this.selectAndPopulateTemplate(scenario, userData, context);

            // 4. Send as AI Chat proactive message
            await this.saveAIMessage(userId, 'ai_proactive', messageContent, scenario, context);

            // 5. Log outreach
            await engagementCoordinator.logAIChatMessage(userId);

            return { success: true, message: messageContent };
        } catch (error) {
            console.error('[AIChatService] Error sending proactive message:', error);
            return { success: false, message: 'Failed to send message' };
        }
    }

    /**
     * Handle user message and generate AI response
     */
    async handleUserMessage(userId: string, userMessage: string): Promise<string> {
        try {
            // 1. Save user's message
            await this.saveAIMessage(userId, 'user_message', userMessage);

            // 2. Get conversation history (last 10 messages)
            const history = await this.getConversationHistory(userId, 10);

            // 3. Get user context for data-aware responses
            const userData = await this.getUserDataForTemplate(userId);

            // 4. Generate AI response using LLM
            const aiResponse = await this.generateAIResponse(userMessage, history, userData);

            // 5. Save AI response
            await this.saveAIMessage(
                userId,
                'ai_response',
                aiResponse.content,
                undefined,
                userData,
                aiResponse.tokensUsed,
                aiResponse.cost,
                aiResponse.generationTime
            );

            return aiResponse.content;
        } catch (error) {
            console.error('[AIChatService] Error handling user message:', error);
            return "Hey! I'm having trouble right now. Can you try again? 💙";
        }
    }

    /**
     * Select template based on scenario and variant testing
     */
    private async selectAndPopulateTemplate(
        scenario: EngagementScenario,
        userData: Record<string, any>,
        context: Record<string, any>
    ): Promise<string> {
        try {
            // 1. Try to fetch from database first (Admin-controlled)
            const { data: dbTemplates } = await supabase
                .from('notification_templates')
                .select('content')
                .eq('category', scenario.replace(/_/g, ' ')) // Categories are often space-separated in DB
                .eq('enabled', true)
                .eq('channel', 'ai_chat');

            let templates: string[] = (dbTemplates || []).map((t: any) => t.content);

            // 2. Fallback to hardcoded templates if DB is empty
            if (templates.length === 0) {
                templates = MESSAGE_TEMPLATES[scenario] || [];
            }

            // 3. Absolute fallback if still empty
            if (templates.length === 0) {
                return `Hey ${userData.first_name}! Quick check-in from Coach. How's it going? 💪`;
            }

            // 4. Randomly select template (for A/B testing variety)
            const template = templates[Math.floor(Math.random() * templates.length)];

            // 5. Populate template with user data
            return this.populateTemplate(template, userData, context);
        } catch (error) {
            console.error('[AIChatService] Error selecting template:', error);
            const fallbackTemplates = MESSAGE_TEMPLATES[scenario] || [];
            const template = fallbackTemplates[0] || `Hey! Checking in. 💙`;
            return this.populateTemplate(template, userData, context);
        }
    }

    /**
     * Populate template with user data
     */
    private populateTemplate(
        template: string,
        userData: Record<string, any>,
        context: Record<string, any>
    ): string {
        let message = template;

        // Replace all variables
        const replacements: Record<string, string> = {
            '{first_name}': userData.first_name || 'there',
            '{streak}': userData.current_streak?.toString() || '0',
            '{gym_visits_week}': userData.gym_visits_week?.toString() || '0',
            '{day}': context.day || this.getDayName(new Date().getDay()),
            '{time}': userData.typical_gym_time || '7:00 AM',
            '{percent}': context.percent?.toString() || '0',
            '{log_days}': context.log_days?.toString() || '0',
        };

        Object.keys(replacements).forEach(key => {
            message = message.replace(new RegExp(key, 'g'), replacements[key]);
        });

        return message;
    }

    /**
     * Get user data for template personalization
     */
    private async getUserDataForTemplate(userId: string): Promise<Record<string, any>> {
        try {
            // Get user profile
            const { data: user } = await supabase
                .from('users')
                .select('first_name, gender, typical_gym_time, typical_gym_days, age, height, weight, target_weight')
                .eq('id', userId)
                .single() as { data: any };

            // Get streak data
            const streakData = await streakService.getCurrentStreak(userId, 'nutrition_log');

            // Get gym visit stats
            const gymStats = await gymRetentionService.getGymVisitStats(userId);

            return {
                first_name: user?.first_name || 'there',
                gender: user?.gender || 'male',
                typical_gym_time: user?.typical_gym_time || null,
                typical_gym_days: user?.typical_gym_days || [],
                age: user?.age,
                height: user?.height,
                weight: user?.weight,
                target_weight: user?.target_weight,
                current_streak: streakData.currentStreak,
                longest_streak: streakData.longestStreak,
                gym_visits_week: gymStats.visitsThisWeek,
                gym_visits_month: gymStats.visitsThisMonth,
                days_since_gym: gymStats.daysSinceLastVisit,
            };
        } catch (error) {
            console.error('[AIChatService] Error getting user data:', error);
            return {};
        }
    }

    /**
     * Generate AI response using LLM (Gemini/OpenAI)
     */
    private async generateAIResponse(
        userMessage: string,
        history: ChatMessage[],
        userData: Record<string, any>
    ): Promise<AIResponse> {
        const startTime = Date.now();

        try {
            // 1. Get session credentials (threadId, chatId)
            const creds = await getSessionIdentifiers(userData.userId);

            // 2. Prepare context for AI
            const contextData = {
                profile: {
                    first_name: userData.first_name,
                    gender: userData.gender,
                    age: userData.age,
                    height: userData.height,
                    weight: userData.weight,
                    target_weight: userData.target_weight,
                },
                current_streak: userData.current_streak,
                longest_streak: userData.longest_streak,
                gym_visits_week: userData.gym_visits_week,
                days_since_gym: userData.days_since_gym,
                system_prompt: getAICoachSystemPrompt(userData.gender, userData.first_name, userData.age, userData.weight, userData.height)
            };

            // 3. Call the actual AI provider (Make.com or Direct OpenAI)
            const response = await postToAI(creds, userMessage, contextData, 'coach');

            const generationTime = Date.now() - startTime;

            return {
                content: response.reply,
                tokensUsed: 150, // Estimate or actual if available
                cost: 0.0015,    // Estimate or actual if available
                generationTime,
            };
        } catch (error) {
            console.error('[AIChatService] LLM error:', error);
            return {
                content: "I'm having trouble processing that right now. Can we talk in a bit? 💙",
                tokensUsed: 0,
                cost: 0,
                generationTime: Date.now() - startTime,
            };
        }
    }

    /**
     * Save AI message to database
     */
    private async saveAIMessage(
        userId: string,
        messageType: 'ai_proactive' | 'ai_response' | 'user_message',
        content: string,
        templateUsed?: string,
        context?: Record<string, any>,
        tokenCount?: number,
        cost?: number,
        generationTime?: number
    ): Promise<void> {
        try {
            await supabase.from('ai_chat_history').insert({
                user_id: userId,
                message_type: messageType,
                content,
                template_used: templateUsed,
                context,
                token_count: tokenCount,
                cost_usd: cost,
                generation_time_ms: generationTime,
                llm_model: 'gpt-3.5-turbo', // or whatever model you use
            } as any);
        } catch (error) {
            console.error('[AIChatService] Error saving message:', error);
        }
    }

    /**
     * Get conversation history
     */
    private async getConversationHistory(userId: string, limit: number = 10): Promise<ChatMessage[]> {
        const { data } = await supabase
            .from('ai_chat_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit) as { data: any[] | null };

        if (!data) return [];

        return data.map((m: any) => ({
            id: m.id,
            userId: m.user_id,
            messageType: m.message_type,
            content: m.content,
            context: m.context,
            createdAt: new Date(m.created_at),
        })).reverse(); // Reverse to get chronological order
    }

    /**
     * Helper: Get day name from day number
     */
    private getDayName(day: number): string {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[day];
    }

    /**
     * Mark message as read
     */
    async markMessageAsRead(messageId: string): Promise<void> {
        await (supabase
            .from('ai_chat_history' as any) as any)
            .update({ read_at: new Date().toISOString() })
            .eq('id', messageId);
    }

    /**
     * Get unread message count
     */
    async getUnreadCount(userId: string): Promise<number> {
        const { count } = await (supabase
            .from('ai_chat_history' as any)
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('read_at', null)
            .in('message_type', ['ai_proactive', 'ai_response']) as any);

        return count || 0;
    }
}

export const aiChatService = new AIChatService();
export { MESSAGE_TEMPLATES, getAICoachSystemPrompt };
