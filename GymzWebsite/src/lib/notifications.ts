import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";

// Standardized notification types
export const NOTIFICATION_TYPES = {
  // Payment notifications
  PAYMENT_PENDING: 'payment_pending',
  PAYMENT_APPROVED: 'payment_approved',
  PAYMENT_REJECTED: 'payment_rejected',
  PAYMENT_COMPLETED: 'payment_completed',

  // Member notifications
  MEMBER_SIGNUP: 'member_signup',
  MEMBER_PROFILE_UPDATE: 'member_profile_update',
  MEMBER_CHECKIN: 'member_checkin',

  // Admin notifications
  ADMIN_UPDATE: 'admin_update',
  SYSTEM_ALERT: 'system_alert',

  // General
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

// Priority Levels (1 = highest)
export const NOTIFICATION_PRIORITY = {
  CRITICAL: 1, // Red, Persistent, Requires Acknowledgment
  URGENT: 2,   // Orange, Toast/Banner
  STANDARD: 3, // Yellow/Blue, Normal
  LOW: 4,      // Neutral, Background
} as const;

export const NOTIFICATION_STATUS = {
  UNREAD: 'unread',
  READ: 'read',
  ACKNOWLEDGED: 'acknowledged',
} as const;

// Notification categories for filtering
export const NOTIFICATION_CATEGORIES = {
  PAYMENTS: 'payments',
  MEMBERS: 'members',
  SYSTEM: 'system',
  ALL: 'all',
} as const;

/**
 * Create a notification in the database
 */
export async function createNotification(data: {
  message: string;
  type: string;
  priority?: number;
  userId?: string | null; // null = admin notification, string = member notification
  paymentId?: string;
  memberId?: string;
  actionUrl?: string;
  actionLabel?: string;
  status?: string;
  platformOrigin?: string;
  metadata?: Record<string, any>;
}) {
  try {
    const notificationData = DataMapper.toDb({
      message: data.message,
      type: data.type,
      userId: data.userId ?? null,
      paymentId: data.paymentId || null,
      actionUrl: data.actionUrl || null,
      actionLabel: data.actionLabel || null,
      priority: data.priority || null,
      status: data.status || NOTIFICATION_STATUS.UNREAD,
      platformOrigin: data.platformOrigin || 'website',
      createdAt: new Date().toISOString(),
    });

    // Add is_read if column exists
    try {
      const { error: testError } = await supabase
        .from("notifications")
        .select("is_read")
        .limit(1);

      if (!testError) {
        notificationData.is_read = false; // keep snake_case for direct DB insert since it's checked directly
      }
    } catch (err) {
      // Column doesn't exist, continue without it
    }

    const { data: result, error } = await supabase
      .from("notifications")
      .insert(notificationData)
      .select()
      .single();

    if (error) {
      console.error("Error creating notification:", error);
      return { success: false, error };
    }

    return { success: true, data: result };
  } catch (err: any) {
    console.error("Unexpected error creating notification:", err);
    return { success: false, error: err };
  }
}

/**
 * Create payment pending notification (for admin)
 */
export async function notifyPaymentPending(payment: {
  id: string;
  amount: number;
  userId: string;
  memberName?: string;
  method?: string;
}) {
  const currency = new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return await createNotification({
    message: `New ${payment.method || 'payment'} of ${currency.format(payment.amount)} from ${payment.memberName || 'Member'} - Awaiting approval`,
    type: NOTIFICATION_TYPES.PAYMENT_PENDING,
    priority: NOTIFICATION_PRIORITY.URGENT,
    userId: null, // Admin notification
    paymentId: payment.id,
    actionUrl: "/finances",
    actionLabel: "Review Payment",
  });
}

/**
 * Create payment approved notification (for member)
 */
export async function notifyPaymentApproved(payment: {
  id: string;
  amount: number;
  userId: string;
  memberName?: string;
}) {
  const currency = new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // Notify member
  await createNotification({
    message: `Your payment of ${currency.format(payment.amount)} has been approved!`,
    type: NOTIFICATION_TYPES.PAYMENT_APPROVED,
    userId: payment.userId,
    paymentId: payment.id,
    actionUrl: "/member/payments",
    actionLabel: "View Payment",
  });

  // Notify admin (optional - for tracking)
  await createNotification({
    message: `Payment of ${currency.format(payment.amount)} from ${payment.memberName || 'Member'} has been approved`,
    type: NOTIFICATION_TYPES.PAYMENT_APPROVED,
    userId: null,
    paymentId: payment.id,
  });
}

/**
 * Create payment rejected notification (for member)
 */
export async function notifyPaymentRejected(payment: {
  id: string;
  amount: number;
  userId: string;
  memberName?: string;
  reason?: string;
}) {
  const currency = new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // Notify member
  await createNotification({
    message: `Your payment of ${currency.format(payment.amount)} was rejected${payment.reason ? `: ${payment.reason}` : ''}. Please contact support.`,
    type: NOTIFICATION_TYPES.PAYMENT_REJECTED,
    userId: payment.userId,
    paymentId: payment.id,
    actionUrl: "/member/payments",
    actionLabel: "View Payment",
  });

  // Notify admin
  await createNotification({
    message: `Payment of ${currency.format(payment.amount)} from ${payment.memberName || 'Member'} has been rejected`,
    type: NOTIFICATION_TYPES.PAYMENT_REJECTED,
    userId: null,
    paymentId: payment.id,
  });
}

/**
 * Create member signup notification (for admin)
 */
export async function notifyMemberSignup(member: {
  id: string;
  name: string;
  email: string;
}) {
  return await createNotification({
    message: `New member signup: ${member.name} (${member.email})`,
    type: NOTIFICATION_TYPES.MEMBER_SIGNUP,
    userId: null, // Admin notification
    memberId: member.id,
    actionUrl: "/members",
    actionLabel: "View Member",
  });
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const { error: testError } = await supabase
      .from("notifications")
      .select("is_read")
      .limit(1);

    if (testError) {
      // Column doesn't exist, skip
      return { success: true };
    }

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        status: NOTIFICATION_STATUS.READ
      })
      .eq("id", notificationId);

    if (error) {
      console.error("Error marking notification as read:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error marking notification as read:", err);
    return { success: false, error: err };
  }
}

/**
 * Acknowledge a notification (specifically for CRITICAL ones)
 */
export async function acknowledgeNotification(notificationId: string) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({
        status: NOTIFICATION_STATUS.ACKNOWLEDGED,
        acknowledged_at: new Date().toISOString(),
        is_read: true
      })
      .eq("id", notificationId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("Error acknowledging notification:", err);
    return { success: false, error: err };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId?: string | null) {
  try {
    const { error: testError } = await supabase
      .from("notifications")
      .select("is_read")
      .limit(1);

    if (testError) {
      return { success: true };
    }

    let query = supabase
      .from("notifications")
      .update({ is_read: true });

    if (userId) {
      query = query.eq("user_id", userId);
    } else {
      query = query.is("user_id", null); // Admin notifications
    }

    const { error } = await query;

    if (error) {
      console.error("Error marking all notifications as read:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error marking all notifications as read:", err);
    return { success: false, error: err };
  }
}

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type: string) {
  switch (type) {
    case NOTIFICATION_TYPES.PAYMENT_PENDING:
    case NOTIFICATION_TYPES.PAYMENT_APPROVED:
    case NOTIFICATION_TYPES.PAYMENT_COMPLETED:
      return 'DollarSign';
    case NOTIFICATION_TYPES.PAYMENT_REJECTED:
      return 'XCircle';
    case NOTIFICATION_TYPES.MEMBER_SIGNUP:
    case NOTIFICATION_TYPES.MEMBER_PROFILE_UPDATE:
      return 'User';
    case NOTIFICATION_TYPES.MEMBER_CHECKIN:
      return 'CheckCircle';
    case NOTIFICATION_TYPES.SYSTEM_ALERT:
    case NOTIFICATION_TYPES.ERROR:
      return 'AlertCircle';
    case NOTIFICATION_TYPES.WARNING:
      return 'AlertTriangle';
    default:
      return 'Bell';
  }
}

/**
 * Get notification color based on type
 */
export function getNotificationColor(type: string) {
  switch (type) {
    case NOTIFICATION_TYPES.PAYMENT_APPROVED:
    case NOTIFICATION_TYPES.PAYMENT_COMPLETED:
      return 'bg-primary';
    case NOTIFICATION_TYPES.PAYMENT_PENDING:
      return 'bg-yellow-500';
    case NOTIFICATION_TYPES.PAYMENT_REJECTED:
    case NOTIFICATION_TYPES.ERROR:
      return 'bg-red-500';
    case NOTIFICATION_TYPES.MEMBER_SIGNUP:
      return 'bg-primary';
    case NOTIFICATION_TYPES.WARNING:
      return 'bg-orange-500';
    default:
      return 'bg-gray-500';
  }
}

