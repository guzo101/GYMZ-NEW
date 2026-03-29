/**
 * Secure QR Code Service for Mobile App
 * Generates cryptographically secure, time-based, subscription-linked QR codes
 */

import { supabase } from "./supabase";
import { DataMapper } from "../utils/dataMapper";

// QR code validity duration in seconds
const QR_VALIDITY_DURATION = 60; // 60 seconds

export interface SubscriptionData {
    subscriptionId: string;
    subscriptionType: string;
    subscriptionStatus: string;
    subscriptionStartDate: string;
    subscriptionEndDate: string;
    paymentStatus: string;
    uniqueId?: string;
    debugNotes?: string;
}

export interface SecureQRData {
    userId: string;
    uniqueId: string;
    subscriptionId: string;
    subscriptionType: string;
    subscriptionStatus: string;
    timestamp: number;
    expiresAt: number;
    hash: string;
}

/**
 * Simple SHA-256 implementation in pure JS (since Web Crypto might not be available)
 */
function sha256(ascii: string): string {
    function rightRotate(value: number, amount: number) {
        return (value >>> amount) | (value << (32 - amount));
    }

    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = 'length';
    const i: number[] = [];
    const j: number[] = [];
    const hash: number[] = [];
    const k: number[] = [];
    let words: any[] = [];
    const asciiLength = ascii[lengthProperty];
    const primeCounter = 2;

    const isPrime = (n: number) => {
        for (let i = 2; i <= Math.sqrt(n); i++) {
            if (n % i === 0) return false;
        }
        return true;
    };

    let p = 2;
    while (hash[lengthProperty] < 8) {
        if (isPrime(p)) {
            hash.push((mathPow(p, 1 / 2) * maxWord) | 0);
            k.push((mathPow(p, 1 / 3) * maxWord) | 0);
        }
        p++;
    }

    const asciiBytes = [];
    for (let i = 0; i < asciiLength; i++) {
        asciiBytes.push(ascii.charCodeAt(i));
    }

    asciiBytes.push(0x80);
    while (asciiBytes[lengthProperty] % 64 !== 56) asciiBytes.push(0);
    asciiBytes.push(0, 0, 0, (asciiLength * 8) / maxWord, (asciiLength * 8) | 0);

    for (let i = 0; i < asciiBytes[lengthProperty]; i += 4) {
        words.push((asciiBytes[i] << 24) | (asciiBytes[i + 1] << 16) | (asciiBytes[i + 2] << 8) | asciiBytes[i + 3]);
    }

    for (let i = 0; i < words[lengthProperty]; i += 16) {
        const w = words.slice(i, i + 16);
        const oldHash = hash.slice(0);

        for (let j = 0; j < 64; j++) {
            if (j >= 16) {
                const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
                const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
                w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
            }

            const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
            const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
            const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
            const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
            const t1 = (hash[7] + s1 + ch + k[j] + w[j]) | 0;
            const t2 = (s0 + maj) | 0;

            hash[7] = hash[6];
            hash[6] = hash[5];
            hash[5] = hash[4];
            hash[4] = (hash[3] + t1) | 0;
            hash[3] = hash[2];
            hash[2] = hash[1];
            hash[1] = hash[0];
            hash[0] = (t1 + t2) | 0;
        }

        for (let j = 0; j < 8; j++) {
            hash[j] = (hash[j] + oldHash[j]) | 0;
        }
    }

    let result = '';
    for (let i = 0; i < 8; i++) {
        const h = hash[i] < 0 ? hash[i] + maxWord : hash[i];
        result += h.toString(16).padStart(8, '0');
    }
    return result;
}

/**
 * Fetch user's active subscription data
 * RESILIENT VERSION: Always returns basic identity info if user exists in Auth
 */
export async function fetchUserSubscription(userId: string): Promise<SubscriptionData | null> {
    try {
        console.log(`[QR Service] Fetching data for: ${userId}`);

        // ── LOCKDOWN: No ID/QR until calibrated ─────────────────────────
        const { data: calibrationCheck } = await supabase
            .from("users")
            .select("height, weight, age, gender, goal")
            .eq("id", userId)
            .maybeSingle();

        const isCalibrated = calibrationCheck &&
            Number((calibrationCheck as any).height) > 0 &&
            Number((calibrationCheck as any).weight) > 0 &&
            Number((calibrationCheck as any).age) > 0 &&
            (calibrationCheck as any).gender &&
            (calibrationCheck as any).goal;

        if (!isCalibrated) {
            console.warn(`[QR Service] Blocking ID fetch: User ${userId} is not calibrated.`);
            return null;
        }

        const [paymentResult, userResult] = await Promise.all([
            supabase
                .from("payments")
                .select("*")
                .eq("user_id", userId)
                .or('status.eq.completed,status.eq.approved')
                .order("created_at", { ascending: false })
                .limit(1),
            supabase
                .from("users")
                .select("id, name, created_at, membership_status, membership_type, renewal_due_date, unique_id, gym_id, access_mode")
                .eq("id", userId)
                .maybeSingle()
        ]);

        const { data: payments, error: paymentsError } = paymentResult as any;
        const { data: userData, error: userError } = userResult as any;

        // If user record is missing, we still have their ID from Auth.
        // We'll create a minimal fallback so they can at least identify themselves.
        if (!userData) {
            console.warn(`[QR Service] User record for ${userId} not found in public.users table.`);
            return {
                subscriptionId: userId,
                subscriptionType: "standard",
                subscriptionStatus: "guest",
                subscriptionStartDate: new Date().toISOString(),
                subscriptionEndDate: new Date(0).toISOString(), // Expired
                paymentStatus: "pending",
                uniqueId: "GUEST",
                debugNotes: "User record not found in database."
            };
        }

        const now = new Date();
        const mappedUser = DataMapper.fromDb<any>(userData);
        const expirySource = mappedUser.renewalDueDate;
        const userExpiry = expirySource ? new Date(expirySource) : null;
        const currentStatus = (mappedUser.membershipStatus || "").toLowerCase();

        // Check for valid payment
        let validPayment = null;
        if (!paymentsError && payments && payments.length > 0) {
            const lastPayment = DataMapper.fromDb<any>(payments[0]);

            // BUG FIX: If endDate is missing, use paidAt + 30 days as a safe fallback
            // This prevents "paidAt > now" check from failing immediately.
            let paymentExpiry = lastPayment.endDate;
            if (!paymentExpiry && lastPayment.paidAt) {
                const paidDate = new Date(lastPayment.paidAt);
                paymentExpiry = new Date(paidDate.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString();
            }

            if (paymentExpiry && new Date(paymentExpiry) > now) {
                validPayment = lastPayment;
            }
        }

        // Determine final state
        let finalExpiry: Date | null = userExpiry;
        let finalType = mappedUser.membershipType || "standard";

        // Event access users: automatically active — no approval needed
        const isEventAccess = (mappedUser.accessMode || mappedUser.access_mode || "").toLowerCase() === "event_access";
        let finalStatus: string;
        if (isEventAccess && mappedUser.gymId && mappedUser.uniqueId) {
            finalStatus = "active";
        } else {
            // Trust the users table status if it's 'active' or 'approved'
            finalStatus = (currentStatus === "active" || currentStatus === "completed" || currentStatus === "approved") ? "active" : (currentStatus || "inactive");
        }
        let finalId = validPayment?.id || userId;
        let finalPaymentStatus = mappedUser.paymentStatus || "completed";

        if (validPayment && (!userExpiry || new Date(validPayment.endDate || validPayment.paidAt) > userExpiry)) {
            finalExpiry = new Date(validPayment.endDate || validPayment.paidAt);
            if (!validPayment.endDate) {
                finalExpiry = new Date(finalExpiry.getTime() + (30 * 24 * 60 * 60 * 1000));
            }
            finalType = validPayment.planId || finalType;
            finalPaymentStatus = validPayment.status;
            finalStatus = "active";
        } else if (!finalExpiry) {
            finalExpiry = new Date(0); // Mark as expired if no date found
        }

        return {
            subscriptionId: finalId,
            subscriptionType: finalType,
            subscriptionStatus: finalStatus,
            subscriptionStartDate: mappedUser.createdAt || now.toISOString(),
            subscriptionEndDate: finalExpiry.toISOString(),
            paymentStatus: finalPaymentStatus,
            uniqueId: mappedUser.uniqueId || 'NO_ID',
            debugNotes: (isEventAccess && finalStatus === 'active') ? undefined :
                (!mappedUser.gymId ? "Missing Gym Assignment" :
                    (!mappedUser.uniqueId ? "ID Generation Pending" :
                        (finalStatus !== 'active' ? `Status: ${finalStatus}` : undefined)))
        };
    } catch (error) {
        console.error("[QR Service] CRITICAL ERROR in fetchUserSubscription:", error);
        // Last resort fallback
        return {
            subscriptionId: userId,
            subscriptionType: "standard",
            subscriptionStatus: "error",
            subscriptionStartDate: new Date().toISOString(),
            subscriptionEndDate: new Date(0).toISOString(),
            paymentStatus: "unknown",
            uniqueId: "ERROR",
            debugNotes: `System Error: ${error instanceof Error ? error.message : 'Unknown'}`
        };
    }
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
    const uniqueId = subscription.uniqueId || 'NO_ID';

    const dataString = [
        userId,
        uniqueId,
        subscription.subscriptionId,
        subscription.subscriptionType,
        subscription.subscriptionStatus,
        timestamp.toString(),
    ].join('|');

    const hash = sha256(dataString);

    return {
        userId: userId,
        uniqueId: uniqueId,
        subscriptionId: subscription.subscriptionId,
        subscriptionType: subscription.subscriptionType,
        subscriptionStatus: subscription.subscriptionStatus,
        timestamp,
        expiresAt: expiresAt,
        hash,
    };
}

/**
 * Encode QR data to string
 */
export function encodeQRData(qrData: SecureQRData): string {
    return `Gymz|${qrData.hash}|${qrData.userId}|${qrData.uniqueId}|${qrData.timestamp}|${qrData.expiresAt}`;
}

/**
 * Get time remaining for QR code
 */
export function getQRTimeRemaining(expiresAt: number): number {
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
    return remaining;
}
