/**
 * Edge Function: OpenAI chat with token usage logging.
 * Calls OpenAI API, inserts one row into ai_token_usage, returns reply + usage.
 * Use when ai_provider is 'openai' for accurate token tracking.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4": { input: 30, output: 60 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
};

function requestCostUsd(model: string, tokensInput: number, tokensOutput: number): number {
  const p = MODEL_PRICING[model] ?? MODEL_PRICING["gpt-4o-mini"];
  return (tokensInput / 1e6) * p.input + (tokensOutput / 1e6) * p.output;
}

function ageGroup(age: number | null): string | null {
  if (age == null) return null;
  if (age < 18) return "under_18";
  if (age <= 24) return "18_24";
  if (age <= 34) return "25_34";
  if (age <= 44) return "35_44";
  if (age <= 54) return "45_54";
  return "55_plus";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      user_id,
      gym_id,
      feature_type,
      message,
      system_prompt,
      model,
      thread_id,
      chat_id,
      history,
    } = body as {
      user_id: string;
      gym_id: string;
      feature_type: string;
      message: string;
      system_prompt?: string;
      model?: string;
      thread_id?: string;
      chat_id?: string;
      history?: { role: string; content: string }[];
      context_data?: Record<string, any>;
    };

    if (!user_id || !gym_id || !feature_type || !message) {
      return new Response(
        JSON.stringify({ error: "user_id, gym_id, feature_type, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      const { data: settings } = await supabaseAdmin
        .from("ai_settings")
        .select("openai_api_key")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      apiKey = settings?.openai_api_key ?? null;
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modelUsed = model ?? "gpt-4o-mini";
    const messages: { role: string; content: string; name?: string }[] = [];

    // Single source of truth for user demographics: fetch from DB so every request has height, age, gender.
    const { data: userDemographicsRow } = await supabaseAdmin
      .from("users")
      .select("height, age, gender")
      .eq("id", user_id)
      .maybeSingle();

    const contextData = (body as { context_data?: Record<string, any> }).context_data;
    const profileFromContext = contextData?.profile ?? {};
    const hasHeight = profileFromContext.height != null && profileFromContext.height !== "";
    const hasAge = profileFromContext.age != null && profileFromContext.age !== "";
    const hasGender = profileFromContext.gender != null && profileFromContext.gender !== "";

    const height = userDemographicsRow?.height ?? profileFromContext.height ?? null;
    const age = userDemographicsRow?.age ?? profileFromContext.age ?? null;
    const gender = userDemographicsRow?.gender ?? profileFromContext.gender ?? null;

    const profileDemographics = { profile: { height, age, gender } };
    const liveContextForAI =
      contextData && Object.keys(contextData).length > 0
        ? { ...contextData, profile: { ...contextData.profile, height, age, gender } }
        : profileDemographics;

    // 1. Base System Prompt
    if (system_prompt) messages.push({ role: "system", content: system_prompt });

    // 2. Chat History
    if (history && Array.isArray(history)) {
      history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    }

    // 3. Always inject explicit user demographics (height, age, gender) so the AI never misses them.
    messages.push({
      role: "system",
      name: "live_user_data",
      content: `CRITICAL LIVE CONTEXT - DO NOT ASK FOR THIS DATA. User demographics must be used in responses when relevant: ${JSON.stringify(liveContextForAI)}`,
    });

    // 4. Finally, the user request
    messages.push({ role: "user", content: message });

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelUsed,
        messages,
        max_tokens: 1024,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(JSON.stringify({ error: `OpenAI error: ${errText}` }), {
        status: openaiRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiRes.json();
    const choice = openaiData.choices?.[0];
    const usage = openaiData.usage ?? {};
    const tokensInput = Number(usage.prompt_tokens ?? 0);
    const tokensOutput = Number(usage.completion_tokens ?? 0);
    const tokensTotal = tokensInput + tokensOutput;
    const reply = choice?.message?.content ?? "";

    const userGender = userDemographicsRow?.gender ?? null;
    const userAge = userDemographicsRow?.age != null ? Number(userDemographicsRow.age) : null;
    const user_age_group = ageGroup(userAge);
    const request_cost_usd = requestCostUsd(modelUsed, tokensInput, tokensOutput);

    await supabaseAdmin.from("ai_token_usage").insert({
      user_id: user_id,
      gym_id: gym_id,
      feature_type: feature_type,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      tokens_total: tokensTotal,
      model_used: modelUsed,
      request_cost_usd: request_cost_usd,
      user_gender: userGender,
      user_age_group: user_age_group,
    });

    return new Response(
      JSON.stringify({
        reply,
        thread_id: thread_id ?? crypto.randomUUID(),
        chat_id: chat_id ?? crypto.randomUUID(),
        usage: { prompt_tokens: tokensInput, completion_tokens: tokensOutput, total_tokens: tokensTotal },
        model_used: modelUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
