import { supabase } from './supabase';
import { DataMapper } from '../utils/dataMapper';

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
    effortLevel?: number;
    focusArea?: string;
}

const MIN_SESSION_DURATION = 20;

/**
 * Verify member has gym OR event access (for check-in eligibility).
 */
export async function verifyMemberHasAccess(userId: string): Promise<{
  hasAccess: boolean;
  gymActive: boolean;
  eventActive: boolean;
  reason?: string;
  membershipStatus?: string | null;
  renewalDueDate?: string | null;
  daysRemaining?: number | null;
}> {
  try {
    const { data, error } = await (supabase as any).rpc('verify_member_has_access', {
      p_user_id: userId,
    });
    if (error) {
      console.error('[verifyMemberHasAccess] RPC error:', error);
      return { hasAccess: false, gymActive: false, eventActive: false, reason: error.message };
    }
    return {
      hasAccess: !!data?.has_access,
      gymActive: !!data?.gym_active,
      eventActive: !!data?.event_active,
      reason: data?.reason,
      membershipStatus: data?.membership_status ?? null,
      renewalDueDate: data?.renewal_due_date ?? null,
      daysRemaining: data?.days_remaining ?? null,
    };
  } catch (err: any) {
    console.error('[verifyMemberHasAccess] Error:', err);
    return { hasAccess: false, gymActive: false, eventActive: false, reason: err.message };
  }
}

/**
 * Log self-check-in attempt for admin popup (valid/invalid).
 * Called by member app on every gym/event scan attempt.
 */
export async function logSelfCheckInAttempt(params: {
    success: boolean;
    reason: string;
    gymId?: string;
    eventId?: string;
}): Promise<void> {
    try {
        await (supabase as any).rpc('log_self_checkin_attempt', {
            p_success: params.success,
            p_reason: params.reason,
            p_gym_id: params.gymId || null,
            p_event_id: params.eventId || null,
        });
    } catch (err) {
        console.warn('[logSelfCheckInAttempt] Failed to log:', err);
    }
}

/**
 * Verify gym check-in barcode (admin barcode displayed at gym entrance).
 * Members scan this barcode to confirm they are at a valid gym before self-check-in.
 */
export async function verifyGymCheckInBarcode(scannedString: string): Promise<{
    valid: boolean;
    reason?: string;
    gymId?: string;
}> {
    try {
        const { data, error } = await (supabase as any).rpc('verify_gym_checkin_barcode', {
            p_scanned_string: scannedString?.trim() || '',
        });

        if (error) {
            console.error('[verifyGymCheckInBarcode] RPC error:', error);
            return { valid: false, reason: error.message || 'Verification failed' };
        }

        if (!data) return { valid: false, reason: 'No response from server' };
        return {
            valid: !!data.valid,
            reason: data.reason,
            gymId: data.gym_id,
        };
    } catch (err: any) {
        console.error('[verifyGymCheckInBarcode] Error:', err);
        return { valid: false, reason: err.message || 'Verification failed' };
    }
}

export async function hasCheckedInToday(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await (supabase as any)
        .from("attendance")
        .select("id")
        .eq("user_id", userId)
        .gte("check_in_time", `${today}T00:00:00`)
        .lt("check_in_time", `${today}T23:59:59`)
        .maybeSingle();

    return !error && !!data;
}

export async function checkIn(checkInData: CheckInData): Promise<{
    success: boolean;
    message: string;
    session?: AttendanceSession;
}> {
    try {
        const alreadyCheckedIn = await hasCheckedInToday(checkInData.userId);
        if (alreadyCheckedIn) {
            return {
                success: false,
                message: "You've already checked in today.",
            };
        }

        const now = new Date().toISOString();
        const today = now.split('T')[0];

        const { data: session, error } = await (supabase as any)
            .from("attendance")
            .insert(DataMapper.toDb({
                userId: checkInData.userId,
                checkInTime: now,
                status: "checked_in",
                locationVerified: !!checkInData.location,
                qrVerified: !!checkInData.qrCode,
                date: today,
            }))
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            message: "Check-in successful!",
            session: DataMapper.fromDb(session),
        };
    } catch (err: any) {
        console.error("Check-in error:", err);
        return {
            success: false,
            message: err.message || "Failed to check in.",
        };
    }
}

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
        const { data: sessionRaw, error: fetchError } = await (supabase as any)
            .from("attendance")
            .select("*")
            .eq("id", sessionId)
            .single();

        if (fetchError || !sessionRaw) {
            return {
                success: false,
                message: "Session not found.",
            };
        }

        const session = DataMapper.fromDb(sessionRaw);
        const checkInTime = new Date(session.checkInTime);
        const checkOutTime = new Date();
        const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 60000);

        let status: AttendanceState;
        if (durationMinutes >= MIN_SESSION_DURATION) {
            status = "session_confirmed";
        } else {
            status = "short_session";
        }

        const { data: updatedSession, error: updateError } = await (supabase as any)
            .from("attendance")
            .update(DataMapper.toDb({
                checkOutTime: checkOutTime.toISOString(),
                durationMinutes: durationMinutes,
                status,
                notes,
                effortLevel: effortLevel,
                focusArea: focusArea,
            }))
            .eq("id", sessionId)
            .select()
            .single();

        if (updateError) throw updateError;

        // Trigger Retention Engine Tracking (New System)
        if (status === "session_confirmed") {
            try {
                const { retentionService } = await import('./retentionService');
                await retentionService.trackActivity(session.userId, 'workout');
            } catch (e) {
                console.warn('[AttendanceService] Retention tracking failed:', e);
            }
        }

        return {
            success: true,
            message: status === "session_confirmed" ? "Session complete!" : "Short session recorded.",
            session: DataMapper.fromDb(updatedSession),
        };
    } catch (err: any) {
        console.error("Check-out error:", err);
        return {
            success: false,
            message: err.message || "Failed to check out.",
        };
    }
}

export async function getCurrentSession(userId: string): Promise<AttendanceSession | null> {
    try {
        const { data, error } = await (supabase as any)
            .from("attendance")
            .select("*")
            .eq("user_id", userId)
            .eq("status", "checked_in")
            .is("check_out_time", null)
            .order("check_in_time", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !data) return null;
        return DataMapper.fromDb<AttendanceSession>(data);
    } catch (err) {
        console.error("Get current session error:", err);
        return null;
    }
}

export async function getAttendanceHistory(
    userId: string,
    limit: number = 30
): Promise<AttendanceSession[]> {
    try {
        const { data, error } = await (supabase as any)
            .from("attendance")
            .select("*")
            .eq("user_id", userId)
            .order("check_in_time", { ascending: false })
            .limit(limit);

        if (error) throw error;
        return DataMapper.fromDb<AttendanceSession[]>(data || []);
    } catch (err) {
        console.error("Get attendance history error:", err);
        return [];
    }
}

export async function calculateStreak(userId: string): Promise<number> {
    try {
        // Optimized: Only select date and status
        const { data: history, error } = await (supabase as any)
            .from("attendance")
            .select("date, status")
            .eq("user_id", userId)
            .order("check_in_time", { ascending: false })
            .limit(365);

        if (error) throw error;
        if (!history || history.length === 0) return 0;

        const typedHistory = history as { date: string, status: AttendanceState }[];

        const confirmedDates = typedHistory
            .filter(s => s.status === "session_confirmed" && s.date)
            .map(s => s.date)
            .filter((date, index, self) => self.indexOf(date) === index)
            .sort()
            .reverse();

        if (confirmedDates.length === 0) return 0;

        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        let currentDate = today;

        const hasRecentSession = confirmedDates.includes(today) ||
            confirmedDates.includes(new Date(Date.now() - 86400000).toISOString().split('T')[0]);

        if (!hasRecentSession) return 0;

        for (const date of confirmedDates) {
            if (date === currentDate) {
                streak++;
                const prevDate = new Date(currentDate);
                prevDate.setDate(prevDate.getDate() - 1);
                currentDate = prevDate.toISOString().split('T')[0];
            } else if (date < currentDate) {
                // Check if we missed just today (if it's not today yet)
                break;
            }
        }

        return streak;
    } catch (err) {
        console.error("Calculate streak error:", err);
        return 0;
    }
}

export async function getWeeklyCount(userId: string): Promise<number> {
    try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { data, error } = await (supabase as any)
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

export async function getAllActiveSessions(): Promise<any[]> {
    try {
        const { data, error } = await (supabase as any)
            .from("attendance")
            .select(`
                *,
                user:users(id, first_name, last_name, email, avatar)
            `)
            .eq("status", "checked_in")
            .is("check_out_time", null)
            .order("check_in_time", { ascending: false });

        if (error) throw error;
        return DataMapper.fromDb<any[]>(data || []);
    } catch (err) {
        console.error("Get all active sessions error:", err);
        return [];
    }
}

export async function getAllAttendanceHistory(limit: number = 50): Promise<any[]> {
    try {
        const { data, error } = await (supabase as any)
            .from("attendance")
            .select(`
                *,
                user:users(id, first_name, last_name, email, avatar)
            `)
            .order("check_in_time", { ascending: false })
            .limit(limit);

        if (error) throw error;
        return DataMapper.fromDb<any[]>(data || []);
    } catch (err) {
        console.error("Get all attendance history error:", err);
        return [];
    }
}

export async function calculateNaturalRhythm(userId: string): Promise<string | null> {
    try {
        const { data, error } = await (supabase as any)
            .from("attendance")
            .select("check_in_time")
            .eq("user_id", userId)
            .order("check_in_time", { ascending: false })
            .limit(10);

        if (error || !data || data.length === 0) return null;

        // Group by hour
        const hourCounts: Record<number, number> = {};
        data.forEach((session: any) => {
            const date = new Date(session.check_in_time);
            const hour = date.getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        // Find max hour
        let maxCount = 0;
        let bestHour = 0;
        for (const [hour, count] of Object.entries(hourCounts)) {
            if (count > maxCount) {
                maxCount = count;
                bestHour = parseInt(hour);
            }
        }

        // Return as HH:00
        return `${bestHour.toString().padStart(2, '0')}:00`;
    } catch (err) {
        console.error("Calculate natural rhythm error:", err);
        return null;
    }
}
