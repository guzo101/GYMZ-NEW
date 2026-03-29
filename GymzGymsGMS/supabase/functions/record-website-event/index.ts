import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PATH_MAX = 512;
const SESSION_MAX = 80;
const UA_MAX = 400;
const REF_MAX = 2048;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidPath(p: string): boolean {
  if (!p || p.length > PATH_MAX) return false;
  if (!p.startsWith("/")) return false;
  if (p.includes("..")) return false;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }
    const b = raw as Record<string, unknown>;
    const path = String(b.path ?? "").trim();
    if (!isValidPath(path)) {
      return jsonResponse({ error: "Invalid path" }, 400);
    }
    const referrer =
      b.referrer != null ? String(b.referrer).trim().slice(0, REF_MAX) : "";
    const session_id =
      b.session_id != null
        ? String(b.session_id).trim().slice(0, SESSION_MAX)
        : "";
    const user_agent = (req.headers.get("user-agent") ?? "")
      .trim()
      .slice(0, UA_MAX);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error } = await supabase.from("website_traffic_events").insert({
      path,
      referrer: referrer || null,
      session_id: session_id || null,
      user_agent: user_agent || null,
    });

    if (error) {
      console.error("website_traffic_events insert:", error);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("record-website-event:", e);
    return jsonResponse({ error: msg }, 500);
  }
});
