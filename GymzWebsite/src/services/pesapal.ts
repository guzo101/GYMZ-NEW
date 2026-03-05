// Pesapal API 3.0 Integration Service - Strict Implementation
// Based on constraints: Backend-less, UI-driven, Redirect-reliant verification

import { DataMapper } from "@/utils/dataMapper";

const BASE_URL =
  import.meta.env.VITE_PESAPAL_ENVIRONMENT === "production"
    ? "https://pay.pesapal.com/v3/api"
    : "https://cybqa.pesapal.com/pesapalv3/api";

const CONSUMER_KEY = import.meta.env.VITE_PESAPAL_CONSUMER_KEY;
const CONSUMER_SECRET = import.meta.env.VITE_PESAPAL_CONSUMER_SECRET;

// In-memory token storage (Token valid for 5 minutes)
let tokenCache: { token: string; expiry: number } | null = null;

interface PesapalAuthResponse {
  token: string;
  expiryDate: string;
}

interface PesapalOrderResponse {
  orderTrackingId: string;
  redirectUrl: string;
  status: string;
}

export interface PesapalTransactionStatus {
  paymentStatusDescription: string;
  amount: number;
  currency: string;
  statusCode: number; // 0=INVALID, 1=COMPLETED, 2=FAILED, 3=REVERSED
  paymentAccount?: string;
  paymentMethod?: string;
}

/**
 * STEP 1: AUTHENTICATE
 * Stores token in memory only.
 */
export async function getPesapalToken(): Promise<string> {
  // Return cached token if valid (with 30s buffer)
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

  // Pesapal sometimes returns 200 OK but with a status 500/400 in the body
  if (!response.ok || data.status === "500" || data.status === "400" || data.error) {
    console.error("Pesapal Auth Error:", data);
    // Clear potentially bad cache
    tokenCache = null;
    const errorMessage = data?.error?.code
      ? `Pesapal Error: ${data.error.code.replace(/_/g, " ")}`
      : `Pesapal Auth Failed: ${data.status || response.status}`;
    throw new Error(errorMessage);
  }

  if (!data.token) {
    throw new Error("Pesapal Auth Failed: No token received");
  }

  // Set cache
  tokenCache = {
    token: data.token,
    expiry: new Date(data.expiryDate || Date.now() + 300000).getTime(),
  };

  return data.token;
}

/**
 * Helper: Register IPN (Required by API, even if ignored by logic)
 * We need ANY valid IPN ID to submit an order.
 */
export async function getOrRegisterIPN(): Promise<string> {
  // Check env variable first (Manual override)
  const envIpnId = import.meta.env.VITE_PESAPAL_IPN_ID;
  if (envIpnId) return envIpnId;

  // Check local storage first to avoid spamming registration
  const stored = localStorage.getItem("pesapal_ipn_id");
  if (stored) return stored;

  const token = await getPesapalToken();
  // Use configured IPN URL or fallback to window origin (which won't work on localhost for receiving)
  const ipnUrl = import.meta.env.VITE_PESAPAL_IPN_URL || `${window.location.origin}/api/pesapal/ipn`;

  if (!import.meta.env.VITE_PESAPAL_IPN_URL) {
    console.warn("Using localhost for IPN URL. Payment notifications will NOT reach this machine unless you are using a tunnel.");
  }


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
    // Fallback: If registration fails, we can't proceed with standard flow.
    // However, for the sake of the "Trial" constraint, if we can't register, 
    // we might need a hardcoded one or let the user provide it.
    throw new Error(`IPN Registration Failed: ${response.status}`);
  }

  const data = await response.json();
  const ipnId = data.ipn_id;
  localStorage.setItem("pesapal_ipn_id", ipnId);
  return ipnId;
}

/**
 * STEP 2: CREATE TRIAL PAYMENT ORDER
 * No backend persistence assumed here.
 * @returns {redirectUrl, orderTrackingId}
 */
export async function submitPesapalOrder(
  userId: string,
  email: string,
  phoneNumber: string,
  amount: number,
  currency: string = "ZMW",
  description: string = "Trial activation",
  callbackUrl: string
): Promise<{ redirectUrl: string; orderTrackingId: string }> {
  const token = await getPesapalToken();
  const ipnId = await getOrRegisterIPN(); // Mandatory field
  const orderId = `TRIAL-${userId.slice(0, 8)}-${Date.now()}`;

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

  const data = DataMapper.fromDb(await response.json()) as PesapalOrderResponse;

  return {
    redirectUrl: data.redirectUrl,
    orderTrackingId: data.orderTrackingId,
  };
}

/**
 * STEP 4: VERIFY PAYMENT
 * The source of truth.
 * Returns strictly parsed status.
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

  const data = DataMapper.fromDb(await response.json()) as any;

  // Ensure we return the specific fields requested
  // statusCode: 1 = COMPLETED, 2 = FAILED, 0 = INVALID/PENDING, 3 = REVERSED
  return {
    paymentStatusDescription: data.paymentStatusDescription,
    amount: data.amount,
    currency: data.currency,
    statusCode: Number(data.paymentStatusCode),
    paymentAccount: data.paymentAccount,
    paymentMethod: data.paymentMethod,
  };
}

/**
 * DECISION LOGIC
 * @returns true if status_code === 1
 */
export function isTransactionSuccess(status: PesapalTransactionStatus): boolean {
  return status.statusCode === 1;
}

