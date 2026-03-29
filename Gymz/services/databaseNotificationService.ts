import { supabase } from './supabase';

export const NOTIFICATION_TYPES = {
    PAYMENT: 'payment',
    PAYMENT_PENDING: 'payment_pending',
    PAYMENT_APPROVED: 'payment_approved',
    PAYMENT_REJECTED: 'payment_rejected',
    PAYMENT_COMPLETED: 'payment_completed',
    INFO: 'info',
    ADMIN_UPDATE: 'admin_update',
    CRITICAL: 'critical',
    SYSTEM_ALERT: 'system_alert'
} as const;

export const NOTIFICATION_PRIORITY = {
    CRITICAL: 1,
    URGENT: 2,
    STANDARD: 3,
    LOW: 4,
} as const;

export const NOTIFICATION_STATUS = {
    UNREAD: 'unread',
    READ: 'read',
    ACKNOWLEDGED: 'acknowledged',
} as const;

export interface NotificationData {
    message: string;
    type: string;
    priority?: number;
    user_id?: string | null;
    payment_id?: string;
    member_id?: string;
    action_url?: string;
    action_label?: string;
    platform_origin?: string;
    status?: string;
}

export const databaseNotificationService = {
    async createNotification(data: NotificationData) {
        try {
            const notificationData: any = {
                message: data.message,
                type: data.type,
                user_id: data.user_id || null,
                payment_id: data.payment_id || null,
                action_url: data.action_url || null,
                action_label: data.action_label || null,
                priority: data.priority || null,
                status: data.status || NOTIFICATION_STATUS.UNREAD,
                platform_origin: data.platform_origin || 'mobile',
                created_at: new Date().toISOString(),
                is_read: false
            };

            console.log(`[DB Notification] Creating ${data.type} for ${data.user_id || 'admin'}`);

            const { data: result, error } = await supabase
                .from('notifications')
                .insert(notificationData)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data: result };
        } catch (error) {
            console.error('[DB Notification] Error:', error);
            return { success: false, error };
        }
    },

    async notifyPaymentPending(payment: { id: string; amount: number; user_id: string; member_name?: string; method?: string }) {
        const currency = new Intl.NumberFormat("en-ZM", {
            style: "currency",
            currency: "ZMW",
        });

        return await this.createNotification({
            message: `New ${payment.method || 'payment'} of ${currency.format(payment.amount)} from ${payment.member_name || 'Member'} - Awaiting approval`,
            type: NOTIFICATION_TYPES.PAYMENT_PENDING,
            priority: NOTIFICATION_PRIORITY.URGENT,
            user_id: null, // Admin notification
            payment_id: payment.id,
            action_url: "/finances", // Matching GMS
            action_label: "Review Payment",
        });
    },

    async markAsRead(notificationId: string) {
        try {
            // @ts-ignore
            const { error } = await ((supabase as any)
                .from('notifications')
                .update({
                    is_read: true,
                    status: NOTIFICATION_STATUS.READ
                } as any))
                .eq('id', notificationId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('[DB Notification] Error marking as read:', error);
            return { success: false, error };
        }
    },

    async acknowledge(notificationId: string) {
        try {
            // @ts-ignore
            const { error } = await ((supabase as any)
                .from('notifications')
                .update({
                    status: NOTIFICATION_STATUS.ACKNOWLEDGED,
                    acknowledged_at: new Date().toISOString(),
                    is_read: true
                } as any))
                .eq('id', notificationId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('[DB Notification] Error acknowledging:', error);
            return { success: false, error };
        }
    }
};
