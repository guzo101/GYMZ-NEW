/**
 * Centralized AI Token Usage Tracking
 * Every AI request should log here with actual token counts from the API response.
 * Do not guess token numbers — use usage from OpenAI (or webhook) response.
 */

import { supabase } from "@/integrations/supabase/client";

export type FeatureType =
  | "AI_CHAT"
  | "COMMUNITY_CHAT"
  | "FOOD_SCAN"
  | "AI_COACH"
  | "NUTRITION_AI"
  | "OTHER";

/** Pricing per 1M tokens (USD) — update when OpenAI changes. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4": { input: 30, output: 60 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
};

function requestCostUsd(
  model: string | null,
  tokensInput: number,
  tokensOutput: number
): number {
  if (!model || (tokensInput === 0 && tokensOutput === 0)) return 0;
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["gpt-4o-mini"];
  const inputCost = (tokensInput / 1_000_000) * pricing.input;
  const outputCost = (tokensOutput / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1e6) / 1e6;
}

function deriveAgeGroup(age: number | null | undefined): string | null {
  if (age == null) return null;
  if (age < 18) return "under_18";
  if (age <= 24) return "18_24";
  if (age <= 34) return "25_34";
  if (age <= 44) return "35_44";
  if (age <= 54) return "45_54";
  return "55_plus";
}

export interface LogTokenUsageParams {
  userId: string;
  gymId: string;
  featureType: FeatureType;
  tokensInput: number;
  tokensOutput: number;
  modelUsed?: string | null;
  userGender?: string | null;
  userAge?: number | null;
}

/**
 * Log one AI request to ai_token_usage.
 * Call this after every AI request when you have actual usage from the API (e.g. response.usage).
 */
export async function logTokenUsage(params: LogTokenUsageParams): Promise<void> {
  const {
    userId,
    gymId,
    featureType,
    tokensInput,
    tokensOutput,
    modelUsed = null,
    userGender = null,
    userAge = null,
  } = params;
  const tokensTotal = tokensInput + tokensOutput;
  const request_cost_usd = requestCostUsd(modelUsed ?? null, tokensInput, tokensOutput);
  const user_age_group = deriveAgeGroup(userAge ?? null);

  const { error } = await supabase.from("ai_token_usage").insert({
    user_id: userId,
    gym_id: gymId,
    feature_type: featureType,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    tokens_total: tokensTotal,
    model_used: modelUsed,
    request_cost_usd: request_cost_usd,
    user_gender: userGender ?? null,
    user_age_group: user_age_group,
  });

  if (error) {
    console.error("[aiTokenUsage] Failed to log token usage:", error);
    // Do not throw — logging must not break the main flow
  }
}

/**
 * Fetch user profile fields needed for token log (gender, age).
 * Use when logging from a context that doesn't have them.
 */
export async function fetchUserDemographics(userId: string): Promise<{
  gender: string | null;
  age: number | null;
}> {
  const { data, error } = await supabase
    .from("users")
    .select("gender, age")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return { gender: null, age: null };
  return {
    gender: data.gender ?? null,
    age: data.age != null ? Number(data.age) : null,
  };
}

/**
 * Check if the user/gym is allowed to make an AI request (limits and cooldown).
 * Returns { allowed: boolean, reason?: string }.
 */
export async function checkTokenLimits(
  gymId: string,
  userId: string,
  featureType: FeatureType
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getTokenLimitsForGym(gymId, featureType);
  if (!limits.is_feature_enabled) {
    return { allowed: false, reason: "AI feature is disabled for this gym." };
  }

  if (limits.cooldown_seconds && limits.cooldown_seconds > 0) {
    const lastUse = await getLastUsageAt(userId, featureType);
    if (lastUse) {
      const elapsed = (Date.now() - new Date(lastUse).getTime()) / 1000;
      if (elapsed < limits.cooldown_seconds) {
        return {
          allowed: false,
          reason: `Please wait ${Math.ceil(limits.cooldown_seconds - elapsed)}s before another request.`,
        };
      }
    }
  }

  if (limits.user_daily_limit != null && limits.user_daily_limit > 0) {
    const usedToday = await getTokensUsedToday(userId, gymId, featureType);
    if (usedToday >= limits.user_daily_limit) {
      return { allowed: false, reason: "Daily token limit reached for this feature." };
    }
  }

  if (limits.daily_token_limit != null && limits.daily_token_limit > 0) {
    const gymUsedToday = await getTokensUsedTodayByGym(gymId, featureType);
    if (gymUsedToday >= limits.daily_token_limit) {
      return { allowed: false, reason: "Gym daily token limit reached." };
    }
  }

  return { allowed: true };
}

interface TokenLimitsRow {
  daily_token_limit: number | null;
  user_daily_limit: number | null;
  cooldown_seconds: number | null;
  is_feature_enabled: boolean;
}

async function getTokenLimitsForGym(
  gymId: string,
  featureType: FeatureType
): Promise<TokenLimitsRow & { is_feature_enabled: boolean }> {
  const { data: featureRow } = await supabase
    .from("ai_token_limits")
    .select("daily_token_limit, user_daily_limit, cooldown_seconds, is_feature_enabled")
    .eq("gym_id", gymId)
    .eq("feature_type", featureType)
    .maybeSingle();

  const { data: allRow } = await supabase
    .from("ai_token_limits")
    .select("daily_token_limit, user_daily_limit, cooldown_seconds, is_feature_enabled")
    .eq("gym_id", gymId)
    .eq("feature_type", "ALL")
    .maybeSingle();

  const base: TokenLimitsRow & { is_feature_enabled: boolean } = {
    daily_token_limit: null,
    user_daily_limit: null,
    cooldown_seconds: 0,
    is_feature_enabled: true,
  };

  if (allRow) {
    base.daily_token_limit = allRow.daily_token_limit ?? base.daily_token_limit;
    base.user_daily_limit = allRow.user_daily_limit ?? base.user_daily_limit;
    base.cooldown_seconds = allRow.cooldown_seconds ?? base.cooldown_seconds;
    base.is_feature_enabled = allRow.is_feature_enabled ?? base.is_feature_enabled;
  }
  if (featureRow) {
    base.daily_token_limit = featureRow.daily_token_limit ?? base.daily_token_limit;
    base.user_daily_limit = featureRow.user_daily_limit ?? base.user_daily_limit;
    base.cooldown_seconds = featureRow.cooldown_seconds ?? base.cooldown_seconds;
    base.is_feature_enabled = featureRow.is_feature_enabled ?? base.is_feature_enabled;
  }
  return base;
}

async function getLastUsageAt(
  userId: string,
  featureType: string
): Promise<string | null> {
  const { data } = await supabase
    .from("ai_token_usage")
    .select("created_at")
    .eq("user_id", userId)
    .eq("feature_type", featureType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at ?? null;
}

async function getTokensUsedToday(
  userId: string,
  gymId: string,
  featureType: string
): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("ai_token_usage")
    .select("tokens_total")
    .eq("user_id", userId)
    .eq("gym_id", gymId)
    .eq("feature_type", featureType)
    .gte("created_at", start.toISOString());
  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + (row.tokens_total ?? 0), 0);
}

async function getTokensUsedTodayByGym(
  gymId: string,
  featureType: string
): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("ai_token_usage")
    .select("tokens_total")
    .eq("gym_id", gymId)
    .eq("feature_type", featureType)
    .gte("created_at", start.toISOString());
  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + (row.tokens_total ?? 0), 0);
}
