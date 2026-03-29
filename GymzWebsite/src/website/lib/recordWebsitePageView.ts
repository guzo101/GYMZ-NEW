import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "gymz_marketing_sid";

function getOrCreateSessionId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `sess-${Date.now()}`;
  }
}

/**
 * Sends an anonymous page view to Supabase (Edge Function → website_traffic_events).
 * Fire-and-forget; failures are ignored.
 */
export async function recordWebsitePageView(pathWithQuery: string): Promise<void> {
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  try {
    const { error } = await supabase.functions.invoke("record-website-event", {
      body: {
        path,
        referrer: typeof document !== "undefined" && document.referrer ? document.referrer : null,
        session_id: getOrCreateSessionId(),
      },
    });
    if (error) {
      if (import.meta.env.DEV) {
        console.warn("[analytics] record-website-event:", error.message);
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[analytics] record-website-event failed", e);
    }
  }
}
