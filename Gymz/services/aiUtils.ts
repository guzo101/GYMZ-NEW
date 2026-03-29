import { supabase } from './supabase';

// ------------------------------------------------------------------
// AI SETTINGS CACHE (eliminates duplicate DB queries per message)
// ------------------------------------------------------------------
let _aiSettingsCache: { data: any; timestamp: number } | null = null;
const AI_SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedAISettings(): Promise<any> {
    const now = Date.now();
    if (_aiSettingsCache && (now - _aiSettingsCache.timestamp) < AI_SETTINGS_CACHE_TTL) {
        return _aiSettingsCache.data;
    }
    const { data } = await (supabase as any)
        .from('ai_settings')
        .select('ai_provider, openai_api_key, system_prompt, scanner_model, webhook_url')
        .eq('is_active', true)
        .maybeSingle();
    _aiSettingsCache = { data, timestamp: now };
    return data;
}

// Clear cache when settings change
export function clearAISettingsCache() {
    _aiSettingsCache = null;
}

// ------------------------------------------------------------------
// FETCH WITH TIMEOUT (prevents infinite hangs on bad networks)
// ------------------------------------------------------------------
export function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
    return Promise.race([
        fetch(url, options),
        new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs / 1000}s`)), timeoutMs)
        )
    ]);
}
