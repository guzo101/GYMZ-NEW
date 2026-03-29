/**
 * Secure QR Check-In Handler
 * Add this logic to the verifyUserCheckIn function in checkin.ts
 */

import { supabase } from "@/integrations/supabase/client";
import {
    decodeQRData,
    verifyQRCode,
    logQRScanAttempt
} from "@/services/secureQRService";
import type { CheckInResult } from "./checkin";

/**
 * Verify secure QR code and return user if valid
 * Returns null if not a secure QR or if invalid
 */
export async function verifySecureQRCheckIn(identifier: string): Promise<CheckInResult | null> {
    const trimmedId = identifier.trim();

    // Check if this is a secure QR code (format: Gymz|hash|user_id|timestamp|expires_at)
    const isSecureQR = trimmedId.startsWith('Gymz|');

    if (!isSecureQR) {
        return null; // Not a secure QR, use normal flow
    }

    console.log('[SecureQR] Detected secure QR code, validating...');

    // Decode the QR data
    const qrData = decodeQRData(trimmedId);

    if (!qrData) {
        console.error('[SecureQR] Invalid QR code format');
        await logQRScanAttempt('unknown', trimmedId, false, 'Invalid QR format');

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

    // Verify the QR code cryptographically
    const verification = await verifyQRCode(trimmedId, qrData.user_id);

    // Fetch user data
    const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", qrData.user_id)
        .single();

    const photoUrl = userData?.face_photo_url || userData?.avatar_url || null;
    const fullName = userData?.name || "Unknown";
    const membershipPlan = userData?.membership_type || null;
    const expiryDate = userData?.renewal_due_date || null;

    // Calculate days left
    let daysLeft = 0;
    let overdueDays = 0;
    if (expiryDate) {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            overdueDays = Math.abs(diffDays);
        } else {
            daysLeft = diffDays;
        }
    }

    if (!verification.valid) {
        console.error('[SecureQR] QR verification failed:', verification.reason);
        await logQRScanAttempt(qrData.user_id, trimmedId, false, verification.reason);

        // Determine color based on reason
        let color: "red" | "yellow" = "red";
        if (verification.reason.includes("expired") || verification.reason.includes("QR code")) {
            color = "yellow"; // QR expired, not user's fault
        }

        return {
            status: "rejected",
            color,
            reason: verification.reason,
            userId: qrData.user_id,
            user: {
                photoUrl,
                fullName,
                membershipPlan,
                expiryDate,
                daysLeft,
                overdueDays,
            },
        };
    }

    // QR is valid - log successful scan
    console.log('[SecureQR] ✅ Secure QR validated successfully for user:', qrData.user_id);
    await logQRScanAttempt(qrData.user_id, trimmedId, true, 'Valid secure QR scan');

    // Return approved with user data
    return {
        status: "approved",
        color: "green",
        reason: "Secure QR code verified - Access granted",
        userId: qrData.user_id,
        user: {
            photoUrl,
            fullName,
            membershipPlan,
            expiryDate,
            daysLeft,
            overdueDays,
        },
    };
}
