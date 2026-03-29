import { supabase } from './supabase';

export interface ScannerResult {
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
    servingSize: string;
    healthScore: number;
    confidenceScore: number;
    recommendation: string;
    bubbleQuip: string;
    workoutAdvice: string;
    isFallback?: boolean;
}

// ── SANITIZATION LAYER (Absolute Harmony Standard) ─────────────────────────
export const mapScannerResult = (raw: any): ScannerResult => {
    // Handle both snake_case (direct AI/Legacy) and camelCase (Sanitized)
    const macros = raw.macros || {};
    return {
        foodName: raw.foodName || raw.food_name || 'Unknown food',
        calories: Number(raw.calories) || 0,
        protein: Number(raw.protein ?? macros.protein) || 0,
        carbs: Number(raw.carbs ?? macros.carbs) || 0,
        fats: Number(raw.fats ?? raw.fat ?? macros.fats ?? macros.fat) || 0,
        fiberG: Number(raw.fiberG ?? raw.fiber_g) || 0,
        sugarG: Number(raw.sugarG ?? raw.sugar_g) || 0,
        sodiumMg: Number(raw.sodiumMg ?? raw.sodium_mg) || 0,
        servingSize: raw.servingSize || raw.serving_size || '1 serving',
        healthScore: Number(raw.healthScore ?? raw.health_score) || 0,
        confidenceScore: Number(raw.confidenceScore ?? raw.confidence_score) || 0,
        recommendation: raw.recommendation || '',
        bubbleQuip: raw.bubbleQuip || raw.bubble_quip || '',
        workoutAdvice: raw.workoutAdvice || raw.workout_advice || '',
        isFallback: !!(raw.isFallback || raw.is_fallback)
    };
};

const SYSTEM_PROMPT = `
You are the user's personal growth coach for [User Name], roleplaying as [Lily (Female) / Tyson (Male)] based on the 'gender' provided.

STRICT PERSONA RULES:
- If gender is Female, you are Lily: Use a Feminine, 'Main Character' energy. Terms: 'Sis', 'Queen', 'Honey', 'Glow-up', 'It's giving'.
- If gender is Male, you are Tyson: Use a Masculine, 'Elite Performance' energy. Terms: 'Bro', 'Champ', 'Beast', 'Absolute Unit', 'No cap'.

ROLE: 
Analyze the food image, calculate nutrition, and return:
- a short, factual "Verdict" in the recommendation field describing the macro balance of the meal, and
- an ultra-short AI reaction in the bubbleQuip field.

MACRO EVALUATION RULES (STRICT):

Protein per meal (grams):
- 0–10 g → Very low
- 10–20 g → Low
- 20–35 g → Adequate
- 35–50 g → High
- 50 g+ → Very high
NEVER label protein deficiency if protein is 30 g or more in a meal.

Carbohydrates per meal (grams):
- 0–15 g → Very low
- 15–40 g → Low
- 40–75 g → Balanced
- 75–110 g → High
- 110 g+ → Very high

Fat per meal (grams):
- 0–5 g → Very low
- 5–15 g → Low
- 15–30 g → Balanced
- 30–45 g → High
- 45 g+ → Very high

VERDICT RULES (recommendation field):
1) Evaluate protein, carbs, and fats INDIVIDUALLY using the ranges above.
2) Do NOT call a macro "deficient", "too low", or "missing" if it is in the Adequate, Balanced, High, or Very high ranges.
3) Give a SHORT, factual one‑sentence verdict summarizing the macro balance, e.g. "High protein with balanced carbs and moderate fats."
4) Base the verdict STRICTLY on the measured grams in this JSON (protein, carbs, fats). Do not guess or exaggerate.
5) Keep wording clinical and accurate; avoid fluffy motivational language in the recommendation field.

OUTPUT RULES FOR bubbleQuip:
- "bubbleQuip": An ultra-short (MAX 5–6 WORDS) reaction focused on "The Win/Flex" to drive screenshots.
  - It MUST be different for each meal and feel context-aware (reference the vibe, macros, or meal type).
  - TREAT ANY EXAMPLES AS STYLE ONLY — never repeat the exact same wording for multiple users or meals.
  - Do NOT hardcode or reuse stock lines like "Respect the grind. Win secured. ⚡" — always write a fresh one.
  - Tone guidance only (do NOT copy literally):
    • 8–10 (Elite): direct pride / flex energy.
    • 7–8 (Great): aesthetic / social pride.
    • 5–7 (Good): process pride / "we're working".
  - Use "Sis" or "Bro" naturally to sound like an organic friend, not a script.

Return ONLY valid JSON. Structure:
{
  "foodName": "Concise Name",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fats": 0,
  "fiberG": 0,
  "sugarG": 0,
  "sodiumMg": 0,
  "servingSize": "e.g. 1 slice",
  "healthScore": 0, // 1-10
  "confidenceScore": 0.0,
  "recommendation": "Short, factual macro verdict.",
  "bubbleQuip": "Ultra-short 5-6 word flex hook.",
  "workoutAdvice": "Actionable assignment."
}
`;

function decodeBase64(base64: string): ArrayBuffer {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) {
        lookup[chars.charCodeAt(i)] = i;
    }

    let bufferLength = base64.length * 0.75,
        len = base64.length, i, p = 0,
        encoded1, encoded2, encoded3, encoded4;

    if (base64[base64.length - 1] === '=') {
        bufferLength--;
        if (base64[base64.length - 2] === '=') bufferLength--;
    }

    const arraybuffer = new ArrayBuffer(bufferLength),
        bytes = new Uint8Array(arraybuffer);

    for (i = 0; i < len; i += 4) {
        encoded1 = lookup[base64.charCodeAt(i)] || 0;
        encoded2 = lookup[base64.charCodeAt(i + 1)] || 0;
        encoded3 = lookup[base64.charCodeAt(i + 2)] || 0;
        encoded4 = lookup[base64.charCodeAt(i + 3)] || 0;

        bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
        bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return arraybuffer;
}

/**
 * Uploads a base64 image to Supabase Storage bucket 'meal-images'
 * Returns the public URL of the uploaded image.
 */
export const uploadFoodImage = async (base64Image: string, userId: string): Promise<string> => {
    try {
        console.log(`[foodService] Uploading image for user ${userId}...`);

        // Clean base64 and ensure correct format
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '').replace(/[\r\n]+/g, '');

        // Convert base64 to ArrayBuffer (hermes-safe, no fetch hack)
        const arrayBuffer = decodeBase64(cleanBase64);

        const fileName = `${userId}/${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
            .from('meal-images')
            .upload(fileName, arrayBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) {
            console.error('[foodService] Storage Upload Error:', error);
            throw new Error(`Storage Upload Failed: ${error.message}`);
        }

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('meal-images')
            .getPublicUrl(fileName);

        console.log(`[foodService] Upload successful: ${publicUrl}`);
        return publicUrl;

    } catch (error) {
        console.error('[foodService] Image Upload Exception:', error);
        throw error;
    }
};

export const analyzeFoodImage = async (
    imageInput: string, 
    isUrl: boolean = false, 
    contextPrompt?: string,
    options?: { gender?: string; userName?: string }
) => {
    try {
        console.log('Fetching OpenAI Settings...');
        const { data: settings, error: settingsError } = await supabase
            .from('ai_settings')
            .select('openai_api_key, scanner_model')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle() as any;

        if (settingsError || !settings?.openai_api_key) {
            throw new Error('OpenAI API Key not configured in GMS Settings.');
        }

        const apiKey = settings.openai_api_key;
        const model = settings.scanner_model || "gpt-4o";

        let finalImageUrl;
        if (isUrl) {
            finalImageUrl = imageInput;
        } else {
            const cleanBase64 = imageInput.replace(/^data:image\/\w+;base64,/, '').replace(/[\r\n]+/g, '');
            finalImageUrl = `data:image/jpeg;base64,${cleanBase64}`;
        }

        console.log(`[foodService] Analyzing with ${model}... Input type: ${isUrl ? 'URL' : 'Base64'}`);

        // Prepare Persona Enrichment
        const personaContext = `
USER GENDER: ${options?.gender || 'neutral'}
USER NAME: ${options?.userName || 'friend'}
`;

        const fetchPromise = fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                response_format: { type: 'json_object' },
                messages: [
                    { 
                        role: "system", 
                        content: SYSTEM_PROMPT.replace('[User Name]', options?.userName || 'Friend') + 
                                (contextPrompt ? `\n\nUSER CONTEXT:\n${contextPrompt}` : '') +
                                `\n\nSTRICT SESSION INFO:\n${personaContext}`
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Analyze this meal." },
                            {
                                type: "image_url",
                                image_url: { url: finalImageUrl }
                            }
                        ]
                    }
                ],
                max_tokens: 500
            })
        });

        // Add a 30-second timeout for AI Analysis
        const response = await Promise.race([
            fetchPromise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('AI Analysis timed out. Please try a smaller image or better connection.')), 30000)
            )
        ]) as Response;

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'AI Analysis Failed');

        const usage = data.usage ?? {};
        const tokensInput = Number(usage.prompt_tokens ?? 0);
        const tokensOutput = Number(usage.completion_tokens ?? 0);
        const tokensTotal = tokensInput + tokensOutput;
        const modelUsed = settings.scanner_model || 'gpt-4o';

        const messageContent = data.choices?.[0]?.message?.content;

        // Log to ai_token_usage for OAC (FOOD_SCAN). Requires user_id and gym_id.
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser?.id) {
                const { data: userRow } = await (supabase as any).from('users').select('gym_id').eq('id', authUser.id).maybeSingle();
                if (userRow?.gym_id) {
                    await (supabase as any).from('ai_token_usage').insert({
                        user_id: authUser.id,
                        gym_id: userRow.gym_id,
                        feature_type: 'FOOD_SCAN',
                        tokens_input: tokensInput,
                        tokens_output: tokensOutput,
                        tokens_total: tokensTotal,
                        model_used: modelUsed,
                    } as any);
                }
            }
        } catch (_) {
            // Do not block scan if logging fails
        }

        // Handle both string and array content formats (vision models can return segments)
        let parsed: any = null;

        if (messageContent && typeof messageContent === 'object' && !Array.isArray(messageContent)) {
            // Some models may already return a JSON object; use it directly
            parsed = messageContent;
        } else {
            let rawText: string;

            if (typeof messageContent === 'string') {
                rawText = messageContent.trim();
            } else if (Array.isArray(messageContent)) {
                rawText = messageContent
                    .map((part: any) => {
                        if (!part) return '';
                        if (typeof part === 'string') return part;
                        if (typeof part.text === 'string') return part.text;
                        return '';
                    })
                    .join(' ')
                    .trim();
            } else {
                throw new Error('AI response did not contain valid JSON.');
            }

            try {
                parsed = JSON.parse(rawText);
            } catch {
                // Fallback: try to extract first JSON object from the text
                const match = rawText.match(/\{[\s\S]*\}/);
                if (!match) {
                    throw new Error('AI response did not contain valid JSON.');
                }
                parsed = JSON.parse(match[0]);
            }
        }

        return mapScannerResult(parsed);

    } catch (error) {
        console.error('[foodService] Analysis Error:', error);

        // Sanitized Fallback (Absolute Harmony)
        return mapScannerResult({
            food_name: 'Unknown meal',
            calories: 0,
            macros: { protein: 0, carbs: 0, fats: 0 },
            is_fallback: true,
            recommendation: 'We could not read nutrition from this photo. Try a clearer, well-lit shot next time.',
            workout_advice: 'Take a short walk or light movement after eating to support digestion.',
        });
    }
};
