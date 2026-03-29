import { supabase } from './supabase';
import { postToAI, getUserFullContext, ChatCredentials } from './aiChat';
import { nutritionService } from './nutritionService';

export const nutritionAIService = {
    /**
     * Generates a hilarious, brief, and goal-oriented nutrition feedback.
     * Constraint: Max 3 lines per paragraph.
     */
    async generateFeedback(userId: string, lastMealName?: string): Promise<string> {
        console.log(`[NutritionAIService] Generating feedback for user: ${userId}`);

        try {
            // 1. Get full context
            const context = await getUserFullContext(userId);

            // 2. Prepare specialized instructions
            const personalityPrompt = `
                You are the Gymz Smart Coach. Your personality is HILARIOUS, NO-FILTER, and ELITE.
                You are talking to an athlete. If they overeat, mock them gently but keep them goal-oriented.
                If they eat clean, encourage them but stay punchy.
                
                STRICT CONSTRAINTS:
                1. BE BRIEF.
                2. Maximum 3 lines per paragraph.
                3. Break your sentences for readability.
                4. Max 2 paragraphs total.
                5. Use casual language.
                
                Last meal: ${lastMealName || 'N/A'}
                Context:
                - Calories eaten today: ${context.today_stats?.total_calories || 0}
                - Calorie Goal: ${context.goals?.daily_calorie_goal || 1800}
                - Protein eaten: ${context.today_stats?.total_protein || 0}
                - Protein Goal: ${context.goals?.daily_protein_goal || 150}
                - Fitness Goal: ${context.profile?.primary_objective || 'General Health'}
            `;

            const creds: ChatCredentials = {
                userId,
                threadId: `nutrition_coach_${userId}`,
                chatId: `nutrition_session_${new Date().toISOString().split('T')[0]}`
            };

            // 3. Request AI response
            const response = await postToAI(creds, "Give me a quick nutrition check-in based on my logs today.", context, 'coach');

            // 4. Extract and clean the reply
            const feedback = response.reply;

            // 5. Persist the feedback (metadata pattern)
            await this.saveFeedback(userId, feedback);

            return feedback;
        } catch (error) {
            console.error('[NutritionAIService] Feedback generation failed:', error);
            return "Just keep tracking. I'm busy judging your fridge right now.";
        }
    },

    /**
     * Saves the latest AI feedback to the daily_calorie_summary metadata.
     */
    async saveFeedback(userId: string, feedback: string): Promise<void> {
        const today = new Date().toISOString().split('T')[0];
        try {
            // Check if record exists
            const { data: existing } = await (supabase as any)
                .from('daily_calorie_summary')
                .select('id, metadata')
                .eq('user_id', userId)
                .eq('date', today)
                .maybeSingle();

            if (existing) {
                await (supabase as any)
                    .from('daily_calorie_summary')
                    .update({
                        metadata: {
                            ...(existing.metadata || {}),
                            ai_feedback: feedback,
                            last_updated: new Date().toISOString()
                        }
                    })
                    .eq('id', existing.id);
            } else {
                // Upsert logic for summary if it doesn't exist yet
                await (supabase as any)
                    .from('daily_calorie_summary')
                    .upsert({
                        user_id: userId,
                        date: today,
                        metadata: {
                            ai_feedback: feedback,
                            last_updated: new Date().toISOString()
                        }
                    });
            }
        } catch (e) {
            console.error('[NutritionAIService] Failed to save feedback:', e);
        }
    },

    /**
     * Fetches the latest stored AI feedback for today.
     */
    async getTodayFeedback(userId: string): Promise<string | null> {
        const today = new Date().toISOString().split('T')[0];
        try {
            const { data } = await (supabase as any)
                .from('daily_calorie_summary')
                .select('metadata')
                .eq('user_id', userId)
                .eq('date', today)
                .maybeSingle();

            return data?.metadata?.ai_feedback || null;
        } catch (e) {
            console.warn('[NutritionAIService] Failed to fetch today\'s feedback:', e);
            return null;
        }
    }
};
