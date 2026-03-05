/* @ts-nocheck */
import { supabase } from "@/integrations/supabase/client";

// Standardized notification types
export const NOTIFICATION_TYPES = {
  // Payment notifications
  PAYMENT: 'payment', // Base type
  PAYMENT_PENDING: 'payment_pending',
  PAYMENT_APPROVED: 'payment_approved',
  PAYMENT_REJECTED: 'payment_rejected',
  PAYMENT_COMPLETED: 'payment_completed',

  // Member notifications
  MEMBER_SIGNUP: 'member_signup',
  MEMBER_JOINED_GYM: 'member_joined_gym',
  MEMBER_JOINED_EVENT: 'member_joined_event',
  MEMBER_PROFILE_UPDATE: 'member_profile_update',
  MEMBER_CHECKIN: 'member_checkin',
  EVENT_SIGNUP: 'event_signup',
  ACCOUNT_DELETED: 'account_deleted',

  // Admin notifications
  ADMIN_UPDATE: 'admin_update',
  SYSTEM_ALERT: 'system_alert',
  EVENT_ANNOUNCEMENT: 'event_announcement',

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
 * CRITICAL: Admin notifications (user_id = null) MUST include gym_id for RLS visibility.
 */
export async function createNotification(data: {
  message: string;
  type: string;
  priority?: number;
  user_id?: string | null; // null = admin notification, string = member notification
  gym_id?: string | null; // REQUIRED for admin notifications - scopes visibility to gym admins
  payment_id?: string;
  member_id?: string;
  action_url?: string;
  action_label?: string;
  is_read?: boolean;
  status?: string;
  platform_origin?: string;
  metadata?: Record<string, any>;
}) {
  try {
    const notificationData: any = {
      message: data.message,
      type: data.type,
      user_id: data.user_id ?? null,
      gym_id: data.gym_id ?? null,
      payment_id: data.payment_id || null,
      action_url: data.action_url || null,
      action_label: data.action_label || null,
      priority: data.priority || null, // Will be set by trigger if null
      status: data.status || NOTIFICATION_STATUS.UNREAD,
      platform_origin: data.platform_origin || 'gms',
      created_at: new Date().toISOString(),
    };

    // Set read status on both potential columns for safety
    const isRead = data.is_read !== undefined ? data.is_read : false;
    notificationData.is_read = isRead;
    notificationData.read = isRead;

    console.log(`[Notification] Creating ${data.type} for ${data.user_id || 'admin'}: ${data.message}`);

    const { data: result, error } = await supabase
      .from("notifications")
      .insert(notificationData)
      .select()
      .single();

    if (error) {
      console.error("Error creating notification, trying without 'read' column:", error);

      // Level 1 Fallback: Remove 'read'
      const fallbackData = { ...notificationData };
      delete fallbackData.read;

      const { data: resultFallback, error: errorFallback } = await supabase
        .from("notifications")
        .insert(fallbackData)
        .select()
        .single();

      if (errorFallback) {
        console.error("Level 1 Fallback failed, trying without 'is_read':", errorFallback);

        // Level 2 Fallback: Remove 'is_read' as well
        const fallbackData2 = { ...fallbackData };
        delete fallbackData2.is_read;

        const { data: resultFallback2, error: errorFallback2 } = await supabase
          .from("notifications")
          .insert(fallbackData2)
          .select()
          .single();

        if (errorFallback2) {
          console.error("Critical error creating notification (Level 2 failed):", errorFallback2);
          return { success: false, error: errorFallback2 };
        }
        return { success: true, data: resultFallback2 };
      }
      return { success: true, data: resultFallback };
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
  user_id: string;
  member_name?: string;
  method?: string;
}) {
  const currency = new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return await createNotification({
    message: `New ${payment.method || 'payment'} of ${currency.format(payment.amount)} from ${payment.member_name || 'Member'} - Awaiting approval`,
    type: NOTIFICATION_TYPES.PAYMENT_PENDING,
    priority: NOTIFICATION_PRIORITY.URGENT,
    user_id: null, // Admin notification
    payment_id: payment.id,
    action_url: "/finances",
    action_label: "Review Payment",
  });
}

/**
 * Create payment approved notification (for member)
 * @param gym_id - REQUIRED for admin notification visibility (RLS scopes by gym_id)
 */
export async function notifyPaymentApproved(payment: {
  id: string;
  amount: number;
  user_id: string;
  member_name?: string;
  gym_id?: string;
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
    user_id: payment.user_id,
    payment_id: payment.id,
    action_url: "/member/payments",
    action_label: "View Payment",
  });

  // Notify admin (read by default as it's a confirmation of their own action)
  // gym_id is REQUIRED - without it, admin cannot see this notification (RLS)
  await createNotification({
    message: `DASHBOARD: You approved payment of ${currency.format(payment.amount)} from ${payment.member_name || 'Member'}`,
    type: NOTIFICATION_TYPES.PAYMENT_APPROVED,
    user_id: null,
    gym_id: payment.gym_id || null,
    payment_id: payment.id,
    is_read: true // Default to read
  });
}

/**
 * Create payment rejected notification (for member)
 * @param gym_id - REQUIRED for admin notification visibility (RLS scopes by gym_id)
 */
export async function notifyPaymentRejected(payment: {
  id: string;
  amount: number;
  user_id: string;
  member_name?: string;
  reason?: string;
  gym_id?: string;
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
    user_id: payment.user_id,
    payment_id: payment.id,
    action_url: "/member/payments",
    action_label: "View Payment",
  });

  // Notify admin (read by default)
  // gym_id is REQUIRED - without it, admin cannot see this notification (RLS)
  await createNotification({
    message: `Payment of ${currency.format(payment.amount)} from ${payment.member_name || 'Member'} has been rejected`,
    type: NOTIFICATION_TYPES.PAYMENT_REJECTED,
    user_id: null,
    gym_id: payment.gym_id || null,
    payment_id: payment.id,
    is_read: true // Default to read
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
    user_id: null, // Admin notification
    member_id: member.id,
    action_url: "/members",
    action_label: "View Member",
  });
}

/**
 * Create event announcement notification (for attendees)
 */
export async function notifyEventAnnouncement(data: {
  event_id: string;
  user_ids: string[];
  message: string;
}) {
  const promises = data.user_ids.map(uid => createNotification({
    message: data.message,
    type: NOTIFICATION_TYPES.EVENT_ANNOUNCEMENT,
    user_id: uid,
    action_url: `/events/${data.event_id}`,
    action_label: "View Event",
    priority: NOTIFICATION_PRIORITY.URGENT,
  }));

  return await Promise.all(promises);
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
        read: true,
        status: NOTIFICATION_STATUS.READ
      })
      .eq("id", notificationId);

    if (error) {
      // Fallback for missing columns
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
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
      .update({ is_read: true, read: true });

    if (userId) {
      query = query.eq("user_id", userId);
    } else {
      query = query.is("user_id", null); // Admin notifications
    }

    const { error } = await query;

    if (error) {
      // Fallback for missing 'read' column
      let fallbackQuery = supabase
        .from("notifications")
        .update({ is_read: true });
      if (userId) fallbackQuery = fallbackQuery.eq("user_id", userId);
      else fallbackQuery = fallbackQuery.is("user_id", null);
      await fallbackQuery;
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
    case NOTIFICATION_TYPES.MEMBER_JOINED_GYM:
    case NOTIFICATION_TYPES.MEMBER_JOINED_EVENT:
    case NOTIFICATION_TYPES.MEMBER_PROFILE_UPDATE:
    case NOTIFICATION_TYPES.ACCOUNT_DELETED:
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
    case NOTIFICATION_TYPES.MEMBER_JOINED_GYM:
    case NOTIFICATION_TYPES.MEMBER_JOINED_EVENT:
    case NOTIFICATION_TYPES.EVENT_SIGNUP:
      return 'bg-primary';
    case NOTIFICATION_TYPES.WARNING:
      return 'bg-orange-500';
    default:
      return 'bg-gray-500';
  }
}

