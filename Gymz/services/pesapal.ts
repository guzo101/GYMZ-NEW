import AsyncStorage from '@react-native-async-storage/async-storage';

// Logic from GMS src/services/pesapal.ts

// Sandbox: https://cybqa.pesapal.com/pesapalv3/api
// Production: https://pay.pesapal.com/v3/api
const BASE_URL =
  process.env.EXPO_PUBLIC_PESAPAL_BASE_URL ?? "https://cybqa.pesapal.com/pesapalv3/api";

// WARNING: Hardcoded secrets in client-side code is a security loophole.
// These should be moved to a secure backend (Supabase Edge Function).
const CONSUMER_KEY = "REDACTED_USE_ENVIRONMENT_VARIABLE";
const CONSUMER_SECRET = "REDACTED_USE_ENVIRONMENT_VARIABLE";

let tokenCache: { token: string; expiry: number } | null = null;

interface PesapalOrderResponse {
    order_tracking_id: string;
    redirect_url: string;
    status: string;
}

export interface PesapalTransactionStatus {
    payment_status_description: string;
    amount: number;
    currency: string;
    status_code: number; // 0=INVALID, 1=COMPLETED, 2=FAILED, 3=REVERSED
    payment_account?: string;
    payment_method?: string;
}

/**
 * STEP 1: AUTHENTICATE
 */
export async function getPesapalToken(): Promise<string> {
    if (tokenCache && tokenCache.expiry > Date.now() + 30000) {
        return tokenCache.token;
    }

    const response = await fetch(`${BASE_URL}/Auth/RequestToken`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            consumer_key: CONSUMER_KEY,
            consumer_secret: CONSUMER_SECRET,
        }),
    });

    const data = (await response.json()) as any;

    if (!response.ok || data.status === "500" || data.status === "400" || data.error) {
        console.warn("Pesapal Auth Error:", data);
        tokenCache = null;
        throw new Error(`Pesapal Auth Failed: ${data.status || response.status}`);
    }

    if (!data.token) {
        throw new Error("Pesapal Auth Failed: No token received");
    }

    tokenCache = {
        token: data.token,
        expiry: new Date(data.expiryDate || Date.now() + 300000).getTime(),
    };

    return data.token;
}

/**
 * STEP 2: Register IPN
 */
export async function getOrRegisterIPN(): Promise<string> {
    // Try AsyncStorage first
    const stored = await AsyncStorage.getItem("pesapal_ipn_id");
    if (stored) return stored;

    const token = await getPesapalToken();

    // Mobile app IPN URL - ideally this should be a backend URL.
    // Using a placeholder for now as per GMS logic fallback.
    const ipnUrl = "https://Gymz.co.zm/api/pesapal/ipn";

    const response = await fetch(`${BASE_URL}/URLSetup/RegisterIPN`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            url: ipnUrl,
            ipn_notification_type: "POST",
        }),
    });

    if (!response.ok) {
        // If registration fails, we try to proceed anyway or error out.
        // Assuming we can't reliably get one without a real backend URL,
        // we might just throw or use a known test one if available.
        const txt = await response.text();
        console.warn("Pesapal IPN Registration failed:", txt);
        throw new Error(`IPN Registration Failed: ${response.status}`);
    }

    const data = await response.json();
    const ipnId = data.ipn_id;
    await AsyncStorage.setItem("pesapal_ipn_id", ipnId);
    return ipnId;
}

/**
 * STEP 3: CREATE TRIAL PAYMENT ORDER
 */
export async function submitPesapalOrder(
    userId: string,
    email: string,
    phoneNumber: string,
    amount: number,
    currency: string = "ZMW",
    description: string = "Trial activation",
    callbackUrl: string
): Promise<{ redirect_url: string; order_tracking_id: string }> {
    try {
        const token = await getPesapalToken();
        const ipnId = await getOrRegisterIPN();
        const orderId = `MOBILE-${userId.slice(0, 8)}-${Date.now()}`;

        const payload = {
            id: orderId,
            currency: currency,
            amount: amount,
            description: description,
            callback_url: callbackUrl,
            notification_id: ipnId,
            billing_address: {
                email_address: email,
                phone_number: phoneNumber,
                country_code: "ZM",
            },
        };

        const response = await fetch(`${BASE_URL}/Transactions/SubmitOrderRequest`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Order Submit Failed: ${response.status} ${err}`);
        }

        const data = (await response.json()) as PesapalOrderResponse;
        return {
            redirect_url: data.redirect_url,
            order_tracking_id: data.order_tracking_id,
        };
    } catch (err) {
        console.error("Submit Pesapal Order Error:", err);
        throw err;
    }
}

/**
 * STEP 4: VERIFY PAYMENT
 */
export async function getTransactionStatus(
    orderTrackingId: string
): Promise<PesapalTransactionStatus> {
    const token = await getPesapalToken();

    const response = await fetch(
        `${BASE_URL}/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(
            orderTrackingId
        )}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Status Check Failed: ${response.status}`);
    }

    const data = await response.json();

    return {
        payment_status_description: data.payment_status_description,
        amount: data.amount,
        currency: data.currency,
        status_code: Number(data.payment_status_code),
        payment_account: data.payment_account,
        payment_method: data.payment_method,
    };
}
