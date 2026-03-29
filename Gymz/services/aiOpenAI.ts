import { supabase } from './supabase';
import type { ChatCredentials, WebhookResponse } from './aiTypes';
// Lazy import handlers to break circular dependency
let handleAIActionTool: any = null;
let handleAIQueryTool: any = null;
const getHandlers = async () => {
    if (!handleAIActionTool || !handleAIQueryTool) {
        const aiChatModule = await import('./aiChat');
        handleAIActionTool = aiChatModule.handleAIActionTool;
        handleAIQueryTool = aiChatModule.handleAIQueryTool;
    }
    return { handleAIActionTool, handleAIQueryTool };
};
import { getCachedAISettings, fetchWithTimeout } from './aiUtils';

/**
 * Default system prompt if database is unavailable.
 */
/**
 * Default system prompt (Master Coach Profile)
 */
const getDefaultSystemPrompt = (): string => {
    return `You are the user's Personal Nutrition & Performance Coach (and "The Compass": an elite AI Behavioral Psychologist and Fitness Strategist for Gymz). You have full access to their live data every message—profile, goals, today's nutrition/macros, activity, sleep, and stored preferences. Never say you don't have their data.

CUSTOMIZED: Use their name/nickname and actual numbers (calories, protein, goals, dietary restrictions) in every relevant reply.
CASUAL WHEN APPROPRIATE: Match their communication style from memory; be warm and brief when it fits.
PROFESSIONAL: Evidence-based nutrition and fitness; tie recommendations to their data. If a metric is missing, ask once then use it.

PRINCIPLES: (1) Truth over affirmation—call out when actions contradict goals. (2) Diagnose the "Why", not just stats. (3) Use performance_summary for 360° view and WoW trends. (4) Request missing critical data (weight, height, age) as prerequisite.

Treat the injected USER CONTEXT as your single source of truth. Capture new facts via update_key_memory. If data is null, say: "I'm currently blind to your [metric]. I need that data to guide you properly."

SAFETY: You are a coach, not a doctor. Do not give medical advice. For eating disorders, allergies, pregnancy, or chronic conditions, recommend they see a doctor or dietitian. Never suggest foods that conflict with stated allergies."`;
};

/**
 * OpenAI Function Calling Schema
 * Defines all available actions the AI can execute.
 */
const getOpenAITools = () => [
    {
        type: "function",
        function: {
            name: "query_performance_history",
            description: "Fetch dynamic historical data to analyze trends, plateaus, or PRs. Use this before answering questions about progress or consistency.",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    metric_group: {
                        type: "string",
                        enum: ["body_comp", "nutrition", "activity", "strength"],
                        description: "The category of metrics to retrieve"
                    },
                    time_frame: {
                        type: "string",
                        enum: ["7_days", "30_days", "90_days", "quarter_to_date"],
                        description: "How far back to look"
                    },
                    granularity: {
                        type: "string",
                        enum: ["daily", "weekly_avg"],
                        description: "Resolution of the data (Daily for short terms, Weekly for long terms)"
                    }
                },
                required: ["metric_group", "time_frame", "granularity"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_goal",
            description: "Update user's primary fitness goal",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    goal: {
                        type: "string",
                        enum: ["lose_weight", "build_muscle", "maintain", "athletic_performance"],
                        description: "The slug representing the goal in the database"
                    }
                },
                required: ["goal"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_target_weight",
            description: "Update user's target weight in kg",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    weight: { type: "number", description: "Target weight in kg" }
                },
                required: ["weight"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_calories",
            description: "Update daily calorie target (Use only if user specifically requests a custom value)",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    calories: { type: "number", description: "Daily calorie target" }
                },
                required: ["calories"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_macros",
            description: "Update macro nutrient targets (grams)",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    protein: { type: "number", description: "Protein in grams" },
                    carbs: { type: "number", description: "Carbs in grams" },
                    fat: { type: "number", description: "Fat in grams" }
                },
                required: ["protein", "carbs", "fat"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_gold_hour",
            description: "Update preferred workout time (Gold Hour)",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    time: { type: "string", description: "Preferred time in HH:MM format (e.g., '17:30')" }
                },
                required: ["time"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_height",
            description: "Update user's height in cm",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    height: { type: "number", description: "Height in cm" }
                },
                required: ["height"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "log_weight",
            description: "Log a new current weight entry for the user. Use this when the user reports their current weight in chat.",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    weight: { type: "number", description: "Current weight in kg" }
                },
                required: ["weight"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_official_name",
            description: "Update the user's official first name in their profile.",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Official first name" }
                },
                required: ["name"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_nickname",
            description: "Update the user's preferred nickname in their memory.",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    nickname: { type: "string", description: "Preferred nickname via update_nickname" }
                },
                required: ["nickname"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_water_goal",
            description: "Update daily water intake goal (ml)",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    water: { type: "number", description: "Water goal in milliliters" }
                },
                required: ["water"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_steps_goal",
            description: "Update daily steps goal",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    steps: { type: "number", description: "Daily steps target" }
                },
                required: ["steps"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_sleep_goal",
            description: "Update daily sleep goal (hours)",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    hours: { type: "number", description: "Target sleep hours" }
                },
                required: ["hours"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_key_memory",
            description: "Add a significant qualitative fact to the user's permanent memory (e.g. 'Training for a wedding', 'Recovering from injury')",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    memory: { type: "string", description: "The important fact to remember" }
                },
                required: ["memory"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_motivation_driver",
            description: "Update what primarily drives the user's fitness motivation",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    driver: {
                        type: "string",
                        enum: ["competition", "health", "appearance", "mental_clarity", "social"],
                        description: "The primary motivation driver"
                    }
                },
                required: ["driver"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_communication_style",
            description: "Update the AI coaching tone (Communication Style)",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    style: {
                        type: "string",
                        enum: ["direct", "supportive", "analytical", "enthusiastic", "tough_love"],
                        description: "Tone and style of coaching"
                    }
                },
                required: ["style"],
                additionalProperties: false
            }
        }
    }
];

/**
 * Direct OpenAI API Integration (NEW)
 * Bypasses Make.com for faster, cheaper responses with native function calling.
 * Now accepts optional pre-fetched settings to avoid duplicate DB queries.
 */
export const postToOpenAI = async (
    creds: ChatCredentials,
    messageText: string,
    contextData: any = {},
    interactionType: 'coach' | 'community' = 'coach',
    cachedSettings?: any
): Promise<WebhookResponse> => {
    try {
        // 1. Use cached settings if provided, otherwise fetch (with cache)
        const settings = cachedSettings || await getCachedAISettings();

        const apiKey = settings?.openai_api_key;
        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const model = settings?.scanner_model || 'gpt-4o';
        const systemPrompt = settings?.system_prompt || getDefaultSystemPrompt();

        // 2. Build conversation history (last 20 messages for context)
        const { data: history } = await (supabase as any)
            .from('conversations')
            .select('sender, message')
            .eq('user_id', creds.userId)
            .eq('chat_id', creds.chatId)
            .order('timestamp', { ascending: false })
            .limit(20);

        const messages: any[] = [
            { role: 'system', content: systemPrompt }
        ];

        if (contextData && Object.keys(contextData).length > 0) {
            messages.push({
                role: 'system',
                name: 'user_context',
                content: `CURRENT USER CONTEXT: ${JSON.stringify(contextData)}`
            });
        }

        // Add history
        if (history && history.length > 0) {
            history.reverse().forEach((msg: any) => {
                messages.push({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.message
                });
            });
        }

        messages.push({ role: 'user', content: messageText });

        // 4. Call OpenAI Loop
        let aiMessage: any;
        const currentMessages = [...messages];
        let iterations = 0;

        while (iterations < 2) {
            const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: currentMessages,
                    tools: getOpenAITools(),
                    tool_choice: 'auto',
                    temperature: 0.7
                })
            }, 30000);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[OpenAI] API Error:', errorText);
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            aiMessage = data.choices[0].message;
            currentMessages.push(aiMessage);

            if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0) {
                break;
            }


            const handlers = await getHandlers();
            for (const toolCall of aiMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                if (functionName === 'query_performance_history') {
                    const result = await handlers.handleAIQueryTool(creds.userId, functionArgs);
                    currentMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: functionName,
                        content: JSON.stringify(result)
                    });
                } else {
                    await handlers.handleAIActionTool(creds.userId, {
                        type: functionName,
                        data: functionArgs
                    });
                    currentMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: functionName,
                        content: JSON.stringify({ status: 'success' })
                    });
                }
            }
            iterations++;
        }

        const aiReply = aiMessage.content || "I've processed your request and updated your metrics.";

        return {
            reply: aiReply,
            thread_id: creds.threadId,
            chat_id: creds.chatId
        };

    } catch (error) {
        console.error('[OpenAI] Service Error:', error);
        throw error;
    }
};
