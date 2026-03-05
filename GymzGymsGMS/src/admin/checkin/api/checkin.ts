/**
 * API functions for User Check-In System
 * Handles verification of gym members through QR code, User ID, or Name search
 */

import { supabase } from "@/integrations/supabase/client";
import {
  decodeQRData,
  verifyQRCode,
  logQRScanAttempt,
  fetchUserSubscription,
  validateSubscription
} from "@/services/secureQRService";
import { verifyMemberQRUnified } from "./unifiedQRVerification";

export interface AccessStatus {
  active: boolean;
  label: string;
  detail?: string;
  expiry?: string | null;
}

export interface CheckInResult {
  status: "approved" | "rejected";
  color: "green" | "yellow" | "red" | "grey";
  reason: string;
  userId?: string; // User ID for sending notifications
  user: {
    photoUrl: string | null;
    fullName: string;
    membershipPlan: string | null;
    expiryDate: string | null;
    daysLeft: number;
    overdueDays: number;
  };
  gymAccess?: AccessStatus;
  eventAccess?: AccessStatus;
  /** When true, member has already checked in today (gym) */
  alreadyCheckedInToday?: boolean;
  /** Check-in time today if already checked in */
  checkInTimeToday?: string;
}

/**
 * Verify user check-in status by identifier (QR code, unique_id, user ID, or name)
 */
export async function verifyUserCheckIn(identifier: string): Promise<CheckInResult> {
  let trimmedId = identifier.trim();

  // Unified QR verification: Gymz| format - valid if gym OR event access
  if (trimmedId.startsWith("Gymz|")) {
    const unifiedResult = await verifyMemberQRUnified(trimmedId);
    if (unifiedResult) return unifiedResult;
  }

  // Priority order: unique_id > ID > QR code string > name
  // unique_id is checked FIRST since that's what users scan (format: 4 digits + special char)
  let user = null;
  let queryError = null;

  // Handle composite QR codes (Format: Gymz|hash|uuid|timestamp...)
  // Example: "Gymz|9b7...|3e03...|176..."
  if (trimmedId.includes("|")) {
    const parts = trimmedId.split("|");
    // Usually the user ID is the 3rd part (index 2) or we try to find the UUID part
    // Let's try to find a part that looks like a UUID
    const uuidPart = parts.find(part =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)
    );

    if (uuidPart) {
      console.log(`[verifyUserCheckIn] Parsed composite QR. Extracted UUID: ${uuidPart}`);
      trimmedId = uuidPart;
    }
  }

  console.log(`[verifyUserCheckIn] Starting verification for identifier: "${trimmedId}"`);

  // PRE-SCREEN: Reject Event Guest IDs (Durable ID Lifecycle)
  if (trimmedId.toUpperCase().startsWith("EV-")) {
    console.warn(`[verifyUserCheckIn] 🚫 Access REJECTED: ID ${trimmedId} is an Event Guest ID.`);
    // Since we don't have the full user data yet, we'll return a generic rejection or try to find the user first
    // It's better to find the user first to provide a personalized rejection message
  }
  // Priority order: unique_id > ID
  // Note: We temporarily removed qr_code_string to prevent errors if migration hasn't run
  const { data: matchedUser, error: matchError } = await supabase
    .from("users")
    .select("*")
    .eq("role", "member")
    .or(`unique_id.eq."${trimmedId}",id.eq."${trimmedId}"`)
    .maybeSingle();

  console.log(`[verifyUserCheckIn] User lookup result:`, {
    found: !!matchedUser,
    error: matchError?.message,
    data: matchedUser ? { id: matchedUser.id, name: matchedUser.name } : null
  });

  if (matchedUser) {
    user = matchedUser;
    console.log(`✓ Found user by matching unique_id, ID, or QR string: ${trimmedId}`, { userId: user.id, name: user.name });
  } else {
    // Priority 4: Try by name search if other methods failed
    console.log(`[verifyUserCheckIn] No exact match, trying name search for: "${trimmedId}"`);
    const nameMatch = await supabase
      .from("users")
      .select("*")
      .eq("role", "member")
      .ilike("name", `%${trimmedId}%`)
      .limit(1);

    if (nameMatch.data && nameMatch.data.length > 0) {
      user = nameMatch.data[0];
      console.log(`✓ Found user by name: ${trimmedId}`);
    } else if (nameMatch.error) {
      queryError = nameMatch.error;
    }

    if (!user && matchError) {
      queryError = matchError;
    }
  }

  if (!user) {
    console.error(`[verifyUserCheckIn] ❌ User not found with identifier: "${trimmedId}"`);
    if (queryError) {
      console.error("Error finding user:", queryError);
      throw new Error(`Database error: ${queryError.message || "Unable to search for user"}`);
    }
    throw new Error(`User not found with identifier: "${trimmedId}". Please check the unique ID (format: 4 digits + special char), user ID, QR code, or name.`);
  }

  console.log(`[verifyUserCheckIn] ✅ User found:`, {
    id: user.id,
    name: user.name,
    unique_id: user.unique_id,
    membership_status: user.membership_status,
    membership_expiry: user.membership_expiry
  });

  // Gating for Durable ID Lifecycle: Reject Event/Guest IDs for Gym Entry
  if (user.unique_id && user.unique_id.toUpperCase().startsWith("EV-")) {
    console.warn(`[verifyUserCheckIn] 🚫 Access REJECTED for ${user.name}: Event Guest ID.`);
    return {
      status: "rejected" as const,
      color: "yellow" as const,
      reason: "Event Guest access only. Paid membership required for gym floor entry.",
      userId: user.id,
      user: {
        photoUrl: user.face_photo_url || user.avatar_url || null,
        fullName: user.name || "Unknown",
        membershipPlan: "Event Access",
        expiryDate: null,
        daysLeft: 0,
        overdueDays: 0,
      },
    };
  }

  // Get user's photo URL
  const photoUrl = user.face_photo_url || user.avatar_url || null;

  // Calculate days left and overdue days
  const now = new Date();

  // Check if this is a QR code scan (matches qr_code_string) and verify expiration
  const isQRCodeScan = user.qr_code_string === trimmedId;
  if (isQRCodeScan) {
    const qrExpiresAt = user.qr_code_expires_at ? new Date(user.qr_code_expires_at) : null;

    // Check if QR code has expired
    if (qrExpiresAt && qrExpiresAt < now) {
      const expiryDate = user.renewal_due_date;

      return {
        status: "rejected" as const,
        color: "red" as const,
        reason: "QR code expired. Please generate a new QR code.",
        user: {
          photoUrl,
          fullName: user.name || "Unknown",
          membershipPlan: user.membership_type || user.membership_plan || null,
          expiryDate: expiryDate || null,
          daysLeft: 0,
          overdueDays: 0,
        },
      };
    }

    // Also verify QR code expiration aligns with membership expiry
    // If membership has expired, QR code should also be considered invalid
    const membershipExpiry = user.renewal_due_date;
    if (membershipExpiry) {
      const membershipExpiryDate = new Date(membershipExpiry);
      if (membershipExpiryDate < now) {
        // Membership has expired, QR code is no longer valid
        return {
          status: "rejected" as const,
          color: "red" as const,
          reason: "Membership expired. QR code is no longer valid. Please renew membership and generate a new QR code.",
          userId: user.id,
          user: {
            photoUrl,
            fullName: user.name || "Unknown",
            membershipPlan: user.membership_type || user.membership_plan || null,
            expiryDate: membershipExpiry,
            daysLeft: 0,
            overdueDays: 0,
          },
        };
      }

      // For daily subscriptions, verify QR code expires at end of day or before
      const membershipType = (user.membership_type || user.membership_plan || "").toLowerCase();
      const isDailySubscription =
        membershipType.includes("daily") ||
        membershipType.includes("day pass") ||
        membershipType === "day";

      if (isDailySubscription && qrExpiresAt) {
        // For daily subscriptions, QR code should expire at end of day
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);

        // Check if QR code expiration is beyond today (shouldn't happen, but verify)
        if (qrExpiresAt > endOfToday) {
          return {
            status: "rejected" as const,
            color: "red" as const,
            reason: "QR code expiration does not match daily subscription. Please generate a new QR code.",
            userId: user.id,
            user: {
              photoUrl,
              fullName: user.name || "Unknown",
              membershipPlan: user.membership_type || user.membership_plan || null,
              expiryDate: membershipExpiry,
              daysLeft: 0,
              overdueDays: 0,
            },
          };
        }
      }
    }
  }
  const expiryDate = user.renewal_due_date;
  let daysLeft = 0;
  let overdueDays = 0;

  if (expiryDate) {
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      overdueDays = Math.abs(diffDays);
      daysLeft = 0;
    } else {
      daysLeft = diffDays;
      overdueDays = 0;
    }
  }

  // Check membership status and various conditions
  const membershipStatus = user.membership_status?.toLowerCase() || "inactive";
  // Don't default paymentStatus to "pending" - only use it if it exists
  // We'll check the payments table to determine actual payment status
  const paymentStatus = user.payment_status?.toLowerCase() || null;
  const accountSuspended = user.account_suspended === true;
  const accountBanned = user.account_banned === true;
  const planFrozen = user.plan_frozen === true || user.membership_status?.toLowerCase() === "frozen";

  // Check if plan start date is in the future
  const planStartDate = user.plan_start_date ? new Date(user.plan_start_date) : null;
  const planNotYetActive = planStartDate && planStartDate > now;

  // Check trial status
  const trialEnded = user.trial_status === "ended" || user.trial_status === "expired";
  const trialActive = user.trial_status === "active";

  // Check class booking requirements
  const requiredClassBooking = user.required_class_booking === true;

  // SMART PAYMENT STATUS CHECK: Check payments table for pending approvals and payment history
  let hasPendingPaymentApproval = false;
  let hasRejectedPayment = false;
  let hasNoPayment = false;
  let hasCompletedPayment = false;
  let lastPaymentStatus = null;
  let lastPaymentDate = null;

  // Define successful payment statuses (comprehensive list)
  const successfulStatuses = [
    "completed", "approved", "active", "paid", "success",
    "successful", "confirmed", "processed", "settled", "accepted"
  ];

  // First, check user-level payment_status as a quick indicator
  const userPaymentStatus = user.payment_status?.toLowerCase();
  const membershipStatusLower = user.membership_status?.toLowerCase();
  const userExpiryDate = user.renewal_due_date;

  // User has paid if ANY of these conditions are true:
  // 1. payment_status is in successful statuses
  // 2. payment_status is "paid" 
  // 3. user has paid_at field set
  // 4. membership_status is "active" or "valid" (indicates they've paid)
  // 5. membership_expiry or renewal_due_date exists (indicates they had a paid membership)
  //    Note: Even if expired, having an expiry date means they paid at some point
  const userHasPaymentStatus =
    (userPaymentStatus && successfulStatuses.includes(userPaymentStatus)) ||
    userPaymentStatus === "paid" ||
    !!user.paid_at ||
    membershipStatusLower === "active" ||
    membershipStatusLower === "valid" ||
    !!userExpiryDate; // Having any expiry date means they had a membership (paid)

  console.log(`[Payment Check] User ${user.id} (${user.name}):`, {
    payment_status: user.payment_status,
    membership_status: user.membership_status,
    membership_expiry: user.membership_expiry || user.renewal_due_date,
    paid_at: user.paid_at
  });

  try {
    // ROBUST PAYMENT CHECK: Try multiple query approaches to ensure we find payments
    let allPayments: any[] = [];
    let paymentsError: any = null;

    // Method 1: Standard query with user_id
    const { data: payments1, error: error1 } = await supabase
      .from("payments")
      .select("id, status, amount, paid_at, created_at, user_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error1 && payments1) {
      allPayments = payments1;
      console.log(`[Payment Check] Method 1 (user_id) found ${payments1.length} payments`);
    } else {
      paymentsError = error1;
      console.warn(`[Payment Check] Method 1 failed:`, error1);

      // Method 2: Try with string conversion (in case of type mismatch)
      const { data: payments2, error: error2 } = await supabase
        .from("payments")
        .select("id, status, amount, paid_at, created_at, user_id")
        .eq("user_id", String(user.id))
        .order("created_at", { ascending: false });

      if (!error2 && payments2) {
        allPayments = payments2;
        console.log(`[Payment Check] Method 2 (string user_id) found ${payments2.length} payments`);
      } else {
        // Method 3: Try without filter first, then filter in memory (last resort)
        const { data: allPaymentsData, error: error3 } = await supabase
          .from("payments")
          .select("id, status, amount, paid_at, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(1000); // Reasonable limit

        if (!error3 && allPaymentsData) {
          // Filter in memory
          allPayments = allPaymentsData.filter((p: any) =>
            p.user_id === user.id ||
            String(p.user_id) === String(user.id) ||
            p.user_id?.toString() === user.id?.toString()
          );
          console.log(`[Payment Check] Method 3 (filter in memory) found ${allPayments.length} payments out of ${allPaymentsData.length} total`);
        } else {
          paymentsError = error3 || error2 || error1;
        }
      }
    }

    console.log(`[Payment Check] Final query result for user ${user.id}:`, {
      paymentsFound: allPayments?.length || 0,
      error: paymentsError?.message || null,
      payments: allPayments?.map(p => ({
        id: p.id,
        status: p.status,
        paid_at: p.paid_at,
        user_id: p.user_id
      })) || []
    });

    if (paymentsError && !allPayments.length) {
      console.warn("Error checking payments table:", paymentsError);
      // If payments table query fails, use user-level indicators as fallback
      if (userHasPaymentStatus) {
        hasCompletedPayment = true;
        console.log(`User ${user.id} - payment table error, but user has payment_status indicating payment: ${userPaymentStatus}`);
      } else if (!user.payment_status) {
        hasNoPayment = true;
        console.log(`User ${user.id} - payment check error, and no payment_status set, assuming no payment`);
      }
    } else if (!allPayments || allPayments.length === 0) {
      // NO PAYMENTS IN TABLE - but check user-level indicators
      if (userHasPaymentStatus) {
        // User has payment_status indicating they paid, even if no payment record exists
        hasCompletedPayment = true;
        console.log(`User ${user.id} has no payment records in table, but user.payment_status indicates payment: ${userPaymentStatus}`);
      } else {
        // Only mark as no payment if we're CERTAIN there are no payments
        // Double-check by looking at user fields that indicate payment
        if (!user.membership_expiry && !user.renewal_due_date && !user.paid_at && !user.payment_status) {
          hasNoPayment = true;
          console.log(`User ${user.id} has no payment records and no payment indicators`);
        } else {
          // User has some indicator of payment (expiry date, etc.) even if no payment record
          hasCompletedPayment = true;
          console.log(`User ${user.id} has no payment records but has membership expiry/paid_at, considering as paid`);
        }
      }
    } else {
      // IMPORTANT: If we found ANY payment records, user has made a payment
      // Never mark as "no payment" if payment records exist
      hasNoPayment = false;
      // User has payments in table - check their status
      const latestPayment = allPayments[0];
      lastPaymentStatus = latestPayment.status?.toLowerCase();
      lastPaymentDate = latestPayment.paid_at || latestPayment.created_at;

      console.log(`[Payment Check] Latest payment for user ${user.id}:`, {
        status: lastPaymentStatus,
        paid_at: lastPaymentDate,
        allStatuses: allPayments.map(p => p.status)
      });

      // Check for pending approvals (only count if no successful payment exists)
      const pendingPayments = allPayments.filter(p => {
        const status = p.status?.toLowerCase();
        return status === "pending_approval" || status === "pending";
      });

      // Check if user has ANY successful payment (not just the latest)
      // This is important because a user might have an old completed payment
      // but a newer pending one, and we should still recognize they have paid
      const successfulPayments = allPayments.filter(p => {
        const status = p.status?.toLowerCase();
        return status && successfulStatuses.includes(status);
      });

      // Also check for payments with paid_at date (indicates successful payment)
      const paymentsWithPaidDate = allPayments.filter(p => p.paid_at);

      // Check for any payment that's not explicitly rejected/failed
      // If user has ANY payment record that's not rejected, they've attempted payment
      const nonRejectedPayments = allPayments.filter(p => {
        const status = p.status?.toLowerCase();
        return status !== "rejected" && status !== "failed" && status !== "declined";
      });

      // Check for payments with amount > 0 (indicates actual payment transaction)
      const paymentsWithAmount = allPayments.filter(p => p.amount && Number(p.amount) > 0);

      // User has completed payment if they have:
      // 1. Any successful payment status, OR
      // 2. Any payment with paid_at date, OR
      // 3. Any payment that's not rejected (indicates payment attempt/success), OR
      // 4. Any payment with amount > 0 (indicates actual payment), OR
      // 5. User-level payment_status indicating payment
      // NOTE: If user has ANY payment records at all, they've made a payment attempt
      // Only mark as "no payment" if there are literally zero payment records
      if (successfulPayments.length > 0 ||
        paymentsWithPaidDate.length > 0 ||
        nonRejectedPayments.length > 0 ||
        paymentsWithAmount.length > 0 ||
        allPayments.length > 0 || // ANY payment record means they've paid
        userHasPaymentStatus) {
        hasCompletedPayment = true;
        hasNoPayment = false; // Override - if we found payments, they've paid
        console.log(`✅ User ${user.id} HAS COMPLETED PAYMENT:`, {
          successfulPayments: successfulPayments.length,
          paymentsWithPaidDate: paymentsWithPaidDate.length,
          nonRejectedPayments: nonRejectedPayments.length,
          paymentsWithAmount: paymentsWithAmount.length,
          allPayments: allPayments.length,
          userPaymentStatus: userPaymentStatus
        });
      } else {
        // This should rarely happen since we check allPayments.length > 0 above
        console.log(`❌ User ${user.id} payment check:`, {
          successfulPayments: successfulPayments.length,
          paymentsWithPaidDate: paymentsWithPaidDate.length,
          nonRejectedPayments: nonRejectedPayments.length,
          paymentsWithAmount: paymentsWithAmount.length,
          allPayments: allPayments.length,
          latestStatus: lastPaymentStatus,
          allStatuses: allPayments.map(p => p.status)
        });
      }

      // Only mark as pending if there are pending payments AND no successful payments
      if (pendingPayments.length > 0 && !hasCompletedPayment) {
        hasPendingPaymentApproval = true;
        console.log(`User ${user.id} has ${pendingPayments.length} pending payment(s) and no successful payments`);
      }

      // Check if latest payment was rejected or failed (only if no successful payment exists)
      if (!hasCompletedPayment && (lastPaymentStatus === "rejected" || lastPaymentStatus === "failed" || lastPaymentStatus === "declined")) {
        hasRejectedPayment = true;
        console.log(`User ${user.id} has rejected/failed payment`);
      }
    }
  } catch (paymentCheckError) {
    console.error("Exception checking payment status:", paymentCheckError);
    // Use user-level indicators as fallback
    if (userHasPaymentStatus) {
      hasCompletedPayment = true;
      console.log(`User ${user.id} - exception checking payments, but user has payment_status indicating payment`);
    } else if (!user.payment_status) {
      hasNoPayment = true;
      console.log(`User ${user.id} - exception checking payments, and no payment_status set`);
    }
  }

  // Determine status and reason
  let status: "approved" | "rejected" = "approved";
  let color: "green" | "yellow" | "red" | "grey" = "green";
  let reason = "Access granted";

  // Rejection checks (highest priority first)
  if (accountBanned) {
    status = "rejected";
    color = "red";
    reason = "User banned";
    return {
      status,
      color,
      reason,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft: 0,
        overdueDays,
      },
    };
  }

  if (accountSuspended) {
    status = "rejected";
    color = "red";
    reason = "Account suspended";
    return {
      status,
      color,
      reason,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft: 0,
        overdueDays,
      },
    };
  }

  if (planFrozen) {
    status = "rejected";
    color = "grey";
    reason = "Membership frozen";
    return {
      status,
      color,
      reason,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft,
        overdueDays,
      },
    };
  }

  if (trialEnded && !membershipStatus.includes("active")) {
    status = "rejected";
    color = "red";
    reason = "Trial ended";
    return {
      status,
      color,
      reason,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft: 0,
        overdueDays,
      },
    };
  }

  if (planNotYetActive) {
    status = "rejected";
    color = "red";
    reason = "Plan not yet active";
    return {
      status,
      color,
      reason,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft,
        overdueDays,
      },
    };
  }

  // SMART PAYMENT CHECKS (Priority order - most critical first)
  // Format expiry date for display
  const formattedExpiryDate = expiryDate ? new Date(expiryDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : null;

  // 1. Check if no payment has been made at all (HIGHEST PRIORITY - before checking expiration)
  // IMPORTANT: Users who never paid should NOT be told "membership expired"
  // IMPORTANT: Only mark as hasNoPayment if we're ABSOLUTELY CERTAIN they haven't paid
  // (i.e., no payments in table AND no user-level payment indicators AND no membership expiry)

  // Final safety check: If hasCompletedPayment is true, hasNoPayment must be false
  if (hasCompletedPayment) {
    hasNoPayment = false;
    console.log(`✅ User ${user.id} - hasCompletedPayment=true, overriding hasNoPayment to false`);
  }

  // Only show "No payment recorded" if we're CERTAIN they haven't paid
  if (hasNoPayment && !hasCompletedPayment) {
    // Double-check: Make sure we don't have any payment indicators
    const hasAnyPaymentIndicator =
      userHasPaymentStatus ||
      userExpiryDate ||
      user.paid_at ||
      membershipStatusLower === "active" ||
      membershipStatusLower === "valid";

    if (hasAnyPaymentIndicator) {
      // User has payment indicators, don't show "no payment"
      hasCompletedPayment = true;
      hasNoPayment = false;
      console.log(`⚠️ User ${user.id} - hasNoPayment was true but found payment indicators, overriding`);
    } else {
      console.log(`🚫 User ${user.id} (${user.name}) has NO payment records - returning "No payment recorded"`);
      status = "rejected";
      color = "red";
      reason = "No payment recorded - Please complete payment to activate membership";
      return {
        status,
        color,
        reason,
        userId: user.id, // Include user ID for notifications
        user: {
          photoUrl,
          fullName: user.name || "Unknown",
          membershipPlan: user.membership_type || user.membership_plan || null,
          expiryDate: null, // No expiry date if never paid
          daysLeft: 0,
          overdueDays: 0,
        },
      };
    }
  }

  // 2. Check for pending payment approval
  if (hasPendingPaymentApproval) {
    console.log(`⏳ User ${user.id} (${user.name}) has pending payment approval`);
    status = "rejected";
    color = "yellow"; // Yellow to indicate pending, not fully rejected
    reason = "Payment pending approval - Please wait for admin approval";
    return {
      status,
      color,
      reason,
      userId: user.id,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft: daysLeft > 0 ? daysLeft : 0,
        overdueDays,
      },
    };
  }

  // 3. Check for rejected/failed payments
  // Only check if user has payments - users who never paid are already handled above
  if (!hasNoPayment && (hasRejectedPayment || paymentStatus === "rejected" || paymentStatus === "failed" || paymentStatus === "declined")) {
    status = "rejected";
    color = "red";
    reason = lastPaymentStatus === "rejected"
      ? "Payment rejected - Please contact admin or make a new payment"
      : "Payment failed - Please update payment method or contact support";
    return {
      status,
      color,
      reason,
      userId: user.id,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft: 0,
        overdueDays,
      },
    };
  }

  // 4. Check if membership expired (ONLY if payment exists - users who never paid are already handled above)
  // IMPORTANT: Only check expiration if user has made payments before
  if (hasCompletedPayment && (!expiryDate || membershipStatus === "expired" || overdueDays > 0)) {
    // PERSIST deactivation to database
    try {
      if (user.membership_status !== "Inactive") {
        await supabase
          .from("users")
          .update({ membership_status: "Inactive" })
          .eq("id", user.id);
        console.log(`[Check-In] Live deactivation persisted for member: ${user.id}`);
      }
    } catch (e) {
      console.error("[Check-In] Failed to persist deactivation:", e);
    }

    status = "rejected";
    color = "red";
    if (overdueDays > 0 && expiryDate) {
      // Show when it expired
      reason = `Membership expired on ${formattedExpiryDate} (${overdueDays} day${overdueDays !== 1 ? 's' : ''} ago) - Please renew membership`;
    } else if (expiryDate) {
      // Show expiration date
      reason = `Membership expired on ${formattedExpiryDate} - Please renew your membership`;
    } else {
      // No expiry date but status says expired
      reason = "Membership expired - Please renew your membership";
    }
    return {
      status,
      color,
      reason,
      userId: user.id,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft: 0,
        overdueDays,
      },
    };
  }

  // 5. Check for overdue payments (if not already expired and user has paid before)
  if (hasCompletedPayment && overdueDays > 0 && expiryDate) {
    // PERSIST deactivation to database
    try {
      if (user.membership_status !== "Inactive") {
        await supabase
          .from("users")
          .update({
            membership_status: "Inactive",
            status: "Active" // Ensure account login is still possible
          })
          .eq("id", user.id);
        console.log(`[Check-In] Live membership deactivation persisted for member: ${user.id}`);
      }
    } catch (e) {
      console.error("[Check-In] Failed to persist deactivation:", e);
    }

    status = "rejected";
    color = "red";
    reason = `Payment overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''} (expired on ${formattedExpiryDate}) - Please renew membership`;
    return {
      status,
      color,
      reason,
      userId: user.id,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft: 0,
        overdueDays,
      },
    };
  }

  // 6. Check payment status (pending, not approved, etc.)
  // IMPORTANT: Only check user-level payment_status if user has payments in the payments table
  // If hasNoPayment is true, we already returned above, so this should never trigger for users who never paid
  if (!hasNoPayment && paymentStatus === "pending" && !hasPendingPaymentApproval) {
    status = "rejected";
    color = "yellow";
    reason = "Payment pending - Awaiting payment confirmation";
    return {
      status,
      color,
      reason,
      userId: user.id,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft: daysLeft > 0 ? daysLeft : 0,
        overdueDays,
      },
    };
  }

  // 7. Check if payment status is not approved (general check)
  // IMPORTANT: Only check if user has payments - users who never paid are already handled above
  // IMPORTANT: Don't reject if user has completed payment (hasCompletedPayment is true)
  // This prevents users who have paid from being incorrectly flagged as not paid
  // Reusing successfulStatuses declared earlier in the function

  if (!hasNoPayment && !hasCompletedPayment && paymentStatus &&
    !successfulStatuses.includes(paymentStatus.toLowerCase()) &&
    !hasPendingPaymentApproval) {
    status = "rejected";
    color = "red";
    reason = `Payment status: ${paymentStatus} - Payment not approved`;
    return {
      status,
      color,
      reason,
      userId: user.id,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft: 0,
        overdueDays,
      },
    };
  }

  // If membership is active but expiring soon (within 3 days)
  if (daysLeft <= 3 && daysLeft > 0) {
    status = "approved";
    color = "yellow";
    reason = `Membership expiring in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;
    const today = new Date().toISOString().split("T")[0];
    const { data: todayCheckIn } = await supabase
      .from("attendance_logs")
      .select("checkin_time")
      .eq("user_id", user.id)
      .gte("checkin_time", `${today}T00:00:00.000Z`)
      .lt("checkin_time", `${today}T23:59:59.999Z`)
      .order("checkin_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      status,
      color,
      reason: todayCheckIn
        ? `Already checked in today at ${new Date(todayCheckIn.checkin_time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
        : reason,
      userId: user.id,
      user: {
        photoUrl,
        fullName: user.name || "Unknown",
        membershipPlan: user.membership_type || user.membership_plan || null,
        expiryDate: expiryDate || null,
        daysLeft,
        overdueDays,
      },
      alreadyCheckedInToday: !!todayCheckIn,
      checkInTimeToday: todayCheckIn?.checkin_time,
    };
  }

  // If membership is active and not expiring soon
  console.log(`✅ User ${user.id} (${user.name}) approved for access`);

  // Check if already checked in today
  const today = new Date().toISOString().split("T")[0];
  const { data: todayCheckIn } = await supabase
    .from("attendance_logs")
    .select("checkin_time")
    .eq("user_id", user.id)
    .gte("checkin_time", `${today}T00:00:00.000Z`)
    .lt("checkin_time", `${today}T23:59:59.999Z`)
    .order("checkin_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  const alreadyCheckedInToday = !!todayCheckIn;
  const checkInTimeToday = todayCheckIn?.checkin_time ?? undefined;

  // LOG ATTENDANCE: Record this successful check-in (only if not already checked in)
  if (!alreadyCheckedInToday) {
    try {
      const { error: logError } = await supabase
        .from("attendance_logs")
        .insert({
          user_id: user.id,
          membership_type: user.membership_type || user.membership_plan || "Member",
          status: "approved",
        });

      if (logError) console.warn("Failed to log attendance:", logError.message);
      else console.log("Attendance logged successfully for:", user.name);
    } catch (logErr) {
      console.warn("Exception during attendance logging:", logErr);
    }
  } else {
    const timeStr = checkInTimeToday
      ? new Date(checkInTimeToday).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : "";
    reason = `Already checked in today${timeStr ? ` at ${timeStr}` : ""}`;
  }

  return {
    status,
    color,
    reason,
    userId: user.id,
    user: {
      photoUrl,
      fullName: user.name || "Unknown",
      membershipPlan: user.membership_type || user.membership_plan || null,
      expiryDate: expiryDate || null,
      daysLeft,
      overdueDays,
    },
    alreadyCheckedInToday,
    checkInTimeToday,
  };
}

/**
 * Search users by name, unique ID, or email for autocomplete
 */
export async function searchUsersByName(searchTerm: string): Promise<Array<{ id: string; name: string; email: string | null; photoUrl: string | null; unique_id: string | null }>> {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  // Sanitize search term: replace spaces with wildcards for flexible matching
  // "John Doe" becomes "%John%Doe%"
  const flexibleTerm = `%${searchTerm.trim().replace(/\s+/g, "%")}%`;

  console.log(`[searchUsersByName] Searching for: "${searchTerm}" using pattern: "${flexibleTerm}"`);

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, avatar_url, face_photo_url, unique_id")
    .or(`name.ilike.${flexibleTerm},email.ilike.${flexibleTerm},unique_id.ilike.${flexibleTerm}`)
    .limit(30);

  if (error) {
    console.error("Error searching users:", error);
    return [];
  }

  return (data || []).map((user) => ({
    id: user.id,
    name: user.name || "Unknown",
    email: user.email || null,
    photoUrl: user.face_photo_url || user.avatar_url || null,
    unique_id: (user as any).unique_id || null,
  }));
}

