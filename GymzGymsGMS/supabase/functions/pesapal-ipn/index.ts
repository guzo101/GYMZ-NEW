// Supabase Edge Function for Pesapal IPN (Instant Payment Notification) handling
// This endpoint receives payment status updates from Pesapal

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Configuration - Sandbox vs Production
// Default to sandbox if not specified
const PESAPAL_ENV = Deno.env.get("PESAPAL_ENVIRONMENT") || "sandbox";
const BASE_URL =
  PESAPAL_ENV === "production"
    ? "https://pay.pesapal.com/v3/api"
    : "https://cybqa.pesapal.com/pesapalv3/api";

const CONSUMER_KEY = Deno.env.get("PESAPAL_CONSUMER_KEY");
const CONSUMER_SECRET = Deno.env.get("PESAPAL_CONSUMER_SECRET");

interface PesapalIPNPayload {
  OrderTrackingId: string;
  OrderMerchantReference: string;
  OrderNotificationType: string;
}

interface PesapalAuthResponse {
  token: string;
  expiryDate: string;
  error?: { code: string; message: string };
  status?: string;
}

interface PesapalTransactionStatus {
  payment_status_description: string;
  currency: string;
  amount: number;
  payment_status_code: number; // 1=COMPLETED, 2=FAILED, 0=INVALID, 3=REVERSED
  payment_method: string;
}

// Helper to authenticate with Pesapal
async function getPesapalToken(): Promise<string> {
  console.log(`[Pesapal Auth] Requesting token from ${BASE_URL}...`);

  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new Error("Missing Pesapal credentials: PESAPAL_CONSUMER_KEY or PESAPAL_CONSUMER_SECRET");
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

  const data = (await response.json()) as PesapalAuthResponse;

  if (!response.ok || data.status === "500" || data.status === "400" || data.error) {
    console.error("[Pesapal Auth] Error:", JSON.stringify(data));
    throw new Error(`Pesapal Auth Failed: ${data.status || response.status}`);
  }

  if (!data.token) {
    console.error("[Pesapal Auth] No token returned:", JSON.stringify(data));
    throw new Error("Pesapal Auth Failed: No token received");
  }

  console.log("[Pesapal Auth] Token obtained successfully.");
  return data.token;
}

// Helper to get transaction status
async function getTransactionStatus(
  token: string,
  orderTrackingId: string
): Promise<PesapalTransactionStatus> {
  console.log(`[Pesapal Status] Checking status for ${orderTrackingId}...`);

  const response = await fetch(
    `${BASE_URL}/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(
      orderTrackingId
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json", // Explicitly set content type
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Pesapal Status] HTTP Error ${response.status}: ${errorText}`);
    throw new Error(`Status Check Failed: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[Pesapal Status] Response: ${JSON.stringify(data)}`);

  return {
    payment_status_description: data.payment_status_description,
    currency: data.currency,
    amount: data.amount,
    payment_status_code: Number(data.payment_status_code),
    payment_method: data.payment_method,
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Parse IPN payload
    let payload: PesapalIPNPayload;
    const url = new URL(req.url);

    if (req.method === "GET") {
      console.log("[IPN] Received GET request");
      payload = {
        OrderTrackingId: url.searchParams.get("OrderTrackingId") || "",
        OrderMerchantReference: url.searchParams.get("OrderMerchantReference") || "",
        OrderNotificationType: url.searchParams.get("OrderNotificationType") || "",
      };
    } else {
      console.log("[IPN] Received POST request");
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        payload = await req.json();
      } else {
        const formData = await req.formData();
        payload = {
          OrderTrackingId: formData.get("OrderTrackingId")?.toString() || "",
          OrderMerchantReference: formData.get("OrderMerchantReference")?.toString() || "",
          OrderNotificationType: formData.get("OrderNotificationType")?.toString() || "",
        };
      }
    }

    const {
      OrderTrackingId,
      OrderMerchantReference,
      OrderNotificationType,
    } = payload;

    console.log("[IPN] Payload Parsed:", {
      OrderTrackingId,
      OrderMerchantReference,
      OrderNotificationType,
    });

    // 2. Validate required fields
    if (!OrderTrackingId || !OrderMerchantReference) {
      console.warn("[IPN] Missing required fields");
      return new Response(
        JSON.stringify({
          error: "Missing required fields: OrderTrackingId and OrderMerchantReference",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Find payment record (using flexible matching for reference)
    // The reference might be "GYM-..." or "GYM-...|TrackingId" or similar
    const merchantRef = OrderMerchantReference;

    // Using simple 'like' or 'eq' usually suffices if we store the reference exactly
    // But sometimes people append things. We'll search for exact match or start match
    const { data: payments, error: findError } = await supabase
      .from("payments")
      .select("*")
      .or(`transaction_reference.eq.${merchantRef},transaction_reference.like.${merchantRef}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (findError) {
      console.error("[DB] Error finding payment:", findError);
      throw findError;
    }

    if (!payments || payments.length === 0) {
      console.warn(`[DB] Payment not found for reference: ${merchantRef}`);
      // Return 200 to satisfy Pesapal so they stop retrying, but log the issue
      return new Response(
        JSON.stringify({
          orderNotificationType: "IPNCHANGE",
          orderTrackingId: OrderTrackingId,
          orderMerchantReference: OrderMerchantReference,
          status: 200,
          message: "Payment not found, but acknowledged",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payment = payments[0];
    console.log(`[DB] Found payment ID: ${payment.id}, Current Status: ${payment.status}`);

    // 4. Verify status with Pesapal (CRITICAL STEP)
    // Only proceed if notification type is acceptable
    if (OrderNotificationType === "IPNCHANGE" || OrderNotificationType === "RECURRING") {
      let pesapalStatus: PesapalTransactionStatus;

      try {
        const token = await getPesapalToken();
        pesapalStatus = await getTransactionStatus(token, OrderTrackingId);
      } catch (apiError) {
        console.error("[Pesapal API] Error verifying status:", apiError);
        throw apiError; // Retry later
      }

      console.log("[Pesapal API] Response Status Code:", pesapalStatus.payment_status_code);

      // Map Pesapal status to our DB status
      // 1 = COMPLETED, 2 = FAILED, 0 = INVALID/PENDING, 3 = REVERSED
      let newDbStatus = payment.status;
      if (pesapalStatus.payment_status_code === 1) {
        newDbStatus = "completed";
      } else if (pesapalStatus.payment_status_code === 2) {
        newDbStatus = "failed";
      }
      // We usually don't automatically mark 'reversed' or 'invalid' without manual check, 
      // but strictly 'completed' is what gives value.

      if (newDbStatus !== payment.status) {
        console.log(`[Logic] Updating status from ${payment.status} to ${newDbStatus}`);

        const updatePayload: any = {
          status: newDbStatus,
          // Store the tracking ID specifically if not already
          transaction_reference: OrderTrackingId, // Update reference to tracking ID for easier lookup next time? 
          // OR keep original and add metadata? 
          // Existing code was appending: `${merchantRef}|${OrderTrackingId}`
          // Let's stick to updating status.
        };

        // If completed, set paid_at
        if (newDbStatus === "completed") {
          // Basic UTC time; backend is usually UTC
          updatePayload.paid_at = new Date().toISOString();
        }

        const { error: updateError } = await supabase
          .from("payments")
          .update(updatePayload)
          .eq("id", payment.id);

        if (updateError) {
          console.error("[DB] Update failed:", updateError);
          throw updateError;
        }

        // If Completed, Activate Membership
        if (newDbStatus === "completed" && payment.user_id) {
          console.log(`[Logic] Activating membership for User ${payment.user_id}`);
          await supabase
            .from("users")
            .update({ membership_status: "Active" })
            .eq("id", payment.user_id);
        }

        // Notify
        await supabase.from("notifications").insert({
          message: `Payment ${newDbStatus.toUpperCase()}: ${pesapalStatus.currency} ${pesapalStatus.amount}`,
          user_id: payment.user_id,
          type: newDbStatus === "completed" ? "payment_approved" : "payment",
          payment_id: payment.id,
          is_read: false,
          read: false
        });
      } else {
        console.log(`[Logic] Status unchanged: ${newDbStatus}`);
      }
    }

    // 5. Respond to Pesapal
    // They expect the same params back to confirm receipt
    const responseBody = {
      orderNotificationType: OrderNotificationType,
      orderTrackingId: OrderTrackingId,
      orderMerchantReference: OrderMerchantReference,
      status: 200,
    };

    console.log("[IPN] Sending Success Response:", JSON.stringify(responseBody));

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[IPN] Unhandled Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});







