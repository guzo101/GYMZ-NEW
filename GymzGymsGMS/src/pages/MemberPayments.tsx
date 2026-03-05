import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, CreditCard, Smartphone, Building2, Wallet, CheckCircle2, Clock, XCircle, AlertCircle, User, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { TransactionVerification } from "@/components/TransactionVerification";

import { SubscriptionModal } from "@/components/SubscriptionModal";
import {
  createClicknPayOrder,
  checkClicknPayStatus,
  convertZmwToUsd,
  getLiveZmwPerUsd,
} from "@/services/clicknpay";
import {
  submitPesapalOrder,
  getTransactionStatus,
} from "@/services/pesapal";
import { fetchGymPlans, getMonthsFromPlan, type GymPlan } from "@/services/gymPricing";

const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

// Zambia Kwacha currency formatter
const currency = new Intl.NumberFormat("en-ZM", {
  style: "currency",
  currency: "ZMW",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// Helper function to get current time in UTC+2 (Zambia timezone)
// This converts the current UTC time to UTC+2 before storing in database
function getCurrentTimeUTCPlus2(): string {
  const now = new Date();
  // Get UTC time in milliseconds
  const utcTime = now.getTime();
  // Add 2 hours (2 * 60 * 60 * 1000 milliseconds)
  const utcPlus2Time = utcTime + (2 * 60 * 60 * 1000);
  // Create new Date object with UTC+2 time
  const utcPlus2Date = new Date(utcPlus2Time);
  // Return as ISO string (database will store as UTC)
  return utcPlus2Date.toISOString();
}

interface PaymentRecord {
  id: string;
  amount: number;
  status: string;
  description: string | null;
  method: string | null;
  paid_at: string;
  created_at: string;
  transaction_reference: string | null;
  mobile_number: string | null;
  bank_name: string | null;
  account_number: string | null;
  tip_amount: number | null;
  trainer_id: string | null;
  trainer_name?: string | null;
  months: number | null;
}

export default function MemberPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);
  const [clicknPayLink, setClicknPayLink] = useState<string | null>(null);
  const [clicknPayReference, setClicknPayReference] = useState<string | null>(null);
  const [clicknPayUsdAmount, setClicknPayUsdAmount] = useState<number | null>(null);
  const [clicknPayZmwAmount, setClicknPayZmwAmount] = useState<number | null>(null);
  const [clicknPayRate, setClicknPayRate] = useState<number | null>(null);
  const [pesapalIpnId, setPesapalIpnId] = useState<string | null>(null);
  const [pesapalOrderTrackingId, setPesapalOrderTrackingId] = useState<string | null>(null);

  const [paymentForm, setPaymentForm] = useState({
    plan_id: "",
    amount: "",
    description: "",
    method: "",
    transaction_reference: "",
    mobile_number: "",
    bank_name: "",
    account_number: "",
    tip: "",
    trainer_id: "",
    months: "1", // Default to 1 month
  });

  const [trainers, setTrainers] = useState<Array<{
    id: string;
    name: string;
    role: string;
    avatar: string | null;
    rating: number | null;
  }>>([]);
  const [loadingTrainers, setLoadingTrainers] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationPaymentId, setVerificationPaymentId] = useState<string | null>(null);
  const [gymPlans, setGymPlans] = useState<GymPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const [processedReturnRef, setProcessedReturnRef] = useState(false);

  const gatewayCurrency = "ZMW";

  const buildClientReference = () => {
    const shortId = user?.id ? user.id.slice(0, 8) : "guest";
    return `GYM-${shortId}-${Date.now()}`;
  };

  const handleAmountSelect = (plan: GymPlan) => {
    setPaymentForm({
      ...paymentForm,
      plan_id: plan.id,
      amount: plan.price.toString(),
      description: plan.planName,
      months: getMonthsFromPlan(plan).toString(),
    });
  };



  useEffect(() => {
    if (user?.id) {
      fetchPayments();
    }
  }, [user?.id]);

  useEffect(() => {
    const loadPlans = async () => {
      setLoadingPlans(true);
      const plans = await fetchGymPlans(user?.gymId || null, user?.accessMode || null);
      setGymPlans(plans);
      setLoadingPlans(false);
    };
    loadPlans();
  }, [user?.gymId, user?.accessMode]);

  // Handle plan parameter from URL (when coming from subscription modal)
  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (planParam) {
      const selectedPlan = gymPlans.find((plan) => plan.id === planParam);
      if (selectedPlan) {
        setPaymentForm(prev => ({
          ...prev,
          plan_id: selectedPlan.id,
          amount: selectedPlan.price.toString(),
          description: selectedPlan.planName,
          months: getMonthsFromPlan(selectedPlan).toString(),
        }));
        setShowPaymentForm(true);
        // Remove the plan parameter from URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, gymPlans]);

  // Fetch trainers when tip amount is entered
  useEffect(() => {
    let isMounted = true;
    const tipValue = Number(paymentForm.tip);
    if (paymentForm.tip && tipValue > 0 && trainers.length === 0 && !loadingTrainers) {
      fetchTrainers().catch((err) => {
        console.error("Error in fetchTrainers:", err);
        if (isMounted) {
          setTrainers([]);
        }
      });
    }
    // Clear trainer selection if tip is removed
    if (!paymentForm.tip || Number(paymentForm.tip) <= 0) {
      setPaymentForm(prev => ({ ...prev, trainer_id: "" }));
    }
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentForm.tip]);

  async function fetchPayments() {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch payments with all possible identity columns (user_id OR member_id)
      const { data, error } = await db
        .from("payments")
        .select("*")
        .or(`user_id.eq.${user.id},member_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        // If error is about missing columns, try with explicit column list
        const errorMessage = error.message || String(error);
        if (errorMessage.includes("column") || errorMessage.includes("schema cache")) {
          console.warn("Some columns don't exist, fetching with basic columns only...");
          const { data: basicData, error: basicError } = await db
            .from("payments")
            .select("id, amount, status, payment_status, description, method, paid_at, payment_date, created_at, user_id, member_id")
            .or(`user_id.eq.${user.id},member_id.eq.${user.id}`)
            .order("created_at", { ascending: false });

          if (basicError) throw basicError;

          // Map basic data to full PaymentRecord format with universal mapping
          const mappedData = (basicData || []).map((payment: any) => ({
            ...payment,
            status: payment.payment_status || payment.status || "pending",
            paid_at: payment.payment_date || payment.paid_at || payment.created_at || new Date().toISOString(),
            created_at: payment.created_at || payment.payment_date || payment.paid_at || new Date().toISOString(),
            transaction_reference: payment.transaction_reference || null,
            mobile_number: payment.mobile_number || null,
            bank_name: payment.bank_name || null,
            account_number: payment.account_number || null,
            tip_amount: payment.tip_amount || null,
          }));

          setPayments(mappedData);
          return;
        }
        throw error;
      }

      // Ensure all payments have required fields, fill in missing ones
      const normalizedData = (data || []).map((payment: any) => ({
        ...payment,
        status: payment.payment_status || payment.status || "pending",
        paid_at: payment.payment_date || payment.paid_at || payment.created_at || new Date().toISOString(),
        created_at: payment.created_at || payment.payment_date || payment.paid_at || new Date().toISOString(),
        transaction_reference: payment.transaction_reference || null,
        mobile_number: payment.mobile_number || null,
        bank_name: payment.bank_name || null,
        account_number: payment.account_number || null,
        tip_amount: payment.tip_amount || null,
        trainer_id: payment.trainer_id || null,
        trainer_name: payment.trainer_name || null,
        months: payment.months || 1,
      }));

      // Fetch trainer names for payments with tips
      const paymentsWithTips = normalizedData.filter((p: any) => p.tip_amount > 0 && p.trainer_id);
      if (paymentsWithTips.length > 0) {
        const trainerIds = [...new Set(paymentsWithTips.map((p: any) => p.trainer_id))];
        try {
          const { data: trainersData } = await db
            .from("staff")
            .select("id, name")
            .in("id", trainerIds);

          if (trainersData) {
            const trainerMap = new Map(trainersData.map((t: any) => [t.id, t.name]));
            normalizedData.forEach((payment: any) => {
              if (payment.trainer_id && trainerMap.has(payment.trainer_id)) {
                payment.trainer_name = trainerMap.get(payment.trainer_id);
              }
            });
          }
        } catch (err) {
          console.warn("Error fetching trainer names:", err);
        }
      }

      setPayments(normalizedData);
    } catch (err: any) {
      console.error("Error fetching payments:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load payment history",
        variant: "destructive",
      });
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTrainers() {
    if (loadingTrainers) return; // Prevent multiple simultaneous fetches
    setLoadingTrainers(true);
    try {
      const { data, error } = await db
        .from("staff")
        .select("id, name, role, avatar, rating")
        .or("status.eq.Active,status.is.null")
        .order("name");

      if (error) {
        console.error("Error fetching trainers:", error);
        setTrainers([]);
        return;
      }
      setTrainers(data || []);
    } catch (err: any) {
      console.error("Error fetching trainers:", err);
      setTrainers([]);
      // Don't show error toast, just silently fail
    } finally {
      setLoadingTrainers(false);
    }
  }

  async function updatePaymentStatusFromGateway(paymentId: string, clientReference: string, gateway?: string) {
    if (!clientReference) {
      toast({
        title: "Missing reference",
        description: `No ${gateway || "payment gateway"} reference found for this payment.`,
        variant: "destructive",
      });
      return;
    }

    setCheckingStatusId(paymentId);
    try {
      let isSuccess = false;
      let newReference = clientReference;

      if (gateway === "pesapal") {
        const statusResponse = await getTransactionStatus(clientReference);
        if (statusResponse.status_code === 1) {
          isSuccess = true;
        } else if (statusResponse.status_code === 2) {
          // Failed
          await db.from("payments").update({ status: "failed", transaction_reference: clientReference }).eq("id", paymentId);
          toast({ title: "Payment Failed", description: "Pesapal rejected the transaction.", variant: "destructive" });
          fetchPayments();
          return;
        }
      } else {
        // ClicknPay
        const statusResponse = await checkClicknPayStatus(clientReference);
        const status = (statusResponse.status || "").toLowerCase();
        if (status === "success" || status === "completed") {
          isSuccess = true;
          if (statusResponse.clientReference) newReference = statusResponse.clientReference;
        } else if (status === "failed") {
          await db.from("payments").update({ status: "failed", transaction_reference: newReference }).eq("id", paymentId);
          toast({ title: "Payment Failed", description: "ClicknPay rejected the transaction.", variant: "destructive" });
          fetchPayments();
          return;
        }
      }

      if (isSuccess) {
        // 1. Update Reference (Critical for meaningful audit)
        await db.from("payments").update({
          transaction_reference: newReference,
          updated_at: new Date().toISOString()
        }).eq("id", paymentId);

        // 2. Atomic Activation
        const { data: activationResult, error: activationError } = await supabase.rpc('activate_subscription_from_payment', {
          p_payment_id: paymentId
        });

        if (activationError) throw activationError;
        if (activationResult && !activationResult.success) {
          // If already processed, it's fine, show success. 
          if (activationResult.error === 'Payment already processed') {
            toast({ title: "Already Active", description: "This payment was already processed." });
          } else {
            throw new Error(activationResult.error || 'Activation failed');
          }
        } else {
          toast({
            title: "Payment Confirmed",
            description: "Your membership has been activated successfully!",
          });
        }
        fetchPayments();
      } else {
        toast({ title: "Status Pending", description: "Payment is still pending gateway confirmation." });
      }

    } catch (err: any) {
      console.error(`${gateway || "Payment gateway"} status error:`, err);
      toast({
        title: "Status check failed",
        description: err.message || `Could not check ${gateway || "payment gateway"} status.`,
        variant: "destructive",
      });
    } finally {
      setCheckingStatusId(null);
    }
  }


  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) {
      toast({
        title: "Error",
        description: "Please log in to make a payment",
        variant: "destructive",
      });
      return;
    }

    // Validation
    const selectedPlan = gymPlans.find((plan) => plan.id === paymentForm.plan_id);
    if (!selectedPlan || !paymentForm.method) {
      toast({
        title: "Validation Error",
        description: "Select a valid onboarding plan before checkout.",
        variant: "destructive",
      });
      return;
    }

    const amount = Number(selectedPlan.price);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Amount must be a positive number",
        variant: "destructive",
      });
      return;
    }

    // Method-specific validation
    if (paymentForm.method !== 'Cash') {
      if (paymentForm.method === 'Pesapal') {
        toast({
          title: "Coming Soon",
          description: "Pesapal payment is currently unavailable. Please use Cash.",
          variant: "destructive",
        });
        return;
      }
      // If somehow other methods, block
      if (!paymentForm.method) {
        toast({ title: "Validation Error", description: "Please select a payment method", variant: "destructive" });
        return;
      }
    }

    setSubmitting(true);
    try {
      const tipAmount = paymentForm.tip ? Number(paymentForm.tip) : 0;
      const totalAmount = amount + tipAmount;

      // Validate trainer_id if tip is provided - MANDATORY
      if (tipAmount > 0) {
        if (!paymentForm.trainer_id || paymentForm.trainer_id.trim() === "") {
          toast({
            title: "Validation Error",
            description: "Please select a trainer when adding a tip",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }

        const trainerExists = trainers.some(t => t.id === paymentForm.trainer_id);
        if (!trainerExists && trainers.length > 0) {
          toast({
            title: "Validation Error",
            description: "Please select a valid trainer",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }

      const months = Number(paymentForm.months) || 1;
      let clientReference = paymentForm.transaction_reference || "";
      let gatewayPayUrl: string | null = null;

      if (paymentForm.method === "ClicknPay") {
        clientReference = buildClientReference();

        // Fetch live FX rate for today (USD → ZMW) and use it for this order
        const zmwPerUsd = await getLiveZmwPerUsd();
        setClicknPayRate(zmwPerUsd);

        // Build products list: membership as main product, tip as separate line item (if any)
        const productsList: any[] = [];

        const membershipUsd = convertZmwToUsd(amount, zmwPerUsd);
        productsList.push({
          description: selectedPlan.planName || "Membership",
          id: Date.now(),
          price: membershipUsd,
          productName: selectedPlan.planName || "Gym Membership",
          quantity: 1,
        });

        if (tipAmount > 0) {
          const tipUsd = convertZmwToUsd(tipAmount, zmwPerUsd);
          productsList.push({
            description: "Trainer Tip",
            id: Date.now() + 1,
            price: tipUsd,
            productName: "Trainer Tip",
            quantity: 1,
          });
        }

        const orderPayload = {
          channel: "AUTOMATED" as const,
          clientReference,
          currency: "USD", // ClicknPay only supports USD; we convert from ZMW
          customerCharged: true,
          customerPhoneNumber: paymentForm.mobile_number,
          description: selectedPlan.planName,
          multiplePayments: false,
          orderYpe: "DYNAMIC" as const,
          productsList,
          publicUniqueId: user.id,
          returnUrl: `${window.location.origin}/member/payments?ref=${clientReference}`,
        };

        try {
          const orderResponse = await createClicknPayOrder(orderPayload);
          gatewayPayUrl =
            orderResponse.paymeURL ||
            orderResponse.paymeUrl ||
            (orderResponse as any).payme_url ||
            null;

          // Track last ClicknPay amounts for UI
          setClicknPayReference(clientReference);
          setClicknPayLink(gatewayPayUrl);
          setClicknPayZmwAmount(Number(totalAmount.toFixed(2)));
          const totalUsd = productsList.reduce(
            (sum, p) => sum + Number(p.price || 0) * (p.quantity || 1),
            0
          );
          setClicknPayUsdAmount(Number(totalUsd.toFixed(2)));

          if (gatewayPayUrl) {
            window.open(gatewayPayUrl, "_blank", "noopener");
          }
        } catch (gatewayError: any) {
          throw new Error(gatewayError?.message || "Failed to create ClicknPay order");
        }
      }

      // Build payment data object, only including fields that have values
      const paymentData: any = {
        user_id: user.id,
        plan_id: selectedPlan.id,
        amount: Number(totalAmount.toFixed(2)), // Store total amount including tip, ensure 2 decimal places
        description: selectedPlan.planName,
        method: paymentForm.method,
        status: "pending", // Always use "pending" status for new payments
        paid_at: getCurrentTimeUTCPlus2(), // Use UTC+2 timezone (Zambia local time)
        months: months,
        // Note: approved_by and approved_at are optional and may not exist in schema
        // They will be added conditionally if needed
      };

      // Only add optional fields if they have values (to avoid schema errors)
      if (clientReference) {
        paymentData.transaction_reference = clientReference;
      } else if (paymentForm.transaction_reference) {
        paymentData.transaction_reference = paymentForm.transaction_reference;
      }
      if (paymentForm.mobile_number) {
        paymentData.mobile_number = paymentForm.mobile_number;
      }
      if (paymentForm.bank_name) {
        paymentData.bank_name = paymentForm.bank_name;
      }
      if (paymentForm.account_number) {
        paymentData.account_number = paymentForm.account_number;
      }
      if (tipAmount > 0) {
        // Ensure tip_amount is a valid number and not too large
        paymentData.tip_amount = Number(tipAmount.toFixed(2));
        // Trainer ID is mandatory when tip is present (validated earlier)
        if (paymentForm.trainer_id) {
          paymentData.trainer_id = paymentForm.trainer_id;
        }
      }

      console.log('[PAYMENT_DEBUG] 1. Starting payment submission');
      console.log('[PAYMENT_DEBUG] 2. Payload prepared:', paymentData);

      let insertError = null;
      let paymentResult = null;

      try {
        console.log('[PAYMENT_DEBUG] 3. Attempting PRIMARY insert to public.payments');
        const result = await db.from("payments").insert(paymentData).select();

        if (result.error) {
          console.error('[PAYMENT_DEBUG] 4. Primary insert FAILED:', result.error);
          insertError = result.error;
        } else {
          console.log('[PAYMENT_DEBUG] 4. Primary insert SUCCESS:', result.data);
          insertError = null;
          paymentResult = result.data;
        }
      } catch (err: any) {
        console.error('[PAYMENT_DEBUG] 4. Primary insert EXCEPTION:', err);
        insertError = err;
      }

      if (insertError) {
        const errorMessage = insertError.message || String(insertError);
        console.log('[PAYMENT_DEBUG] 5. Error detected:', errorMessage);

        // If error is about missing columns, try inserting without optional columns
        if (errorMessage.includes("column") && (errorMessage.includes("does not exist") || errorMessage.includes("schema cache"))) {
          console.warn("[PAYMENT_DEBUG] 5a. Column mismatch detected, attempting MINIMAL fallback insert...");

          // Try with minimal required fields only
          const minimalPaymentData: any = {
            user_id: user.id,
            amount: Number(totalAmount.toFixed(2)),
            description: selectedPlan.planName,
            method: paymentForm.method,
            status: "pending",
            paid_at: getCurrentTimeUTCPlus2(),
          };

          if (months) minimalPaymentData.months = months;

          console.log('[PAYMENT_DEBUG] 5b. Minimal Payload:', minimalPaymentData);
          const { error: minimalError, data: minimalResult } = await db.from("payments").insert(minimalPaymentData).select();

          if (minimalError) {
            console.error('[PAYMENT_DEBUG] 5c. Minimal insert FAILED:', minimalError);
            const missingColumn = errorMessage.match(/column ['"]([^'"]+)['"]/i)?.[1] || "unknown";
            throw new Error(`Database schema issue: Missing column '${missingColumn}'. Error: ${minimalError.message}`);
          }
          console.log('[PAYMENT_DEBUG] 5c. Minimal insert SUCCESS:', minimalResult);
          paymentResult = minimalResult;

        } else if (errorMessage.includes("row-level security") || errorMessage.includes("policy")) {
          console.error('[PAYMENT_DEBUG] RLS POLICY VIOLATION Detected');
          throw new Error(`Database Permission Error: The system blocked this payment due to a Trigger/RLS conflict. \n\nFIX: Run the '20260118_fix_cash_payment_trigger.sql' migration regarding user_id=NULL inserts.`);
        } else if (errorMessage.includes("numeric field overflow")) {
          console.error('[PAYMENT_DEBUG] Numeric Overflow');
          throw new Error(`Numeric field overflow. Check amount size.`);
        } else {
          console.error('[PAYMENT_DEBUG] Unhandled Database Error');
          throw insertError;
        }
      }

      // Create notifications using centralized service
      if (paymentResult && paymentResult[0]) {
        try {
          // Import notification service
          const { notifyPaymentPending, createNotification } = await import("@/lib/notifications");

          // Create admin notification using centralized service
          // This notifies all admins that a new payment is awaiting approval
          await notifyPaymentPending({
            id: paymentResult[0].id,
            amount: totalAmount,
            user_id: user.id,
            member_name: user.name || "Member",
            method: paymentForm.method,
          });

          // Create member notification
          // This lets the member know their payment was received and is pending
          await createNotification({
            message: `Your ${paymentForm.method} payment of ${currency.format(amount)} has been submitted. Please wait for admin approval.`,
            user_id: user.id,
            type: "payment",
            payment_id: paymentResult[0].id,
          });

          console.log("Admin notification created for payment:", paymentResult[0].id);
        } catch (notifyErr) {
          console.warn("Notification creation failed", notifyErr);
        }
      }

      // Handle Pesapal payment flow (after payment is saved)
      if (paymentForm.method === "Pesapal" && paymentResult && paymentResult[0]) {
        try {
          const callbackUrl = `${window.location.origin}/member/payments`;

          const response = await submitPesapalOrder(
            user.id,
            user.email,
            paymentForm.mobile_number,
            amount, // Use the base amount or totalAmount depending on requirement (prompt said 'amount')
            "ZMW", // Using ZMW as it matches the predefined ranges
            paymentForm.description || "Membership Payment",
            callbackUrl
          );

          setPesapalOrderTrackingId(response.order_tracking_id);

          // Update payment record with the tracking ID immediately
          await db.from("payments").update({
            transaction_reference: response.order_tracking_id
          }).eq("id", paymentResult[0].id);

          // Open redirect URL
          window.open(response.redirect_url, "_blank", "noopener");

          toast({
            title: "Pesapal Order Created",
            description: "Please complete payment in the new tab.",
          });
        } catch (err: any) {
          console.error("Pesapal error:", err);
          toast({
            title: "Payment Error",
            description: err.message || "Failed to initiate Pesapal payment",
            variant: "destructive",
          });
        }
      }


      // Reset form
      setPaymentForm({
        plan_id: "",
        amount: "",
        description: "",
        method: "",
        transaction_reference: "",
        mobile_number: "",
        bank_name: "",
        account_number: "",
        tip: "",
        trainer_id: "",
        months: "1",
      });
      setShowPaymentForm(false);

      if (paymentForm.method === "ClicknPay") {
        toast({
          title: "Redirecting to ClicknPay",
          description: gatewayPayUrl
            ? "Complete your payment in the ClicknPay window. Return here to check status."
            : "Order created. Use the generated link to finish payment.",
        });
      } else if (paymentForm.method === "Pesapal") {
        // This won't execute if redirect happened above, but included for safety
        toast({
          title: "Redirecting to Pesapal",
          description: "You will be redirected to complete your payment.",
        });
      } else if (paymentForm.method !== "Cash" && paymentResult && paymentResult[0]) {
        setVerificationPaymentId(paymentResult[0].id);
        setShowVerification(true);
        toast({
          title: "Payment Submitted",
          description: "Please verify your payment with your transaction ID to activate your membership immediately.",
        });
      } else {
        toast({
          title: "Payment Submitted",
          description: "Your cash payment has been submitted. Please wait for admin approval before your profile is updated.",
        });
      }

      fetchPayments();
    } catch (err: any) {
      console.error("Error submitting payment:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to submit payment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-primary" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "pending_approval":
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-primary text-white">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500 text-white">Pending</Badge>;
      case "pending_approval":
        return <Badge className="bg-orange-500 text-white">Awaiting Approval</Badge>;
      case "failed":
        return <Badge className="bg-red-500 text-white">Failed</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white">{status}</Badge>;
    }
  };

  const getMethodIcon = (method: string | null) => {
    if (!method) return <CreditCard className="h-5 w-5" />;
    if (method.includes("Mobile") || method.includes("Money") || method.includes("Kwacha")) {
      return <Smartphone className="h-5 w-5" />;
    }
    if (method.includes("Bank")) {
      return <Building2 className="h-5 w-5" />;
    }
    if (method === "Cash") {
      return <Wallet className="h-5 w-5" />;
    }
    return <CreditCard className="h-5 w-5" />;
  };

  // Check if user needs subscription (membership not active)
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [hasPlanSelected, setHasPlanSelected] = useState(false);

  const checkMembershipStatus = async () => {
    if (!user?.id) return;
    try {
      const { data } = await db
        .from("users")
        .select("membership_status")
        .eq("id", user.id)
        .single();

      if (data) {
        setNeedsSubscription(data.membership_status !== "Active");
      }
    } catch (err) {
      console.error("Error checking membership status:", err);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    checkMembershipStatus();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`payments-membership-${user?.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${user?.id}`
      }, () => {
        checkMembershipStatus();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Check if plan is selected from URL
  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (planParam) {
      setHasPlanSelected(true);
    }
  }, [searchParams]);

  // When payment gateway returns to this page with a ref param, auto-check status once
  useEffect(() => {
    const returnRef = searchParams.get("ref");
    const gateway = searchParams.get("gateway"); // "pesapal" or undefined (ClicknPay)
    const orderTrackingId = searchParams.get("OrderTrackingId"); // Pesapal callback parameter
    const orderMerchantRef = searchParams.get("OrderMerchantReference"); // Pesapal callback parameter

    // Handle Pesapal callback
    if (gateway === "pesapal" && orderTrackingId) {
      if (processedReturnRef || payments.length === 0) return;

      // Find payment by merchant reference or tracking ID
      const matchedPayment = payments.find(
        (p) =>
          p.transaction_reference === orderMerchantRef ||
          p.transaction_reference?.includes(orderMerchantRef || "") ||
          p.transaction_reference?.includes(orderTrackingId)
      );

      if (matchedPayment) {
        updatePaymentStatusFromGateway(matchedPayment.id, orderTrackingId, "pesapal");
        setProcessedReturnRef(true);
      }
      return;
    }

    // Handle ClicknPay callback
    if (returnRef && !gateway) {
      if (processedReturnRef || payments.length === 0) return;

      const matchedPayment = payments.find(
        (p) => p.transaction_reference === returnRef
      );

      if (matchedPayment) {
        updatePaymentStatusFromGateway(matchedPayment.id, returnRef);
        setProcessedReturnRef(true);
      }
    }
  }, [searchParams, payments, processedReturnRef]);

  // Don't show subscription modal if user is on payments page with a plan selected
  const showSubscriptionModal = needsSubscription && !hasPlanSelected && !showPaymentForm;

  return (
    <div className="relative">
      {/* Blur overlay when subscription is needed but only if not making payment */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md z-40" />
      )}

      <div className={`space-y-6 p-4 md:p-6 ${showSubscriptionModal ? "blur-sm pointer-events-none" : ""}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Payments</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your payments and subscriptions</p>
          </div>
          <Button onClick={() => setShowPaymentForm(!showPaymentForm)} className="w-full sm:w-auto">
            <DollarSign className="h-4 w-4 mr-2" />
            {showPaymentForm ? "Cancel" : "Make Payment"}
          </Button>
        </div>

        {/* Payment Form */}
        {showPaymentForm && (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Submit Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitPayment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (ZMW) *</Label>
                    <div className="space-y-2">
                      {loadingPlans && <p className="text-sm text-muted-foreground">Loading gym pricing...</p>}
                      {!loadingPlans && gymPlans.length === 0 && (
                        <p className="text-sm text-destructive">Pricing not available for this gym. Checkout is blocked.</p>
                      )}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {gymPlans.map((plan) => (
                          <Button
                            key={plan.id}
                            type="button"
                            variant={paymentForm.plan_id === plan.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleAmountSelect(plan)}
                            className="text-sm"
                          >
                            {plan.currency} {plan.price.toLocaleString()} · {plan.planName}
                          </Button>
                        ))}
                      </div>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Select a plan"
                        value={paymentForm.amount}
                        onChange={() => {}}
                        readOnly
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Input
                      id="description"
                      type="text"
                      placeholder="Select a plan"
                      value={paymentForm.description}
                      onChange={() => {}}
                      readOnly
                      required
                    />
                  </div>
                </div>

                {/* Subscription Duration */}
                <div className="space-y-2">
                  <Label htmlFor="months">Subscription Duration *</Label>
                  <Input id="months" value={paymentForm.months} onChange={() => {}} readOnly />
                  <p className="text-xs text-muted-foreground">
                    Duration is locked to the selected onboarding plan
                  </p>
                </div>

                {/* Tip Field */}
                <div className="space-y-2">
                  <Label htmlFor="tip" className="flex items-center gap-2">
                    <span>Tip for Trainer (Optional)</span>
                    <span className="text-xs text-muted-foreground">Show appreciation to your trainer</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="tip"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={paymentForm.tip}
                      onChange={(e) => setPaymentForm({ ...paymentForm, tip: e.target.value, trainer_id: "" })}
                      className="flex-1"
                    />
                    {paymentForm.tip && Number(paymentForm.tip) > 0 && paymentForm.amount && (
                      <div className="flex items-center px-3 bg-muted rounded-md text-sm">
                        <span className="text-muted-foreground">Total: </span>
                        <span className="font-semibold ml-1">
                          {currency.format(Number(paymentForm.amount || 0) + Number(paymentForm.tip || 0))}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Trainer Selection - Required when tip is entered */}
                  {paymentForm.tip && Number(paymentForm.tip) > 0 && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                      <Label htmlFor="trainer" className="text-sm font-medium mb-2 block">
                        Select Trainer to Tip <span className="text-red-500">*</span>
                        <span className="text-xs text-muted-foreground ml-2">(Required when adding a tip)</span>
                      </Label>
                      {loadingTrainers ? (
                        <div className="text-sm text-muted-foreground py-2">Loading trainers...</div>
                      ) : trainers.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-2">No active trainers available</div>
                      ) : (
                        <Select
                          value={paymentForm.trainer_id}
                          onValueChange={(value) => {
                            try {
                              setPaymentForm({ ...paymentForm, trainer_id: value });
                            } catch (err) {
                              console.error("Error setting trainer:", err);
                            }
                          }}
                          required
                        >
                          <SelectTrigger id="trainer" className="w-full">
                            <SelectValue placeholder="Choose a trainer... (Required)">
                              {paymentForm.trainer_id && trainers.find(t => t.id === paymentForm.trainer_id) && (
                                <span>{trainers.find(t => t.id === paymentForm.trainer_id)?.name}</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {trainers.map((trainer) => (
                              <SelectItem key={trainer.id} value={trainer.id} className="cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    {trainer.avatar ? (
                                      <img
                                        src={trainer.avatar}
                                        alt={trainer.name}
                                        className="h-full w-full rounded-full object-cover"
                                        onError={(e) => {
                                          // Fallback if image fails to load
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <span className="text-xs font-medium text-primary">
                                        {trainer.name
                                          .split(" ")
                                          .map((part) => part[0])
                                          .join("")
                                          .slice(0, 2)
                                          .toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-sm font-medium truncate">{trainer.name}</span>
                                    <span className="text-xs text-muted-foreground truncate">{trainer.role || "Trainer"}</span>
                                  </div>
                                  {trainer.rating && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                      <span className="text-xs">{trainer.rating}</span>
                                    </div>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">Payment Method *</Label>
                  <Select
                    value={paymentForm.method}
                    onValueChange={(value) => {
                      if (value === "Pesapal") {
                        toast({ title: "Coming Soon", description: "Pesapal integration is coming soon. Please use Cash." });
                        // Optionally prevent selection or allow it but block submission
                      }
                      setPaymentForm({ ...paymentForm, method: value });
                    }}
                    required
                  >
                    <SelectTrigger id="method">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          <span>Cash (at Gym)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Pesapal">
                        <div className="flex items-center gap-2 opacity-50">
                          <CreditCard className="h-4 w-4" />
                          <span>Pesapal (Coming Soon)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mobile Money Fields */}
                {(paymentForm.method === "MTN Mobile Money" ||
                  paymentForm.method === "Airtel Money" ||
                  paymentForm.method === "Zamtel Kwacha") && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-2">
                        <Label htmlFor="mobile_number">Mobile Number *</Label>
                        <Input
                          id="mobile_number"
                          type="tel"
                          placeholder="e.g., 0977123456"
                          value={paymentForm.mobile_number}
                          onChange={(e) => setPaymentForm({ ...paymentForm, mobile_number: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="transaction_ref_mobile">Transaction Reference *</Label>
                        <Input
                          id="transaction_ref_mobile"
                          type="text"
                          placeholder="Transaction reference number"
                          value={paymentForm.transaction_reference}
                          onChange={(e) => setPaymentForm({ ...paymentForm, transaction_reference: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  )}

                {paymentForm.method === "ClicknPay" && (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-dashed">
                    <div className="space-y-2">
                      <Label htmlFor="clicknpay_phone">Phone Number *</Label>
                      <Input
                        id="clicknpay_phone"
                        type="tel"
                        placeholder="e.g., 0977123456"
                        value={paymentForm.mobile_number}
                        onChange={(e) => setPaymentForm({ ...paymentForm, mobile_number: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        We send this to ClicknPay to start the payment. A new window will open to complete checkout.
                      </p>
                    </div>
                    {clicknPayLink && (
                      <div className="p-3 bg-background rounded-md border">
                        <div className="text-sm font-medium">Payment Link</div>
                        <a
                          href={clicknPayLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary underline break-all"
                        >
                          {clicknPayLink}
                        </a>
                        {clicknPayReference && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Reference: {clicknPayReference}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {paymentForm.method === "Pesapal" && (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-dashed">
                    <div className="space-y-2">
                      <Label htmlFor="pesapal_phone">Phone Number *</Label>
                      <Input
                        id="pesapal_phone"
                        type="tel"
                        placeholder="e.g., 260971234567"
                        value={paymentForm.mobile_number}
                        onChange={(e) => setPaymentForm({ ...paymentForm, mobile_number: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter your phone number for Pesapal payment. You will be redirected to complete the payment securely.
                      </p>
                    </div>
                  </div>
                )}

                {/* Bank Transfer Fields REMOVED */}

                {paymentForm.method === "Pesapal" && (
                  <div className="p-4 bg-primary dark:bg-primary/20 border border-primary dark:border-primary rounded-lg">
                    <p className="text-sm font-medium text-primary dark:text-primary">
                      Coming Soon
                    </p>
                    <p className="text-sm text-primary dark:text-primary mt-1">
                      Pesapal integration is currently under maintenance. Please use Cash for now.
                    </p>
                  </div>
                )}

                {/* Cash Payment Notice */}
                {paymentForm.method === "Cash" && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                          Cash Payment Notice
                        </p>
                        <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                          Your payment will be marked as pending approval. Please wait for the admin to verify and approve your cash payment before your profile is updated with the payment status.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? "Submitting..." : "Submit Payment"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPaymentForm(false);
                      setPaymentForm({
                        plan_id: "",
                        amount: "",
                        description: "",
                        method: "",
                        transaction_reference: "",
                        mobile_number: "",
                        bank_name: "",
                        account_number: "",
                        tip: "",
                        trainer_id: "",
                        months: "1"
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ClicknPay Online Payments section REMOVED per user request
        <Card className="border-2">
           ... (ClicknPay Section)
        </Card>
        */}

        {/* Payment History */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading payments...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No payments found</p>
                <p className="text-sm mt-2">Make your first payment to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-4"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        {getMethodIcon(payment.method)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{payment.description || "Payment"}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.method || "Unknown method"}
                          {payment.mobile_number && ` • ${payment.mobile_number}`}
                          {payment.bank_name && ` • ${payment.bank_name}`}
                          {payment.transaction_reference && ` • Ref: ${payment.transaction_reference}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(payment.created_at), "MMM dd, yyyy 'at' h:mm a")}
                          {payment.months && (
                            <span className="ml-2 font-medium">
                              • {payment.months <= 0.033 ? '1 Day' : payment.months === 1 ? `${payment.months} month` : `${payment.months} months`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:flex-shrink-0">
                      <div className="text-right">
                        <div className="font-semibold text-lg">{currency.format(Number(payment.amount))}</div>
                        {payment.tip_amount && payment.tip_amount > 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Includes {currency.format(Number(payment.tip_amount))} tip
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">{payment.id.slice(0, 8)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payment.status)}
                        {getStatusBadge(payment.status)}
                        {/* ClicknPay: allow direct status check */}
                        {payment.status === "pending" &&
                          payment.method === "ClicknPay" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={checkingStatusId === payment.id}
                              onClick={() =>
                                updatePaymentStatusFromGateway(
                                  payment.id,
                                  payment.transaction_reference || payment.id
                                )
                              }
                            >
                              {checkingStatusId === payment.id ? "Checking..." : "Check ClicknPay"}
                            </Button>
                          )}
                        {/* Show verify button for pending mobile/bank payments */}
                        {payment.status === "pending" &&
                          payment.method &&
                          payment.method !== "Cash" &&
                          payment.method !== "ClicknPay" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setVerificationPaymentId(payment.id);
                                setShowVerification(true);
                              }}
                            >
                              Verify Payment
                            </Button>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Verification Modal */}
        {verificationPaymentId && (
          <TransactionVerification
            open={showVerification}
            paymentId={verificationPaymentId}
            onClose={() => {
              setShowVerification(false);
              setVerificationPaymentId(null);
              fetchPayments();
            }}
            onVerified={() => {
              setShowVerification(false);
              setVerificationPaymentId(null);
              fetchPayments();
              checkMembershipStatus(); // Refresh membership status
            }}
          />
        )}


      </div>

      {/* Subscription Modal - Show when membership is not Active but not when making payment */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-auto">
          <div className="pointer-events-auto">
            <SubscriptionModal open={true} />
          </div>
        </div>
      )}
    </div>
  );
}

