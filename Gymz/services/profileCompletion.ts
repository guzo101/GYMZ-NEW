import { supabase } from './supabase';

/**
 * Profile Completion Checker
 * Identifies missing user data that the AI should proactively request
 */

export interface ProfileGaps {
    missingFields: string[];
    priority: 'high' | 'medium' | 'low';
    nextQuestion?: string;
}

const CRITICAL_FIELDS = ['goal', 'height', 'weight', 'gender'];
const IMPORTANT_FIELDS = ['target_weight', 'preferred_workout_time', 'workout_intensity'];
const OPTIONAL_FIELDS = ['workout_focus', 'dietary_restrictions'];

export async function checkProfileCompleteness(userId: string): Promise<ProfileGaps> {
    try {
        const { data: user } = await (supabase as any)
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (!user) {
            return { missingFields: [], priority: 'low' };
        }

        const missing: string[] = [];

        // Check critical fields
        if (!user.goal) missing.push('goal');
        if (!user.height) missing.push('height');
        if (!user.weight) missing.push('weight');
        if (!user.gender) missing.push('gender');

        // Check important fields
        if (!user.target_weight && user.goal?.toLowerCase().includes('weight')) {
            missing.push('target_weight');
        }
        if (!user.preferred_workout_time) missing.push('preferred_workout_time');
        if (!user.workout_intensity) missing.push('workout_intensity');

        // Check optional fields
        if (!user.workout_focus) missing.push('workout_focus');
        if (!user.dietary_restrictions || user.dietary_restrictions.length === 0) {
            missing.push('dietary_restrictions');
        }

        // Determine priority
        const hasCriticalGaps = missing.some(f => CRITICAL_FIELDS.includes(f));
        const hasImportantGaps = missing.some(f => IMPORTANT_FIELDS.includes(f));

        let priority: 'high' | 'medium' | 'low' = 'low';
        if (hasCriticalGaps) priority = 'high';
        else if (hasImportantGaps) priority = 'medium';

        // Generate next question
        let nextQuestion: string | undefined;
        if (missing.length > 0) {
            nextQuestion = generateNaturalQuestion(missing[0], user);
        }

        return {
            missingFields: missing,
            priority,
            nextQuestion
        };
    } catch (error) {
        console.error('[Profile Checker] Error:', error);
        return { missingFields: [], priority: 'low' };
    }
}

function generateNaturalQuestion(field: string, user: any): string {
    const name = user.first_name || 'there';
    const age = user.age || user.metadata?.age;
    const gender = user.gender || user.metadata?.gender;
    const isYoung = age && age < 25;
    const isOld = age && age > 50;

    // Assertive, Persona-Driven responses
    const questions: Record<string, string[]> = {
        goal: [
            `Listen ${name}, we can't build a clear path if I don't know the destination. Are we training for maximum strength, fat loss, or just overall health? Tell me now.`,
            `${name}, I need your primary objective. I'm not here to let you wander; what are we actually trying to achieve?`,
            `Stop stalling, ${name}. What's the target? Muscle gain, weight loss, or performance? I need this to start your program.`
        ],
        height: [
            `I need your height, ${name}. It's non-negotiable for your BMI and metabolic math. How tall are you in CM?`,
            `${name}, without your height, my calorie calculations are just guesses. Type your height in CM so we can be accurate.`,
            `Let's get the facts straight. How tall are you? (CM)`
        ],
        weight: [
            `Step on the scale, ${name}. I need your current weight in KG to track your efficiency. No excuses.`,
            `We can't track progress if we don't have a starting point. Current weight in KG? Let's go.`,
            `${name}, your weight is the baseline for everything we do. Give me the number (KG).`
        ],
        gender: [
            `Biologically, I need to know your gender for hormonal and metabolic baselines, ${name}. Male or Female?`,
            `Metabolism works differently for men and women. Which are you?`,
            `Standard health metrics require a gender baseline. Which one applies to you, ${name}?`
        ],
        target_weight: [
            `You want to change? Then give me the target weight. What are we aiming for (KG)?`,
            `${name}, if we're doing this, we're doing it right. What's the goal weight?`,
            `Don't just say 'lose weight'. Give me a number. Target weight?`
        ]
    };

    // Personalized Flavour for non-critical but important fields
    const morningVibe = isYoung ? "Rise and grind" : "Good morning";
    const beastVibe = isYoung ? "beast mode" : "high efficiency";

    const secondaryQuestions: Record<string, string[]> = {
        preferred_workout_time: [
            `${morningVibe} ${name}. When's the Gold Hour? I need to know when you're hitting the iron so I can keep you accountable.`,
            `Discipline starts with a schedule. When are you training?`,
        ],
        workout_intensity: [
            `${name}, are we going for ${beastVibe} or just a maintenance cruise? I need to know how hard to push you.`,
            `Be honest: what's your intensity level? I don't do 'average'.`,
        ],
        dietary_restrictions: gender === 'female' ? [
            `Any specific dietary needs ${name}? I'll adjust the plan to make sure your recovery is optimal.`,
            `Veggie, keto, or balanced? Tell me your fuel preference.`
        ] : [
            `What's the fuel plan ${name}? Any restrictions I should know about before I set your macros?`,
            `Tell me what you won't eat so I can tell you what you MUST eat.`
        ]
    };

    let choices = questions[field] || secondaryQuestions[field];

    // Add Age/Gender specific assertive prefixes
    if (CRITICAL_FIELDS.includes(field)) {
        const prefix = gender === 'male' ? "Brother, " : gender === 'female' ? "Sister, " : "";
        const agePrefix = isYoung ? "Look, " : isOld ? "At this stage, " : "";

        const finalChoices = choices.map(q => `${agePrefix}${prefix}${q}`);
        return finalChoices[Math.floor(Math.random() * finalChoices.length)];
    }

    const options = choices || [`I'm missing your ${field}. Update it now so we can move forward.`];
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Determines if it's time to send a proactive message
 */
export async function shouldSendProactiveMessage(userId: string): Promise<boolean> {
    try {
        // Check last proactive message time
        const { data: lastMessage } = await (supabase as any)
            .from('conversations')
            .select('timestamp')
            .eq('user_id', userId)
            .eq('sender', 'ai')
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastMessage) {
            const hoursSinceLastMessage =
                (Date.now() - new Date(lastMessage.timestamp).getTime()) / (1000 * 60 * 60);

            // Don't send if AI messaged in last 12 hours
            if (hoursSinceLastMessage < 12) return false;
        }

        // Check profile completeness
        const gaps = await checkProfileCompleteness(userId);

        // Only send if there are high or medium priority gaps
        return gaps.priority === 'high' || gaps.priority === 'medium';
    } catch (error) {
        console.error('[Proactive Check] Error:', error);
        return false;
    }
}

/**
 * Generates a proactive message for the user
 */
export async function generateProactiveMessage(userId: string): Promise<string | null> {
    try {
        const gaps = await checkProfileCompleteness(userId);

        if (gaps.missingFields.length === 0) return null;

        return gaps.nextQuestion || null;
    } catch (error) {
        console.error('[Proactive Message] Error:', error);
        return null;
    }
}
