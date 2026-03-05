/**
 * Unified QR Verification
 * One QR per member. Valid if gym_access_active OR event_access_active.
 * "Invalid QR code" only for malformed/tampered/unknown payloads.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  decodeQRData,
  fetchUserSubscription,
  validateSubscription,
  logQRScanAttempt,
} from "@/services/secureQRService";
import type { CheckInResult } from "./checkin";

interface AccessStatus {
  active: boolean;
  label: string;
  detail?: string;
  expiry?: string | null;
}

export interface UnifiedVerificationResult {
  /** Valid only when payload is malformed/tampered - NOT when access is inactive */
  payloadValid: boolean;
  /** Overall access: true if gym OR event is active */
  accessGranted: boolean;
  /** Reason for rejection (only when payloadValid but accessGranted=false) */
  accessReason?: string;
  userId?: string;
  user?: {
    photoUrl: string | null;
    fullName: string;
    membershipPlan: string | null;
    expiryDate: string | null;
    daysLeft: number;
    overdueDays: number;
  };
  gymAccess?: AccessStatus;
  eventAccess?: AccessStatus;
}

/**
 * Verify member QR with unified gym + event access.
 * Returns null if not a Gymz| QR (caller should use normal flow).
 */
export async function verifyMemberQRUnified(identifier: string): Promise<CheckInResult | null> {
  const trimmedId = identifier.trim();

  if (!trimmedId.startsWith("Gymz|")) {
    return null;
  }

  console.log("[UnifiedQR] Detected Gymz QR, validating...");

  // 1. Decode payload - "Invalid QR code" only for malformed
  const qrData = decodeQRData(trimmedId);
  if (!qrData) {
    console.error("[UnifiedQR] Invalid QR format");
    await logQRScanAttempt("unknown", trimmedId, false, "Invalid QR format");
    return {
      status: "rejected",
      color: "red",
      reason: "Invalid QR code format. Please regenerate your QR code from the app.",
      user: {
        photoUrl: null,
        fullName: "Unknown User",
        membershipPlan: null,
        expiryDate: null,
        daysLeft: 0,
        overdueDays: 0,
      },
    };
  }

  // 2. Verify hash and expiry (integrity check)
  const subscription = await fetchUserSubscription(qrData.user_id);
  if (!subscription) {
    await logQRScanAttempt(qrData.user_id, trimmedId, false, "User/subscription not found");
    return {
      status: "rejected",
      color: "red",
      reason: "Invalid QR code. User record not found.",
      user: {
        photoUrl: null,
        fullName: "Unknown User",
        membershipPlan: null,
        expiryDate: null,
        daysLeft: 0,
        overdueDays: 0,
      },
    };
  }

  // Hash verification - use subscription data to rebuild (same as secureQRService)
  const dataString = [
    qrData.user_id,
    subscription.subscription_id,
    subscription.subscription_type,
    subscription.subscription_status,
    qrData.timestamp.toString(),
  ].join("|");
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  if (computedHash !== qrData.hash) {
    await logQRScanAttempt(qrData.user_id, trimmedId, false, "Hash mismatch - possible tampering");
    return {
      status: "rejected",
      color: "red",
      reason: "Invalid QR code. Please regenerate from the app.",
      user: {
        photoUrl: null,
        fullName: "Unknown User",
        membershipPlan: null,
        expiryDate: null,
        daysLeft: 0,
        overdueDays: 0,
      },
    };
  }

  // Expiry check
  const now = Date.now();
  if (now > qrData.expires_at) {
    await logQRScanAttempt(qrData.user_id, trimmedId, false, "QR expired");
    // Fetch user for display
    const { data: userData } = await supabase.from("users").select("*").eq("id", qrData.user_id).single();
    return {
      status: "rejected",
      color: "yellow",
      reason: "QR code expired. Please generate a new one from the app.",
      userId: qrData.user_id,
      user: {
        photoUrl: userData?.face_photo_url || userData?.avatar_url || null,
        fullName: userData?.name || "Unknown",
        membershipPlan: userData?.membership_type || userData?.membership_plan || null,
        expiryDate: userData?.renewal_due_date || null,
        daysLeft: 0,
        overdueDays: 0,
      },
    };
  }

  // 3. Payload is valid - now check gym AND event access
  const gymValidation = validateSubscription(subscription);
  const gymAccess: AccessStatus = {
    active: gymValidation.valid,
    label: gymValidation.valid ? "Active" : "Inactive",
    detail: subscription.subscription_type,
    expiry: subscription.subscription_end_date,
  };

  // Event access: confirmed RSVPs for today or future events
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: eventRsvps } = await supabase
    .from("event_rsvps")
    .select("id, status, event_id, events(event_date, title)")
    .eq("user_id", qrData.user_id)
    .eq("status", "confirmed");

  const rsvpsWithFutureEvents =
    eventRsvps?.filter((r: any) => {
      const ev = Array.isArray(r.events) ? r.events[0] : r.events;
      if (!ev || !ev.event_date) return false;
      return new Date(ev.event_date) >= todayStart;
    }) ?? [];
  const hasEventAccess = rsvpsWithFutureEvents.length > 0;
  const eventAccess: AccessStatus = {
    active: hasEventAccess,
    label: hasEventAccess ? "Active" : "Inactive",
    detail: hasEventAccess
      ? `${eventRsvps.length} upcoming event(s)`
      : "No confirmed event sign-ups",
  };

  const accessGranted = gymAccess.active || eventAccess.active;

  // Fetch user for display
  const { data: userData } = await supabase.from("users").select("*").eq("id", qrData.user_id).single();
  const photoUrl = userData?.face_photo_url || userData?.avatar_url || null;
  const fullName = userData?.name || "Unknown";
  const membershipPlan = userData?.membership_type || userData?.membership_plan || null;
  const expiryDate = userData?.renewal_due_date || null;
  let daysLeft = 0;
  let overdueDays = 0;
  if (expiryDate) {
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) overdueDays = Math.abs(diffDays);
    else daysLeft = diffDays;
  }

  if (accessGranted) {
    await logQRScanAttempt(qrData.user_id, trimmedId, true, "Unified access granted");

    // Check if already checked in today (gym)
    const today = new Date().toISOString().split("T")[0];
    const { data: todayCheckIn } = await supabase
      .from("attendance_logs")
      .select("checkin_time")
      .eq("user_id", qrData.user_id)
      .gte("checkin_time", `${today}T00:00:00.000Z`)
      .lt("checkin_time", `${today}T23:59:59.999Z`)
      .order("checkin_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    const alreadyCheckedInToday = !!todayCheckIn;
    const checkInTimeToday = todayCheckIn?.checkin_time ?? undefined;

    const reasonParts: string[] = [];
    if (alreadyCheckedInToday && checkInTimeToday) {
      const timeStr = new Date(checkInTimeToday).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      reasonParts.push(`Already checked in today at ${timeStr}`);
    }
    if (gymAccess.active) reasonParts.push("Gym access active");
    if (eventAccess.active) reasonParts.push("Event access active");

    return {
      status: "approved",
      color: "green",
      reason: reasonParts.length > 0 ? reasonParts.join(". ") : "Access granted",
      userId: qrData.user_id,
      user: {
        photoUrl,
        fullName,
        membershipPlan,
        expiryDate,
        daysLeft,
        overdueDays,
      },
      gymAccess,
      eventAccess,
      alreadyCheckedInToday,
      checkInTimeToday,
    } as CheckInResult;
  }

  // Access denied - but NOT "Invalid QR code"
  await logQRScanAttempt(qrData.user_id, trimmedId, false, "No active gym or event access");
  return {
    status: "rejected",
    color: "red",
    reason: "No active access. Gym membership and event sign-ups are both inactive.",
    userId: qrData.user_id,
    user: {
      photoUrl,
      fullName,
      membershipPlan,
      expiryDate,
      daysLeft,
      overdueDays,
    },
    gymAccess,
    eventAccess,
  } as CheckInResult;
}
