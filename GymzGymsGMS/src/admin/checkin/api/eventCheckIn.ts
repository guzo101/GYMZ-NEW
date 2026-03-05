import { supabase } from "@/integrations/supabase/client";

export interface EventCheckInResult {
    status: "approved" | "rejected";
    message: string;
    user?: {
        name: string;
        email: string;
    };
}

/**
 * Verifies and marks a user as checked in for a specific event
 */
export async function verifyEventRSVP(identifier: string, eventId: string): Promise<EventCheckInResult> {
    const trimmedId = identifier.trim();
    let userId = trimmedId;

    console.log(`[verifyEventRSVP] Checking identifier: ${trimmedId} for event: ${eventId}`);

    // 1. Resolve identifier to user
    // Try by unique_id or ID
    const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, name, email")
        .or(`unique_id.eq."${trimmedId}",id.eq."${trimmedId}"`)
        .maybeSingle();

    if (userError) throw new Error("Error looking up user: " + userError.message);

    if (!user) {
        // If it's a composite QR, try to extract UUID (Standard Gymz format)
        if (trimmedId.includes("|")) {
            const parts = trimmedId.split("|");
            const uuidPart = parts.find(part =>
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)
            );
            if (uuidPart) {
                return verifyEventRSVP(uuidPart, eventId);
            }
        }
        return { status: "rejected", message: "User not found" };
    }

    // 2. Check for RSVP
    const { data: rsvp, error: rsvpError } = await supabase
        .from("event_rsvps")
        .select("id, status, checked_in")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (rsvpError) throw new Error("Error checking sign-up: " + rsvpError.message);

    if (!rsvp) {
        return {
            status: "rejected",
            message: `${user.name} has not signed up for this event.`,
            user: { name: user.name, email: user.email }
        };
    }

    if (rsvp.status === "cancelled") {
        return {
            status: "rejected",
            message: "Sign-up was cancelled.",
            user: { name: user.name, email: user.email }
        };
    }

    if (rsvp.checked_in) {
        return {
            status: "approved",
            message: `${user.name} is already checked in.`,
            user: { name: user.name, email: user.email }
        };
    }

    // 3. Update check-in status
    const { error: updateError } = await supabase
        .from("event_rsvps")
        .update({ checked_in: true, check_in_time: new Date().toISOString() })
        .eq("id", rsvp.id);

    if (updateError) throw new Error("Failed to update check-in: " + updateError.message);

    return {
        status: "approved",
        message: `Check-in successful! Welcome, ${user.name}.`,
        user: { name: user.name, email: user.email }
    };
}
