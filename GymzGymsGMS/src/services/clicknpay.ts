const BASE_URL =
  import.meta.env.VITE_CLICKN_PAY_BASE_URL ||
  "https://backendservices.clicknpay.africa:2081";

const API_KEY = import.meta.env.VITE_CLICKN_PAY_API_KEY;

// Fallback exchange rate: how many ZMW for 1 USD.
// Configure via env; used only if live FX lookup fails.
const DEFAULT_ZMW_PER_USD =
  Number(import.meta.env.VITE_CLICKN_PAY_ZMW_PER_USD || "20") || 20;

// In-memory cached rate for this session
let cachedZmwPerUsd = DEFAULT_ZMW_PER_USD;

interface ClicknPayProduct {
  description: string;
  id: number;
  price: number;
  productName: string;
  quantity: number;
}

interface CreateOrderPayload {
  channel: "AUTOMATED";
  clientReference: string;
  currency: string;
  customerCharged: boolean;
  customerPhoneNumber: string;
  description: string;
  multiplePayments: boolean;
  orderYpe: "DYNAMIC";
  productsList: ClicknPayProduct[];
  publicUniqueId: string;
  returnUrl: string;
}

interface CreateOrderResponse {
  paymeURL?: string;
  paymeUrl?: string;
  payme_url?: string;
  status?: string;
  clientReference?: string;
  correlator?: string;
  [key: string]: unknown;
}

/**
 * Convert a ZMW amount to USD for ClicknPay.
 * We keep ZMW in our database and UI, but ClicknPay only accepts USD.
 */
export function convertZmwToUsd(amountZmw: number, zmwPerUsd: number): number {
  if (!amountZmw || amountZmw <= 0) return 0;
  const usd = amountZmw / (zmwPerUsd || DEFAULT_ZMW_PER_USD);
  // Round to 2 decimals for card payments
  return Number(usd.toFixed(2));
}

/**
 * Get a live-ish ZMW per USD rate.
 * - Tries a public FX API in the browser.
 * - Caches the result in memory (and localStorage when available) for the day.
 * - Falls back to DEFAULT_ZMW_PER_USD if anything fails.
 */
export async function getLiveZmwPerUsd(): Promise<number> {
  // If running outside the browser, just return cached/default.
  if (typeof window === "undefined" || typeof fetch === "undefined") {
    return cachedZmwPerUsd;
  }

  try {
    // Try localStorage cache first (per day)
    const cacheKey = "clicknpay_zmw_per_usd";
    const cached = window.localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { rate: number; date: string };
      const today = new Date().toISOString().slice(0, 10);
      if (parsed.rate && parsed.date === today) {
        cachedZmwPerUsd = parsed.rate;
        return parsed.rate;
      }
    }

    // Fetch live rate from a free FX API (USD base, ZMW quote)
    const url =
      "https://api.exchangerate.host/latest?base=USD&symbols=ZMW";
    const res = await fetch(url);
    if (!res.ok) {
      return cachedZmwPerUsd;
    }
    const data = (await res.json()) as { rates?: { ZMW?: number } };
    const rate = data?.rates?.ZMW;
    if (!rate || rate <= 0) {
      return cachedZmwPerUsd;
    }

    cachedZmwPerUsd = rate;
    const today = new Date().toISOString().slice(0, 10);
    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({ rate, date: today })
      );
    } catch {
      // ignore storage failures
    }

    return rate;
  } catch {
    return cachedZmwPerUsd;
  }
}

interface OrderStatusResponse {
  status?: string;
  paymeURL?: string;
  clientReference?: string;
  paymentGatewayReference?: string;
  description?: string;
  currency?: string;
  [key: string]: unknown;
}

function getHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (API_KEY) {
    // The API docs don’t specify the header name; x-api-key is a safe default.
    headers["x-api-key"] = API_KEY;
  } else {
    console.warn(
      "[ClicknPay] Missing VITE_CLICKN_PAY_API_KEY. Requests may fail."
    );
  }

  return headers;
}

export async function createClicknPayOrder(
  payload: CreateOrderPayload
): Promise<CreateOrderResponse> {
  const response = await fetch(`${BASE_URL}/payme/orders`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ClicknPay order failed: ${response.status} ${errorText || response.statusText}`
    );
  }

  return (await response.json()) as CreateOrderResponse;
}

export async function checkClicknPayStatus(
  clientReference: string
): Promise<OrderStatusResponse> {
  const response = await fetch(
    `${BASE_URL}/payme/orders/top-paid/${encodeURIComponent(clientReference)}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ClicknPay status check failed: ${response.status} ${errorText || response.statusText}`
    );
  }

  return (await response.json()) as OrderStatusResponse;
}



