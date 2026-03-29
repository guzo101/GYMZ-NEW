import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Set in Supabase Dashboard → Edge Functions → Secrets (not in the browser). */
const WEBHOOK_ENV = "WEBSITE_LEAD_WEBHOOK_URL";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const b = raw as Record<string, unknown>;
    const full_name = String(b.full_name ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    const phone = b.phone != null ? String(b.phone).trim().slice(0, 50) : "";
    const interest =
      b.interest != null ? String(b.interest).trim().slice(0, 500) : "";
    const preferred_contact =
      b.preferred_contact != null
        ? String(b.preferred_contact).trim().slice(0, 100)
        : "";
    const message =
      b.message != null ? String(b.message).trim().slice(0, 8000) : "";
    const gym_name =
      b.gym_name != null ? String(b.gym_name).trim().slice(0, 300) : "";
    const gym_location =
      b.gym_location != null ? String(b.gym_location).trim().slice(0, 300) : "";
    const approx_members =
      b.approx_members != null
        ? String(b.approx_members).trim().slice(0, 100)
        : "";
    const sourceRaw = b.source != null ? String(b.source).trim() : "";
    const source =
      sourceRaw.slice(0, 120) || "marketing_site";

    if (!full_name || full_name.length > 200) {
      return jsonResponse({ error: "full_name is required (max 200 chars)" }, 400);
    }
    if (!email || !isValidEmail(email)) {
      return jsonResponse({ error: "Valid email is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const insertRow = {
      full_name: full_name.slice(0, 200),
      email,
      phone: phone || null,
      interest: interest || null,
      preferred_contact: preferred_contact || null,
      message: message || null,
      gym_name: gym_name || null,
      gym_location: gym_location || null,
      approx_members: approx_members || null,
      source,
    };

    const { data: row, error: insertError } = await supabase
      .from("website_inquiries")
      .insert(insertRow)
      .select()
      .single();

    if (insertError) {
      console.error("website_inquiries insert:", insertError);
      return jsonResponse({ error: insertError.message }, 500);
    }

    const webhookUrl = Deno.env.get(WEBHOOK_ENV)?.trim();
    if (webhookUrl) {
      try {
        const webhookPayload = {
          event: "website_inquiry_created",
          ...row,
        };
        const whRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });
        if (!whRes.ok) {
          const t = await whRes.text();
          console.error("Webhook non-OK:", whRes.status, t);
        }
      } catch (e) {
        console.error("Webhook request failed:", e);
      }
    } else {
      console.warn(WEBHOOK_ENV, "not set — skipping Make.com forward");
    }

    return jsonResponse({ ok: true, id: row.id, created_at: row.created_at });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("submit-website-inquiry:", e);
    return jsonResponse({ error: msg }, 500);
  }
});
