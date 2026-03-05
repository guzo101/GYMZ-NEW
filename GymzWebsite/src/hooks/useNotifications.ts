/* @ts-nocheck */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { NOTIFICATION_TYPES, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/notifications";
import { DataMapper } from "@/utils/dataMapper";

interface Notification {
  id: string;
  message: string;
  type: string;
  userId: string | null;
  paymentId: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
  createdAt: string;
  isRead?: boolean;
  status: string;
  priority: number;
  acknowledgedAt?: string;
  platformOrigin?: string;
  users?: { name: string } | null;
  paymentStatus?: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from("notifications")
        .select("*,users(name)");

      // Filter based on user role
      if (user.role === "admin") {
        // Admin sees: payment notifications, admin updates, system notifications (user_id is null)
        query = query.or(
          `type.eq.${NOTIFICATION_TYPES.PAYMENT_PENDING},` +
          `type.eq.${NOTIFICATION_TYPES.PAYMENT_APPROVED},` +
          `type.eq.${NOTIFICATION_TYPES.PAYMENT_REJECTED},` +
          `type.eq.${NOTIFICATION_TYPES.PAYMENT_COMPLETED},` +
          `type.eq.${NOTIFICATION_TYPES.MEMBER_SIGNUP},` +
          `type.eq.${NOTIFICATION_TYPES.ADMIN_UPDATE},` +
          `type.is.null,user_id.is.null`
        );
      } else {
        // Members see only their own notifications
        query = query.eq("user_id", user.id);
      }

      // Fetch with priority and timestamp sorting
      const { data, error } = await query
        .order("priority", { ascending: true }) // Rank 1 at top
        .order("created_at", { ascending: false }) // Newer items first within same priority
        .limit(50);

      if (error) {
        console.error("Error fetching notifications:", error);
        setNotifications([]);
        return;
      }

      // Remove duplicates for payment notifications (keep most recent)
      const notificationMap = new Map();
      const mappedData = DataMapper.fromDb(data || []) as Notification[];

      mappedData.forEach((n: Notification) => {
        if (n.paymentId) {
          const existing = notificationMap.get(n.paymentId);
          if (!existing || new Date(n.createdAt) > new Date(existing.createdAt)) {
            notificationMap.set(n.paymentId, n);
          }
        } else {
          notificationMap.set(n.id, n);
        }
      });

      const uniqueNotifications = Array.from(notificationMap.values()) as Notification[];

      // Fetch payment statuses for payment notifications
      const paymentNotifications = uniqueNotifications.filter(
        n => n.paymentId && (
          n.type === NOTIFICATION_TYPES.PAYMENT_PENDING ||
          n.type === NOTIFICATION_TYPES.PAYMENT_APPROVED ||
          n.type === NOTIFICATION_TYPES.PAYMENT_REJECTED ||
          n.type === NOTIFICATION_TYPES.PAYMENT_COMPLETED
        )
      );

      if (paymentNotifications.length > 0) {
        const paymentIds = paymentNotifications.map(n => n.paymentId).filter(Boolean) as string[];

        const { data: rawPayments } = await supabase
          .from("payments")
          .select("id, status, payment_status")
          .in("id", paymentIds);

        const payments = DataMapper.fromDb(rawPayments || []) as any[];

        const paymentStatusMap = new Map<string, string>(
          payments.map(p => [p.id, (p.status || p.paymentStatus || 'pending') as string])
        );

        uniqueNotifications.forEach(n => {
          if (n.paymentId) {
            n.paymentStatus = paymentStatusMap.get(n.paymentId) || 'unknown';
          }
        });
      }

      setNotifications(uniqueNotifications);

      // Count unread
      const unread = uniqueNotifications.filter(n => !n.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error("Error in fetchNotifications:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    // Set up real-time subscription
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: user.role === 'admin'
          ? undefined // Admin gets all relevant notifications
          : `user_id=eq.${user.id}` // Members get only their notifications
      }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: user.role === 'admin'
          ? undefined
          : `user_id=eq.${user.id}`
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await markAllNotificationsAsRead(user?.id || null);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, [user]);

  return {
    notifications,
    loading,
    unreadCount,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}

