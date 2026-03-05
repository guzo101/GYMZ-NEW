/* @ts-nocheck */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { NOTIFICATION_TYPES, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/notifications";

interface Notification {
  id: string;
  message: string;
  type: string;
  user_id: string | null;
  payment_id: string | null;
  action_url: string | null;
  action_label: string | null;
  created_at: string;
  is_read?: boolean;
  status: string;
  priority: number;
  acknowledged_at?: string;
  platform_origin?: string;
  users?: { name: string } | null;
  payment_status?: string;
  is_backfilled?: boolean;
  metadata?: Record<string, unknown>;
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
      // Use select("*") - the users join can fail for admin notifications (user_id null)
      let query = supabase
        .from("notifications")
        .select("*");

      // Filter based on user role (admin, owner, super_admin see gym-scoped admin notifications)
      const isAdminRole = ["admin", "owner", "super_admin"].includes(user.role || "");
      if (isAdminRole) {
        // Admin notifications: user_id is null (targeted at admins). RLS filters by gym.
        // Simple filter avoids PostgREST .or() parsing issues with complex conditions.
        query = query.is("user_id", null);
      } else {
        // Members see only their own notifications
        query = query.eq("user_id", user.id);
      }

      // Filter by status (exclude acknowledged/read depending on UI preference)
      // For now, let's just fetch everything relevant and sort in memory

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
      (data || []).forEach((n: Notification) => {
        if (n.payment_id) {
          const existing = notificationMap.get(n.payment_id);
          if (!existing || new Date(n.created_at) > new Date(existing.created_at)) {
            notificationMap.set(n.payment_id, n);
          }
        } else {
          notificationMap.set(n.id, n);
        }
      });

      const uniqueNotifications = Array.from(notificationMap.values()) as Notification[];

      // Fetch payment statuses for payment notifications
      const paymentNotifications = uniqueNotifications.filter(
        n => n.payment_id && (
          n.type === NOTIFICATION_TYPES.PAYMENT_PENDING ||
          n.type === NOTIFICATION_TYPES.PAYMENT_APPROVED ||
          n.type === NOTIFICATION_TYPES.PAYMENT_REJECTED ||
          n.type === NOTIFICATION_TYPES.PAYMENT_COMPLETED
        )
      );

      if (paymentNotifications.length > 0) {
        const paymentIds = paymentNotifications.map(n => n.payment_id).filter(Boolean) as string[];

        const { data: payments } = await supabase
          .from("payments")
          .select("id, status, payment_status")
          .in("id", paymentIds);

        const paymentStatusMap = new Map(
          (payments || []).map(p => [p.id, p.status || p.payment_status])
        );

        uniqueNotifications.forEach(n => {
          if (n.payment_id) {
            n.payment_status = (paymentStatusMap.get(n.payment_id) as string) || 'unknown';
          }
        });
      }

      setNotifications(uniqueNotifications);

      // Count unread
      const unread = uniqueNotifications.filter(n => !n.is_read).length;
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
        filter: ["admin", "owner", "super_admin"].includes(user.role || "")
          ? undefined // Admin/owner gets gym-scoped notifications (RLS filters)
          : `user_id=eq.${user.id}` // Members get only their notifications
      }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: ["admin", "owner", "super_admin"].includes(user.role || "")
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
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await markAllNotificationsAsRead(user?.id || null);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
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

