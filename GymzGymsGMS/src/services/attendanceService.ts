/**
 * Attendance Service
 * Handles check-in/check-out logic with strict verification rules
 * Follows behavior-critical attendance system requirements
 */

import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";

export type AttendanceState =
    | "not_checked_in"
    | "checked_in"
    | "session_confirmed"
    | "short_session"
    | "missed_day";

export interface CheckInData {
    userId: string;
    location: {
        latitude: number;
        longitude: number;
    } | null;
    qrCode?: string;
}

export interface AttendanceSession {
    id: string;
    userId: string;
    checkInTime: string;
    checkOutTime: string | null;
    status: AttendanceState;
    durationMinutes: number | null;
    locationVerified: boolean;
    qrVerified: boolean;
    date: string;
    notes?: string;
    effortLevel?: number; // 1-5
    focusArea?: string; // strength, cardio, mobility
}

// Gym geofence configuration (example coordinates)
const GYM_LOCATION = {
    latitude: 0, // Replace with actual gym latitude
    longitude: 0, // Replace with actual gym longitude
    radiusMeters: 100 // 100 meters radius
};

// Minimum session duration to be considered "confirmed" (in minutes)
const MIN_SESSION_DURATION = 20;

// Maximum one check-in per day
const MAX_CHECKINS_PER_DAY = 1;

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

/**
 * Verify if user is within gym geofence
 */
export function verifyLocation(location: { latitude: number; longitude: number }): boolean {
    const distance = calculateDistance(
        location.latitude,
        location.longitude,
        GYM_LOCATION.latitude,
        GYM_LOCATION.longitude
    );

    return distance <= GYM_LOCATION.radiusMeters;
}

/**
 * Verify QR code (checks if it's valid and not expired)
 */
export async function verifyQRCode(qrCode: string): Promise<boolean> {
    try {
        // QR codes should be tied to the gym and rotate daily/hourly
        const { data, error } = await supabase
            .from("gym_qr_codes")
            .select("*")
            .eq("code", qrCode)
            .eq("active", true)
            .gte("expires_at", new Date().toISOString())
            .single();

        return !error && !!data;
    } catch (err) {
        console.error("QR verification error:", err);
        return false;
    }
}

/**
 * Verify member has gym OR event access (returns membership details for display).
 * Used by admin popup to show days left, renewal date, etc.
 */
export async function verifyMemberHasAccess(userId: string): Promise<{
  hasAccess: boolean;
  membershipStatus?: string | null;
  renewalDueDate?: string | null;
  daysRemaining?: number | null;
}> {
  try {
    const { data, error } = await (supabase as any).rpc("verify_member_has_access", {
      p_user_id: userId,
    });
    if (error) {
      console.warn("[verifyMemberHasAccess] RPC error:", error);
      return { hasAccess: false };
    }
    return {
      hasAccess: !!data?.has_access,
      membershipStatus: data?.membership_status ?? null,
      renewalDueDate: data?.renewal_due_date ?? null,
      daysRemaining: data?.days_remaining ?? null,
    };
  } catch (err: any) {
    console.warn("[verifyMemberHasAccess] Error:", err);
    return { hasAccess: false };
  }
}

/**
 * Check if user already checked in today
 */
export async function hasCheckedInToday(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from("attendance")
        .select("id")
        .eq("user_id", userId)
        .gte("check_in_time", `${today}T00:00:00`)
        .lt("check_in_time", `${today}T23:59:59`)
        .maybeSingle();

    return !error && !!data;
}

/**
 * Create check-in record
 */
export async function checkIn(checkInData: CheckInData): Promise<{
    success: boolean;
    message: string;
    session?: AttendanceSession;
}> {
    try {
        // 1. Check if already checked in today
        const alreadyCheckedIn = await hasCheckedInToday(checkInData.userId);
        if (alreadyCheckedIn) {
            return {
                success: false,
                message: "You've already checked in today. Only one check-in per day is allowed.",
            };
        }

        // 2. Verify location if provided
        let locationVerified = false;
        if (checkInData.location) {
            locationVerified = verifyLocation(checkInData.location);
            if (!locationVerified) {
                return {
                    success: false,
                    message: "You must be at the gym to check in. Please enable location services and try again.",
                };
            }
        }

        // 3. Verify QR code if provided
        let qrVerified = false;
        if (checkInData.qrCode) {
            qrVerified = await verifyQRCode(checkInData.qrCode);
            if (!qrVerified) {
                return {
                    success: false,
                    message: "Invalid or expired QR code. Please scan the current QR code at the gym entrance.",
                };
            }
        }

        // 4. Require at least one verification method
        if (!locationVerified && !qrVerified) {
            return {
                success: false,
                message: "Check-in requires either location verification or QR code scan.",
            };
        }

        // 5. Create attendance record
        const now = new Date().toISOString();
        const today = now.split('T')[0];

        const { data: session, error } = await supabase
            .from("attendance")
            .insert({
                user_id: checkInData.userId,
                check_in_time: now,
                status: "checked_in",
                location_verified: locationVerified,
                qr_verified: qrVerified,
                date: today,
            })
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            message: "Check-in successful! Have a great workout.",
            session: DataMapper.fromDb(session) as AttendanceSession,
        };
    } catch (err: any) {
        console.error("Check-in error:", err);
        return {
            success: false,
            message: err.message || "Failed to check in. Please try again.",
        };
    }
}

/**
 * Check out and finalize session
 */
export async function checkOut(
    sessionId: string,
    notes?: string,
    effortLevel?: number,
    focusArea?: string
): Promise<{
    success: boolean;
    message: string;
    session?: AttendanceSession;
}> {
    try {
        // 1. Get current session
        const { data: session, error: fetchError } = await supabase
            .from("attendance")
            .select("*")
            .eq("id", sessionId)
            .single();

        if (fetchError || !session) {
            return {
                success: false,
                message: "Session not found.",
            };
        }

        // 2. Calculate duration
        const checkInTime = new Date(session.check_in_time);
        const checkOutTime = new Date();
        const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 60000);

        // 3. Determine status based on duration
        let status: AttendanceState;
        if (durationMinutes >= MIN_SESSION_DURATION) {
            status = "session_confirmed";
        } else {
            status = "short_session";
        }

        // 4. Update session
        const { data: updatedSession, error: updateError } = await supabase
            .from("attendance")
            .update({
                check_out_time: checkOutTime.toISOString(),
                duration_minutes: durationMinutes,
                status,
                notes,
                effort_level: effortLevel,
                focus_area: focusArea,
            })
            .eq("id", sessionId)
            .select()
            .single();

        if (updateError) throw updateError;

        const message = status === "session_confirmed"
            ? "Session complete! Great work today."
            : `Session recorded (${durationMinutes} min). Sessions under ${MIN_SESSION_DURATION} minutes are marked as short sessions.`;

        return {
            success: true,
            message,
            session: DataMapper.fromDb(updatedSession) as AttendanceSession,
        };
    } catch (err: any) {
        console.error("Check-out error:", err);
        return {
            success: false,
            message: err.message || "Failed to check out. Please try again.",
        };
    }
}

/**
 * Get current active session for user
 */
export async function getCurrentSession(userId: string): Promise<AttendanceSession | null> {
    try {
        const { data, error } = await supabase
            .from("attendance")
            .select("*")
            .eq("user_id", userId)
            .eq("status", "checked_in")
            .is("check_out_time", null)
            .order("check_in_time", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !data) return null;
        return DataMapper.fromDb(data) as AttendanceSession;
    } catch (err) {
        console.error("Get current session error:", err);
        return null;
    }
}

/**
 * Get attendance history for user
 */
export async function getAttendanceHistory(
    userId: string,
    limit: number = 30
): Promise<AttendanceSession[]> {
    try {
        const { data, error } = await supabase
            .from("attendance")
            .select("*")
            .eq("user_id", userId)
            .order("check_in_time", { ascending: false })
            .limit(limit);

        if (error) throw error;
        return DataMapper.fromDb(data || []) as AttendanceSession[];
    } catch (err) {
        console.error("Get attendance history error:", err);
        return [];
    }
}

/**
 * Calculate streak (consecutive days with attendance)
 */
export async function calculateStreak(userId: string): Promise<number> {
    try {
        const history = await getAttendanceHistory(userId, 365);

        // Get unique dates with confirmed sessions
        const confirmedDates = history
            .filter(s => s.status === "session_confirmed")
            .map(s => s.date)
            .filter((date, index, self) => self.indexOf(date) === index)
            .sort()
            .reverse();

        if (confirmedDates.length === 0) return 0;

        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        let currentDate = today;

        // Check if there's a session today or yesterday (grace period)
        const hasRecentSession = confirmedDates.includes(today) ||
            confirmedDates.includes(new Date(Date.now() - 86400000).toISOString().split('T')[0]);

        if (!hasRecentSession) return 0;

        // Count consecutive days
        for (const date of confirmedDates) {
            if (date === currentDate) {
                streak++;
                // Move to previous day
                const prevDate = new Date(currentDate);
                prevDate.setDate(prevDate.getDate() - 1);
                currentDate = prevDate.toISOString().split('T')[0];
            } else {
                break;
            }
        }

        return streak;
    } catch (err) {
        console.error("Calculate streak error:", err);
        return 0;
    }
}

/**
 * Get weekly attendance count
 */
export async function getWeeklyCount(userId: string): Promise<number> {
    try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { data, error } = await supabase
            .from("attendance")
            .select("id")
            .eq("user_id", userId)
            .eq("status", "session_confirmed")
            .gte("check_in_time", weekAgo.toISOString());

        if (error) throw error;
        return data?.length || 0;
    } catch (err) {
        console.error("Get weekly count error:", err);
        return 0;
    }
}
