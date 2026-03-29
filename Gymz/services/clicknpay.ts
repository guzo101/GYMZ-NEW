import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment definition (using default fallbacks from GMS if env not available)
const BASE_URL = "https://backendservices.clicknpay.africa:2081";

// TODO: In a real app, strict keys should be in .env. Here we assume the same as GMS for compat.
const API_KEY = ""; // User didn't provide this in GMS file read, relying on GMS usage or empty

// Fallback exchange rate
const DEFAULT_ZMW_PER_USD = 20;

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

export function convertZmwToUsd(amountZmw: number, zmwPerUsd: number): number {
    if (!amountZmw || amountZmw <= 0) return 0;
    const usd = amountZmw / (zmwPerUsd || DEFAULT_ZMW_PER_USD);
    return Number(usd.toFixed(2));
}

export async function getLiveZmwPerUsd(): Promise<number> {
    try {
        const cacheKey = "clicknpay_zmw_per_usd";
        const cached = await AsyncStorage.getItem(cacheKey);

        if (cached) {
            const parsed = JSON.parse(cached) as { rate: number; date: string };
            const today = new Date().toISOString().slice(0, 10);
            if (parsed.rate && parsed.date === today) {
                cachedZmwPerUsd = parsed.rate;
                return parsed.rate;
            }
        }

        // Live Fetch using same API as GMS
        const url = "https://api.exchangerate.host/latest?base=USD&symbols=ZMW";
        const res = await fetch(url);
        if (!res.ok) {
            // Silent fallback
            return cachedZmwPerUsd;
        }
        const data = (await res.json()) as { rates?: { ZMW?: number } };
        const rate = data?.rates?.ZMW;

        if (!rate || rate <= 0) {
            return cachedZmwPerUsd;
        }

        cachedZmwPerUsd = rate;
        const today = new Date().toISOString().slice(0, 10);
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ rate, date: today }));

        return rate;
    } catch (e) {
        console.warn("Error fetching ZMW rate:", e);
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
    // Add API Key if available (check Constants or .env in future)
    if (API_KEY) {
        headers["x-api-key"] = API_KEY;
    }
    return headers;
}

export async function createClicknPayOrder(
    payload: CreateOrderPayload
): Promise<CreateOrderResponse> {
    // GMS reads this from VITE_CLICKN_PAY_API_KEY.
    // For now assuming public endpoint access or reliance on backend if protected.
    // NOTE: The GMS file explicitly had empty string default or import.meta.env.

    const response = await fetch(`${BASE_URL}/payme/orders`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `ClicknPay order failed: ${response.status} ${errorText}`
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
            `ClicknPay status check failed: ${response.status} ${errorText}`
        );
    }

    return (await response.json()) as OrderStatusResponse;
}
