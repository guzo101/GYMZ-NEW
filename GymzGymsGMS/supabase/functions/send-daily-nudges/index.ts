import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// 5x daily nudges (member local time). Keep consistent with product expectations.
const DAILY_SLOTS = [
  { hour: 8, minute: 0 },
  { hour: 12, minute: 30 },
  { hour: 17, minute: 0 },
  { hour: 19, minute: 30 },
  { hour: 21, minute: 15 },
] as const;

const NUDGE_TITLE = "Admin";

const NUDGE_BODIES = [
  "Quick check-in: log one meal today to stay consistent.",
  "Consistency > intensity. Show up today.",
  "Hydrate and move a little — momentum beats motivation.",
  "What’s the plan for your next workout? Make it real.",
  "Wrap up the day strong: log your progress and reset.",
];

function parseQuietHours(qh: unknown): { start: string; end: string } | null {
  if (!qh || typeof qh !== "object") return null;
  const start = (qh as any).start;
  const end = (qh as any).end;
  if (typeof start !== "string" || typeof end !== "string") return null;
  return { start, end };
}

function timeInQuietHours(
  localHour: number,
  localMinute: number,
  quiet: { start: string; end: string } | null
): boolean {
  if (!quiet) return false;
  const [sh, sm] = quiet.start.split(":").map((x) => parseInt(x, 10));
  const [eh, em] = quiet.end.split(":").map((x) => parseInt(x, 10));
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;

  const now = localHour * 60 + localMinute;
  const start = sh * 60 + sm;
  const end = eh * 60 + em;

  // Quiet hours may wrap past midnight (e.g. 22:00 → 07:00).
  if (start <= end) return now >= start && now <= end;
  return now >= start || now <= end;
}

function getLocalParts(date: Date, timeZone: string): { hour: number; minute: number } | null {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "", 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return { hour, minute };
  } catch {
    return null;
  }
}

type UserRow = {
  id: string;
  timezone: string | null;
  quiet_hours: any;
  gym_visit_reminders?: boolean | null;
  nutrition_reminders?: boolean | null;
  workout_log_reminders?: boolean | null;
  ai_chat_enabled?: boolean | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Intended to be called by a scheduler/cron. Do not require end-user auth.
  // Protect by requiring a shared secret header if you want (recommended).
  // For now, we require only POST and rely on Supabase function access controls.
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

    const now = new Date();

    // Fetch members who opted into reminders (any of the reminder toggles).
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select(
        "id, timezone, quiet_hours, gym_visit_reminders, nutrition_reminders, workout_log_reminders, ai_chat_enabled"
      )
      .eq("role", "member")
      .or("gym_visit_reminders.eq.true,nutrition_reminders.eq.true,workout_log_reminders.eq.true")
      .limit(5000);

    if (usersError) throw usersError;

    const candidates = (users || []) as UserRow[];

    let considered = 0;
    let sent = 0;
    let skippedNoToken = 0;
    let skippedQuiet = 0;
    let skippedAntiSpam = 0;
    let skippedNotSlot = 0;

    // Process sequentially to avoid API spikes; can be optimized later.
    for (const u of candidates) {
      considered += 1;
      const timeZone = u.timezone || "Africa/Nairobi";
      const local = getLocalParts(now, timeZone);
      if (!local) continue;

      const slotIdx = DAILY_SLOTS.findIndex(
        (s) => s.hour === local.hour && s.minute === local.minute
      );
      if (slotIdx < 0) {
        skippedNotSlot += 1;
        continue;
      }

      const quiet = parseQuietHours(u.quiet_hours);
      if (timeInQuietHours(local.hour, local.minute, quiet)) {
        skippedQuiet += 1;
        continue;
      }

      // DB anti-spam gate if present.
      const { data: canSend, error: canSendError } = await supabaseAdmin.rpc(
        "can_send_notification",
        { p_user_id: u.id }
      );
      if (canSendError) {
        // If RPC not available or errors, default to sending (but log it).
        console.warn("[send-daily-nudges] can_send_notification error:", canSendError);
      } else if (canSend === false) {
        skippedAntiSpam += 1;
        continue;
      }

      const { data: tokens, error: tokensError } = await supabaseAdmin
        .from("user_device_tokens")
        .select("token")
        .eq("user_id", u.id);

      if (tokensError || !tokens?.length) {
        skippedNoToken += 1;
        continue;
      }

      const body = NUDGE_BODIES[slotIdx] ?? NUDGE_BODIES[0] ?? "Reminder";

      const messages = tokens.map(({ token }) => ({
        to: token,
        title: NUDGE_TITLE,
        body,
        sound: "default" as const,
        data: { kind: "daily_nudge", slot: slotIdx + 1 },
      }));

      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[send-daily-nudges] Expo API error:", res.status, errText);

        await supabaseAdmin.from("notifications_sent").insert({
          user_id: u.id,
          notification_type: "daily_nudge",
          channel: "push",
          delivery_status: "failed",
          failure_reason: `expo:${res.status}`,
          scheduled_for: now.toISOString(),
          context: { slot: slotIdx + 1, tz: timeZone },
        });

        continue;
      }

      const result = await res.json();

      // Update analytics + anti-spam counters.
      await supabaseAdmin.from("notifications_sent").insert({
        user_id: u.id,
        notification_type: "daily_nudge",
        channel: "push",
        delivery_status: "sent",
        expo_push_id: Array.isArray(result?.data) ? result.data?.[0]?.id : result?.data?.id,
        scheduled_for: now.toISOString(),
        context: { slot: slotIdx + 1, tz: timeZone },
        template_used: body,
      });

      await supabaseAdmin
        .from("users")
        .update({
          last_notification_sent: now.toISOString(),
          notification_touchpoints_today: (supabaseAdmin as any).rpc
            ? undefined
            : undefined,
        })
        .eq("id", u.id);

      sent += 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        now: now.toISOString(),
        considered,
        sent,
        skipped: {
          notSlot: skippedNotSlot,
          quietHours: skippedQuiet,
          antiSpam: skippedAntiSpam,
          noToken: skippedNoToken,
        },
        note:
          "Schedule this function to run every minute via Supabase Cron/Scheduled Functions. Ensure members have saved Expo tokens in user_device_tokens.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-daily-nudges] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

