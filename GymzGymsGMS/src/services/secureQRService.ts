/**
 * Secure QR Code Service
 * Generates cryptographically secure, time-based, subscription-linked QR codes
 * NO FALLBACKS - QR codes are only valid with active subscriptions
 */

import { supabase } from "@/integrations/supabase/client";

// QR code validity duration in seconds
const QR_VALIDITY_DURATION = 60; // 60 seconds

export interface SubscriptionData {
    subscription_id: string;
    subscription_type: string; // monthly, annual, term, daily
    subscription_status: string; // active, inactive, expired
    subscription_start_date: string;
    subscription_end_date: string;
    payment_status: string;
}

export interface SecureQRData {
    user_id: string;
    subscription_id: string;
    subscription_type: string;
    subscription_status: string;
    timestamp: number;
    expires_at: number;
    hash: string;
}

export interface QRValidationResult {
    valid: boolean;
    reason: string;
    subscription_status?: string;
    expires_in_seconds?: number;
}

/**
 * Generate SHA-256 hash of the QR data
 */
async function generateHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Fetch user's active subscription data
 * RESILIENT VERSION: Always returns basic identity info if user exists in Auth
 */
export async function fetchUserSubscription(userId: string): Promise<SubscriptionData | null> {
    try {
        console.log(`[QR Service] Fetching data for: ${userId}`);

        // Fetch User and Payments in parallel
        const [userResult, paymentResult] = await Promise.all([
            supabase
                .from("users")
                .select("id, name, email, created_at, membership_status, membership_expiry, renewal_due_date, membership_type, payment_status")
                .eq("id", userId)
                .maybeSingle(),
            supabase
                .from("payments")
                .select("*")
                .eq("user_id", userId)
                .or('status.eq.completed,status.eq.approved')
                .order("created_at", { ascending: false })
                .limit(1)
        ]);

        const userData = userResult.data as any;
        const payments = paymentResult.data as any[];

        // If user record is missing, we still have their ID from Auth.
        // We'll create a minimal fallback so they can at least identify themselves.
        if (!userData) {
            console.warn(`[QR Service] User record for ${userId} not found in public.users table.`);
            // Return a minimal identity record so the QR can still generate
            return {
                subscription_id: userId,
                subscription_type: "standard",
                subscription_status: "guest",
                subscription_start_date: new Date().toISOString(),
                subscription_end_date: new Date(0).toISOString(), // Expired
                payment_status: "pending",
            };
        }

        const now = new Date();
        const expirySource = userData.renewal_due_date;
        const userExpiry = expirySource ? new Date(expirySource) : null;
        const currentStatus = (userData.membership_status || "").toLowerCase();

        // Check for valid payment
        let validPayment = null;
        if (payments && payments.length > 0) {
            const lastPayment = payments[0];
            const paymentExpiry = lastPayment.end_date || lastPayment.paid_at;
            if (paymentExpiry && new Date(paymentExpiry) > now) {
                validPayment = lastPayment;
            }
        }

        // Determine final state
        let finalExpiry: Date | null = userExpiry;
        let finalType = userData.membership_type || "standard";
        let finalStatus = (currentStatus === "active" || currentStatus === "completed") ? "active" : (currentStatus || "inactive");
        let finalId = validPayment?.id || userId;
        let finalPaymentStatus = userData.payment_status || "completed";

        if (validPayment && (!userExpiry || new Date(validPayment.end_date || validPayment.paid_at) > userExpiry)) {
            finalExpiry = new Date(validPayment.end_date || validPayment.paid_at);
            finalType = validPayment.plan_id || finalType;
            finalPaymentStatus = validPayment.status;
            finalStatus = "active";
        } else if (!finalExpiry) {
            finalExpiry = new Date(0); // Mark as expired if no date found
        }

        return {
            subscription_id: finalId,
            subscription_type: finalType,
            subscription_status: finalStatus,
            subscription_start_date: userData.created_at || now.toISOString(),
            subscription_end_date: finalExpiry.toISOString(),
            payment_status: finalPaymentStatus,
        };
    } catch (error) {
        console.error("[QR Service] CRITICAL ERROR in fetchUserSubscription:", error);
        // Last resort fallback
        return {
            subscription_id: userId,
            subscription_type: "standard",
            subscription_status: "error",
            subscription_start_date: new Date().toISOString(),
            subscription_end_date: new Date(0).toISOString(),
            payment_status: "unknown",
        };
    }
}

/**
 * Calculate subscription end date based on plan
 */
export function calculateEndDate(startDate: string, planId: string | null): string {
    const start = new Date(startDate);
    const plan = (planId || "").toLowerCase();

    if (plan.includes("daily") || plan.includes("day")) {
        // Daily subscription - expires end of day
        const endOfDay = new Date(start);
        endOfDay.setHours(23, 59, 59, 999);
        return endOfDay.toISOString();
    } else if (plan.includes("month")) {
        // Monthly - 30 days
        const endDate = new Date(start);
        endDate.setDate(endDate.getDate() + 30);
        return endDate.toISOString();
    } else if (plan.includes("annual") || plan.includes("year")) {
        // Annual - 365 days
        const endDate = new Date(start);
        endDate.setDate(endDate.getDate() + 365);
        return endDate.toISOString();
    } else {
        // Default - 30 days
        const endDate = new Date(start);
        endDate.setDate(endDate.getDate() + 30);
        return endDate.toISOString();
    }
}

/**
 * Validate subscription is active and within term
 */
export function validateSubscription(subscription: SubscriptionData): QRValidationResult {
    const now = new Date();
    const startDate = new Date(subscription.subscription_start_date);
    const endDate = new Date(subscription.subscription_end_date);

    // Check if subscription is active
    if (subscription.subscription_status !== "active") {
        return {
            valid: false,
            reason: "Subscription is not active",
            subscription_status: subscription.subscription_status,
        };
    }

    // Check payment status
    if (subscription.payment_status !== "completed" && subscription.payment_status !== "approved") {
        return {
            valid: false,
            reason: "Payment not completed",
            subscription_status: subscription.subscription_status,
        };
    }

    // Check if current date is within subscription term
    if (now < startDate) {
        return {
            valid: false,
            reason: "Subscription not yet started",
            subscription_status: subscription.subscription_status,
        };
    }

    if (now > endDate) {
        return {
            valid: false,
            reason: "Subscription has expired",
            subscription_status: subscription.subscription_status,
        };
    }

    // Calculate days remaining
    const timeRemaining = endDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

    return {
        valid: true,
        reason: `Active subscription (${daysRemaining} days remaining)`,
        subscription_status: "active",
        expires_in_seconds: Math.floor(timeRemaining / 1000),
    };
}

/**
 * Generate secure QR code data
 */
export async function generateSecureQRCode(
    userId: string,
    subscription: SubscriptionData
): Promise<SecureQRData> {
    const timestamp = Date.now();
    const expiresAt = timestamp + (QR_VALIDITY_DURATION * 1000);

    // Create data string for hashing
    const dataString = [
        userId,
        subscription.subscription_id,
        subscription.subscription_type,
        subscription.subscription_status,
        timestamp.toString(),
    ].join('|');

    // Generate cryptographic hash
    const hash = await generateHash(dataString);

    return {
        user_id: userId,
        subscription_id: subscription.subscription_id,
        subscription_type: subscription.subscription_type,
        subscription_status: subscription.subscription_status,
        timestamp,
        expires_at: expiresAt,
        hash,
    };
}

/**
 * Encode QR data to string for QR code
 */
export function encodeQRData(qrData: SecureQRData): string {
    // Format: Gymz|hash|user_id|timestamp|expires_at
    return `Gymz|${qrData.hash}|${qrData.user_id}|${qrData.timestamp}|${qrData.expires_at}`;
}

/**
 * Decode QR string back to data
 */
export function decodeQRData(qrString: string): SecureQRData | null {
    try {
        const parts = qrString.split('|');

        if (parts.length !== 5 || parts[0] !== 'Gymz') {
            return null;
        }

        return {
            hash: parts[1],
            user_id: parts[2],
            timestamp: parseInt(parts[3]),
            expires_at: parseInt(parts[4]),
            subscription_id: '', // Will be validated on backend
            subscription_type: '',
            subscription_status: '',
        };
    } catch (error) {
        console.error("Error decoding QR data:", error);
        return null;
    }
}

/**
 * Verify QR code hash and expiration
 */
export async function verifyQRCode(
    qrString: string,
    userId: string
): Promise<QRValidationResult> {
    const qrData = decodeQRData(qrString);

    if (!qrData) {
        return {
            valid: false,
            reason: "Invalid QR code format",
        };
    }

    // Check if QR matches user
    if (qrData.user_id !== userId) {
        return {
            valid: false,
            reason: "QR code does not match user",
        };
    }

    // Check expiration
    const now = Date.now();
    if (now > qrData.expires_at) {
        return {
            valid: false,
            reason: "QR code has expired",
        };
    }

    // Fetch subscription to validate
    const subscription = await fetchUserSubscription(userId);

    if (!subscription) {
        return {
            valid: false,
            reason: "No active subscription found",
        };
    }

    // Validate subscription
    const subscriptionValidation = validateSubscription(subscription);

    if (!subscriptionValidation.valid) {
        return subscriptionValidation;
    }

    // Regenerate hash to verify integrity
    const dataString = [
        qrData.user_id,
        subscription.subscription_id,
        subscription.subscription_type,
        subscription.subscription_status,
        qrData.timestamp.toString(),
    ].join('|');

    const expectedHash = await generateHash(dataString);

    if (expectedHash !== qrData.hash) {
        // Log suspicious activity
        await logQRScanAttempt(userId, qrString, false, "Hash mismatch - possible tampering");

        return {
            valid: false,
            reason: "QR code integrity check failed",
        };
    }

    // All checks passed
    return {
        valid: true,
        reason: "QR code verified successfully",
        subscription_status: "active",
    };
}

/**
 * Log QR scan attempt for security tracking
 */
export async function logQRScanAttempt(
    userId: string,
    qrCode: string,
    success: boolean,
    reason: string,
    scanLocation?: string
): Promise<void> {
    try {
        await supabase.from("qr_scan_logs").insert({
            user_id: userId,
            qr_code_hash: qrCode.split('|')[1], // Only log hash for privacy
            scan_timestamp: new Date().toISOString(),
            success,
            failure_reason: success ? null : reason,
            scan_location: scanLocation || "unknown",
        });
    } catch (error) {
        console.error("Error logging QR scan:", error);
    }
}

/**
 * Get time remaining for QR code
 */
export function getQRTimeRemaining(expiresAt: number): number {
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
    return remaining;
}
