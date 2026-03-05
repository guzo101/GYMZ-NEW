import { useEffect, useState, useRef, useMemo } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Bell, DollarSign, CheckCircle, AlertCircle, X, ArrowRight, Clock, CheckCircle2, XCircle, Wallet, Smartphone, Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { DataMapper } from "@/utils/dataMapper";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = user?.name
    ? user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : "U";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  // Notifications state (for admin only)
  const [notifications, setNotifications] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const bellRef = useRef(null);
  const bellIconRef = useRef<SVGSVGElement>(null);
  const { toast } = useToast();

  const currency = new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // Fetch real notifications and subscribe (for admins only)
  useEffect(() => {
    if (!user || user.role !== "admin") {
      setNotifications([]);
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        // Fetch admin-only notifications: payments, admin updates, or notifications without user_id (system notifications)
        // Include payment_pending, payment_approved, and payment_rejected types
        // Try to filter by is_read if column exists, otherwise get all
        let queryBuilder = supabase
          .from("notifications")
          .select("*,users(name)")
          .or("type.eq.payment,type.eq.payment_pending,type.eq.payment_approved,type.eq.payment_rejected,type.eq.admin_update,type.is.null,user_id.is.null");

        // Remove duplicate notifications - if there are multiple notifications for the same payment_id,
        // keep only the most recent one

        // Try to filter by is_read if column exists
        try {
          const { data: testData, error: testError } = await supabase
            .from("notifications")
            .select("is_read")
            .limit(1);

          // If is_read column exists and no error, filter by it
          if (!testError && testData !== null) {
            queryBuilder = queryBuilder.eq("is_read", false);
          }
        } catch (err) {
          // Column doesn't exist, continue without filter
          console.log("is_read column not found, showing all notifications");
        }

        const { data, error } = await queryBuilder
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("Error fetching notifications:", error);
          if (isMounted) {
            setNotifications([]);
          }
          return;
        }

        // Remove duplicate notifications for the same paymentId - keep only the most recent one
        const notificationMap = new Map();
        const mappedData = DataMapper.fromDb(data || []) as any[];

        mappedData.forEach(n => {
          if (n.paymentId) {
            const existing = notificationMap.get(n.paymentId);
            if (!existing || new Date(n.createdAt) > new Date(existing.createdAt)) {
              notificationMap.set(n.paymentId, n);
            }
          } else {
            // For non-payment notifications, keep all
            notificationMap.set(n.id, n);
          }
        });

        const uniqueNotifications = Array.from(notificationMap.values());

        console.log("Fetched notifications:", uniqueNotifications.length, "notifications (after deduplication)");
        console.log("Payment notifications:", uniqueNotifications.filter(n => n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected').length || 0);

        if (!isMounted) return;

        // Fetch payment statuses for all payment notifications (including payment_pending, payment_approved, and payment_rejected)
        const paymentNotifications = uniqueNotifications.filter(n => (n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected') && (n.userId || n.paymentId));
        if (paymentNotifications.length > 0) {
          const paymentIds = paymentNotifications
            .map(n => n.paymentId)
            .filter(id => id);

          if (paymentIds.length > 0) {
            const { data: rawPayments } = await supabase
              .from("payments")
              .select("id, status, payment_status")
              .in("id", paymentIds);

            const payments = DataMapper.fromDb(rawPayments || []) as any[];

            const paymentStatusMap = new Map(
              payments.map(p => [p.id, p.status || p.paymentStatus])
            );

            // Add paymentStatus to notifications
            uniqueNotifications.forEach(n => {
              if ((n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected') && n.paymentId) {
                n.paymentStatus = paymentStatusMap.get(n.paymentId) || 'unknown';
              }
            });
          }
        }

        // Filter out notifications for processed payments - only show truly pending payments
        const filteredNotifications = uniqueNotifications.filter(n => {
          // If it's a payment notification, check the actual payment status
          if (n.paymentId && n.paymentStatus) {
            const status = (n.paymentStatus || '').toLowerCase();
            // For payment notifications, only show if payment is still pending
            if (n.type === 'payment' || n.type === 'payment_pending') {
              // Only show if payment is actually pending
              return status === 'pending' || status === 'pending_approval';
            }
            // Don't show approved/rejected/completed payment notifications - they're already processed
            if (status === 'failed' || status === 'rejected' || status === 'completed' || status === 'approved') {
              return false; // Remove all notifications for processed payments
            }
          }
          // For non-payment notifications, show them
          return true;
        });

        // Also check for pending payments that might not have notifications and create them
        // Only get payments that are actually pending (not rejected/failed)
        const { data: pendingPayments } = await supabase
          .from("payments")
          .select("id, status, user_id, amount, paid_at, created_at, users(name)")
          .or("status.eq.pending_approval,status.eq.pending")
          .order("created_at", { ascending: false })
          .limit(30);

        if (pendingPayments && pendingPayments.length > 0) {
          // Get payment IDs that already have notifications (only from filtered notifications)
          const notifiedPaymentIds = new Set(
            filteredNotifications
              .filter(n => (n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected') && n.paymentId)
              .map(n => n.paymentId)
          );

          // Create notifications for pending payments that don't have notifications
          // Only create for payments that are actually pending (not rejected/failed)
          const paymentsNeedingNotifications = pendingPayments.filter(p => {
            const status = (p.status || '').toLowerCase();
            return !notifiedPaymentIds.has(p.id) &&
              (status === 'pending' || status === 'pending_approval');
          });

          if (paymentsNeedingNotifications.length > 0) {
            console.log(`Creating ${paymentsNeedingNotifications.length} notifications for pending payments`);

            const paymentsNeedingNotificationsMapped = DataMapper.fromDb(paymentsNeedingNotifications) as any;

            // Create notifications in batch
            const notificationsToCreate = paymentsNeedingNotificationsMapped.map((payment: any) => DataMapper.toDb({
              message: `Payment of ${currency.format(payment.amount || 0)} from ${payment.users?.name || 'Member'} - Awaiting approval`,
              userId: payment.userId,
              type: "payment",
              paymentId: payment.id,
              platformOrigin: 'website'
            }));

            // Insert notifications
            const { data: createdNotifications, error: createError } = await supabase
              .from("notifications")
              .insert(notificationsToCreate)
              .select("*,users(name)");

            if (createError) {
              console.error("Error creating notifications:", createError);
            }

            if (createdNotifications) {
              const mappedCreatedNotifications = DataMapper.fromDb(createdNotifications) as any[];
              console.log(`Created ${mappedCreatedNotifications.length} new notifications`);
              // Add paymentStatus to created notifications
              mappedCreatedNotifications.forEach(n => {
                const payment = paymentsNeedingNotificationsMapped.find((p: any) => p.id === n.paymentId);
                if (payment) {
                  n.paymentStatus = payment.status;
                }
              });

              // Combine with existing filtered notifications and deduplicate
              const allNotifications = [...filteredNotifications, ...mappedCreatedNotifications];

              // Remove duplicates again after adding new ones
              const finalNotificationMap = new Map();
              allNotifications.forEach(n => {
                if (n.paymentId) {
                  const existing = finalNotificationMap.get(n.paymentId);
                  if (!existing || new Date(n.createdAt) > new Date(existing.createdAt)) {
                    finalNotificationMap.set(n.paymentId, n);
                  }
                } else {
                  finalNotificationMap.set(n.id, n);
                }
              });

              let finalNotifications = Array.from(finalNotificationMap.values());

              // Filter out processed payments - only show pending payments
              finalNotifications = finalNotifications.filter(n => {
                if (n.paymentId && n.paymentStatus) {
                  const status = (n.paymentStatus || '').toLowerCase();
                  // For payment/payment_pending notifications, only show if still pending
                  if (n.type === 'payment' || n.type === 'payment_pending') {
                    return status === 'pending' || status === 'pending_approval';
                  }
                  // Remove all notifications for processed payments (approved/rejected/completed)
                  if (status === 'failed' || status === 'rejected' || status === 'completed' || status === 'approved') {
                    return false;
                  }
                }
                return true;
              });

              // Sort by createdAt descending
              finalNotifications.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );

              console.log(`Total notifications to display: ${finalNotifications.length}`);
              setNotifications(finalNotifications.slice(0, 50));
              return;
            }
          }
        }

        // If no new notifications needed, just set existing filtered ones
        setNotifications(filteredNotifications);
      } catch (err) {
        console.error("Error in notification fetch:", err);
        if (isMounted) {
          setNotifications([]);
        }
      }
    })();
    const channel = supabase
      .channel('public:notifications-bell-admin')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      }, async (payload) => {
        const n: any = DataMapper.fromDb(payload.new);
        // Only add admin-relevant notifications (payments, admin updates, or system notifications without userId)
        if (n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected' || n.type === 'admin_update' || !n.userId) {
          // Fetch payment status and user info if it's a payment notification
          if ((n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected') && n.paymentId) {
            const { data: rawPayment } = await supabase
              .from("payments")
              .select("status, payment_status")
              .eq("id", n.paymentId)
              .single();
            if (rawPayment) {
              const payment = DataMapper.fromDb(rawPayment);
              n.paymentStatus = payment.status || payment.paymentStatus;

              // Don't add notifications for processed payments (approved/rejected/completed)
              const status = (n.paymentStatus || '').toLowerCase();
              if ((n.type === 'payment' || n.type === 'payment_pending') &&
                (status === 'failed' || status === 'rejected' || status === 'completed' || status === 'approved')) {
                console.log("Skipping notification for processed payment:", n.paymentId, status);
                return; // Don't add this notification
              }
              // Also skip approved/rejected notification types - they're already processed
              if (n.type === 'payment_approved' || n.type === 'payment_rejected') {
                console.log("Skipping processed payment notification:", n.paymentId, n.type);
                return; // Don't add processed payment notifications
              }
            }
          }
          // Fetch user info if userId exists
          if (n.userId) {
            const { data: userData } = await supabase
              .from("users")
              .select("name")
              .eq("id", n.userId)
              .single();
            if (userData) {
              n.users = userData;
            }
          }
          setNotifications(cur => [n, ...cur.filter(item => item.id !== n.id).slice(0, 19)]);
          // Animate bell for new notifications with enhanced feedback
          if (bellIconRef.current) {
            bellIconRef.current.classList.add('animate-pulse', 'scale-110');
            // Play notification sound if available
            try {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77+efTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBlou+/nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC');
              audio.volume = 0.3;
              audio.play().catch(() => { }); // Ignore errors if audio fails
            } catch (e) {
              // Ignore audio errors
            }
            setTimeout(() => {
              if (bellIconRef.current) {
                bellIconRef.current.classList.remove('animate-pulse', 'scale-110');
              }
            }, 3000);
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        // Update notification if it was modified
        const newNotif = DataMapper.fromDb(payload.new);
        setNotifications(cur => cur.map(n => n.id === newNotif.id ? newNotif : n));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payments'
      }, async (payload) => {
        // When payment status changes, remove all notifications for that payment
        // Approved/rejected payments shouldn't show in notifications
        const updatedPayment = DataMapper.fromDb(payload.new);
        const status = (updatedPayment.status || '').toLowerCase();

        // Mark related notifications as read and remove from list
        setNotifications(cur => {
          const notificationsToRemove = cur.filter(n =>
            n.paymentId === updatedPayment.id &&
            (n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected')
          );

          // Mark notifications as read in database
          if (notificationsToRemove.length > 0) {
            const notificationIds = notificationsToRemove.map(n => n.id);
            // Try to mark as read if column exists
            supabase
              .from("notifications")
              .update({ is_read: true })
              .in("id", notificationIds)
              .then(({ error }) => {
                if (error) {
                  console.log("Could not mark notifications as read (column may not exist):", error);
                }
              });
          }

          // Remove all notifications for this payment - processed payments shouldn't show
          return cur.filter(n => {
            if (n.paymentId === updatedPayment.id &&
              (n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected')) {
              return false; // Remove it - payment is processed
            }
            return true;
          });
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'payments'
      }, async (payload) => {
        // When a new payment is created, create a notification if it needs approval
        const newPayment = DataMapper.fromDb(payload.new);

        // Check both status and paymentStatus fields
        const paymentStatus = (newPayment.status || newPayment.paymentStatus || '').toLowerCase();

        // Only create notification for pending payments (pending_approval or pending status)
        if (paymentStatus !== 'pending_approval' && paymentStatus !== 'pending') {
          return;
        }

        // Check if notification already exists
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("payment_id", newPayment.id)
          .eq("type", "payment")
          .single();

        if (!existingNotif && newPayment.userId) {
          // Fetch user info
          const { data: userData } = await supabase
            .from("users")
            .select("name")
            .eq("id", newPayment.userId)
            .single();

          const notificationMessage = `Payment of ${currency.format(newPayment.amount || 0)} from ${userData?.name || 'Member'} - Awaiting approval`;

          // Create notification
          const { data: rawNewNotif } = await supabase
            .from("notifications")
            .insert(DataMapper.toDb({
              message: notificationMessage,
              userId: newPayment.userId,
              type: "payment",
              paymentId: newPayment.id,
            }))
            .select("*,users(name)")
            .single();

          if (rawNewNotif) {
            const newNotif: any = DataMapper.fromDb(rawNewNotif);
            newNotif.paymentStatus = newPayment.status || newPayment.paymentStatus;
            setNotifications(cur => [newNotif, ...cur.filter(item => item.id !== newNotif.id).slice(0, 49)]);
            // Animate bell for new notifications with enhanced feedback
            if (bellIconRef.current) {
              bellIconRef.current.classList.add('animate-pulse', 'scale-110');
              // Play notification sound if available
              try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77+efTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBlou+/nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC');
                audio.volume = 0.3;
                audio.play().catch(() => { }); // Ignore errors if audio fails
              } catch (e) {
                // Ignore audio errors
              }
              setTimeout(() => {
                if (bellIconRef.current) {
                  bellIconRef.current.classList.remove('animate-pulse', 'scale-110');
                }
              }, 3000);
            }
          }
        }
      })
      .subscribe();
    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [user?.role]);

  // Click outside handler to close popover
  useEffect(() => {
    function handleDocClick(event) {
      if (!bellRef.current) return;
      if (bellOpen && !bellRef.current.contains(event.target)) setBellOpen(false);
    }
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [bellOpen]);

  // Mark notifications as read when bell is opened
  useEffect(() => {
    if (bellOpen && notifications.length > 0) {
      const unreadIds = notifications
        .filter(n => !readNotifications.has(n.id))
        .map(n => n.id);
      if (unreadIds.length > 0) {
        setReadNotifications(prev => {
          const newSet = new Set(prev);
          unreadIds.forEach(id => newSet.add(id));
          return newSet;
        });
      }
    }
  }, [bellOpen, notifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !readNotifications.has(n.id)).length;
  }, [notifications, readNotifications]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return <DollarSign className="h-4 w-4 text-green-600" />;
      case 'admin_update':
        return <AlertCircle className="h-4 w-4 text-primary" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'payment':
        return 'bg-green-50 border-l-primary dark:bg-green-950/20';
      case 'admin_update':
        return 'bg-primary border-l-primary dark:bg-primary/20';
      default:
        return 'bg-gray-50 border-l-gray-500 dark:bg-gray-950/20';
    }
  };

  const handleNotificationClick = async (notification: any) => {
    // Mark as read
    if (!readNotifications.has(notification.id)) {
      setReadNotifications(prev => new Set(prev).add(notification.id));
    }

    // Handle payment notifications - fetch payment details
    if (notification.type === 'payment' && notification.userId) {
      setLoadingPayment(true);
      setPaymentDialogOpen(true); // Open dialog immediately
      setBellOpen(false); // Close notification dropdown when opening payment dialog
      setSelectedTrainer(null); // Reset trainer state

      console.log("Fetching payment for notification:", notification);

      try {
        let paymentData = null;
        let fetchError = null;

        // First, try to fetch by paymentId if it exists in notification
        if (notification.paymentId) {
          console.log("Attempting to fetch payment by paymentId:", notification.paymentId);
          try {
            const { data, error } = await supabase
              .from("payments")
              .select("*, users(name, email)")
              .eq("id", notification.paymentId)
              .single();

            if (!error && data) {
              console.log("Payment found by paymentId:", data);
              paymentData = DataMapper.fromDb(data);
            } else if (error) {
              console.warn("Error fetching by paymentId:", error);
              fetchError = error;
            }
          } catch (err) {
            console.warn("Exception fetching by paymentId:", err);
          }
        }

        // If paymentId not found or doesn't exist, fetch most recent payment (pending_approval or failed/rejected)
        if (!paymentData) {
          console.log("Fetching payment by userId and status:", notification.userId);
          try {
            // Try with paid_at first (more likely to exist in the database)
            // Include both pending_approval and failed statuses to handle rejected payments
            let { data, error } = await supabase
              .from("payments")
              .select("*, users(name, email)")
              .eq("user_id", notification.userId)
              .in("status", ["pending_approval", "failed"])
              .order("paid_at", { ascending: false })
              .limit(1);

            console.log("Query result (paid_at):", { data, error });

            // If that fails or returns no data, try with created_at
            if (error || !data || data.length === 0) {
              console.log("Trying with created_at instead...");
              const { data: data2, error: error2 } = await supabase
                .from("payments")
                .select("*, users(name, email)")
                .eq("user_id", notification.userId)
                .in("status", ["pending_approval", "failed"])
                .order("created_at", { ascending: false })
                .limit(1);

              console.log("Query result (created_at):", { data: data2, error: error2 });

              if (!error2 && data2 && data2.length > 0) {
                paymentData = DataMapper.fromDb(data2[0]);
              } else if (error2) {
                console.error("Error fetching payment by created_at:", error2);
                // Keep the first error if it's more informative
                if (!fetchError) fetchError = error2;
              }
            } else if (data && data.length > 0) {
              paymentData = DataMapper.fromDb(data[0]);
            } else if (error) {
              console.error("Error fetching payment by paid_at:", error);
              fetchError = error;
            }
          } catch (err: any) {
            console.error("Exception fetching payment:", err);
            fetchError = err;
          }
        }

        if (paymentData) {
          console.log("Setting selected payment:", paymentData);

          // Check if payment is already approved and fetch admin info (if approvedBy column exists)
          if (paymentData.status === "completed" && paymentData.approvedBy) {
            try {
              const { data: adminData } = await supabase
                .from("users")
                .select("name, email")
                .eq("id", paymentData.approvedBy)
                .single();

              if (adminData) {
                paymentData.approvedByUser = adminData;
              }
            } catch (err) {
              console.warn("Error fetching admin info:", err);
            }
          }

          setSelectedPayment(paymentData);

          // Always fetch trainer info separately if trainerId exists
          if (paymentData.trainerId) {
            console.log("Fetching trainer info separately for trainerId:", paymentData.trainerId);
            // Fetch trainer asynchronously - don't block dialog opening
            (async () => {
              try {
                const { data: trainerData, error: trainerError } = await supabase
                  .from("staff")
                  .select("id, name, role, avatar, department, rating")
                  .eq("id", paymentData.trainerId)
                  .single();

                if (!trainerError && trainerData) {
                  console.log("Trainer data fetched:", trainerData);
                  setSelectedTrainer(trainerData);
                } else if (trainerError) {
                  console.warn("Error fetching trainer:", trainerError);
                  // Set a placeholder so we know trainerId exists but fetch failed
                  setSelectedTrainer({
                    id: paymentData.trainerId,
                    name: "Unknown Trainer",
                    error: true
                  });
                }
              } catch (err) {
                console.warn("Exception fetching trainer:", err);
                // Set placeholder on error
                setSelectedTrainer({
                  id: paymentData.trainerId,
                  name: "Error loading trainer",
                  error: true
                });
              }
            })();
          }
        } else {
          // If no pending payment found, the payment might have been processed
          console.warn("No payment data found. Error:", fetchError);
          setPaymentDialogOpen(false);
          const errorMsg = fetchError?.message || "Payment may have already been processed";
          toast({
            title: "Payment Not Found",
            description: errorMsg,
            variant: "destructive",
          });
          setTimeout(() => {
            navigate('/finances');
          }, 2000);
        }
      } catch (err: any) {
        console.error("Error fetching payment:", err);
        // Keep dialog open to show error state, but set payment to null
        setSelectedPayment(null);
        toast({
          title: "Error",
          description: err.message || "Failed to load payment details. Please try again or check the finances page.",
          variant: "destructive",
        });
      } finally {
        setLoadingPayment(false);
      }
    } else if (notification.type === 'admin_update') {
      navigate('/');
      setBellOpen(false);
    } else if (notification.type === 'payment') {
      // Payment notification without user_id or already processed
      navigate('/finances');
      setBellOpen(false);
    }
  };

  const handleApprovePayment = async () => {
    if (!selectedPayment || !selectedPayment.userId) {
      toast({
        title: "Error",
        description: "Payment or user information not found",
        variant: "destructive",
      });
      return;
    }

    // Check if already approved
    if (selectedPayment.status === "completed" && selectedPayment.approvedBy) {
      const approverName = selectedPayment.approvedByUser?.name || "an admin";
      toast({
        title: "Already Approved",
        description: `This payment was already approved by ${approverName}${selectedPayment.approvedAt ? ` on ${format(new Date(selectedPayment.approvedAt), "MMM dd, yyyy 'at' h:mm a")}` : ''}.`,
        variant: "default",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Error",
        description: "Admin information not found",
        variant: "destructive",
      });
      return;
    }

    setProcessingPayment(true);
    try {
      // Get payment details including months
      const months = selectedPayment.months || 1;
      const paidDate = selectedPayment.paidAt ? new Date(selectedPayment.paidAt) : new Date();
      const renewalDueDate = new Date(paidDate);
      renewalDueDate.setMonth(renewalDueDate.getMonth() + months);
      const renewalDueDateStr = renewalDueDate.toISOString().split('T')[0];

      // Update payment status to completed and track who approved it
      // Try to include approved_by and approved_at, but handle if columns don't exist
      let updateError = null;

      // First, try to update with approved_by and approved_at
      const { error: error1 } = await supabase
        .from("payments")
        .update({
          status: "completed",
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq("id", selectedPayment.id);

      if (error1) {
        const errorMessage = error1.message || String(error1);
        // If error is about missing columns, try without them
        if (errorMessage.includes("approved_by") || errorMessage.includes("approved_at") || errorMessage.includes("column") || errorMessage.includes("schema cache")) {
          console.warn("approved_by/approved_at columns don't exist, updating without them");
          const { error: error2 } = await supabase
            .from("payments")
            .update({ status: "completed" })
            .eq("id", selectedPayment.id);

          if (error2) {
            updateError = error2;
          }
        } else {
          updateError = error1;
        }
      }

      if (updateError) throw updateError;

      // Update user profile
      const { error: userUpdateError } = await supabase
        .from("users")
        .update(DataMapper.toDb({
          membershipStatus: "Active",
          renewalDueDate: renewalDueDateStr,
          lastPaymentDate: paidDate.toISOString().split('T')[0],
          subscriptionDurationMonths: months
        }))
        .eq("id", selectedPayment.userId);

      if (userUpdateError) {
        console.warn("User update error:", userUpdateError);
      }

      // Create notification
      try {
        await supabase.from("notifications").insert(DataMapper.toDb({
          message: `Payment approved for ${selectedPayment.users?.name || "Member"}. Membership renewed for ${months} month${months !== 1 ? 's' : ''}.`,
          userId: selectedPayment.userId,
          type: "payment",
          platformOrigin: 'website'
        }));
      } catch (notifyErr) {
        console.warn("Notification insert failed", notifyErr);
      }

      toast({
        title: "Payment Approved",
        description: `Payment approved. Membership renewed for ${months} month${months !== 1 ? 's' : ''}.`,
      });

      // Mark all notifications for this payment as read and remove from list
      setNotifications(cur => {
        const notificationsToRemove = cur.filter(n =>
          n.paymentId === selectedPayment.id &&
          (n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected')
        );

        // Mark as read in database
        if (notificationsToRemove.length > 0) {
          const notificationIds = notificationsToRemove.map(n => n.id);
          supabase
            .from("notifications")
            .update({ is_read: true })
            .in("id", notificationIds)
            .then(({ error }) => {
              if (error) {
                console.log("Could not mark notifications as read:", error);
              }
            });
        }

        // Remove all notifications for this payment
        return cur.filter(n => n.paymentId !== selectedPayment.id ||
          (n.type !== 'payment' && n.type !== 'payment_pending' && n.type !== 'payment_approved' && n.type !== 'payment_rejected'));
      });

      setPaymentDialogOpen(false);
      setSelectedPayment(null);
      setSelectedTrainer(null);
    } catch (err: any) {
      console.error("Error approving payment:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to approve payment",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedPayment || !selectedPayment.user_id) {
      toast({
        title: "Error",
        description: "Payment or user information not found",
        variant: "destructive",
      });
      return;
    }

    setProcessingPayment(true);
    try {
      // Update payment status to failed
      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("id", selectedPayment.id);

      if (updateError) throw updateError;

      // Create notification
      try {
        await supabase.from("notifications").insert(DataMapper.toDb({
          message: `Payment rejected for ${selectedPayment.users?.name || "Member"}`,
          userId: selectedPayment.userId,
          type: "payment",
          platformOrigin: 'website'
        }));
      } catch (notifyErr) {
        console.warn("Notification insert failed", notifyErr);
      }

      toast({
        title: "Payment Rejected",
        description: "Payment has been rejected.",
      });

      // Mark all notifications for this payment as read and remove from list
      setNotifications(cur => {
        const notificationsToRemove = cur.filter(n =>
          n.paymentId === selectedPayment.id &&
          (n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected')
        );

        // Mark as read in database
        if (notificationsToRemove.length > 0) {
          const notificationIds = notificationsToRemove.map(n => n.id);
          supabase
            .from("notifications")
            .update({ is_read: true })
            .in("id", notificationIds)
            .then(({ error }) => {
              if (error) {
                console.log("Could not mark notifications as read:", error);
              }
            });
        }

        // Remove all notifications for this payment
        return cur.filter(n => n.paymentId !== selectedPayment.id ||
          (n.type !== 'payment' && n.type !== 'payment_pending' && n.type !== 'payment_approved' && n.type !== 'payment_rejected'));
      });

      setPaymentDialogOpen(false);
      setSelectedPayment(null);
      setSelectedTrainer(null);
    } catch (err: any) {
      console.error("Error rejecting payment:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to reject payment",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b border-border/50 bg-card/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40 shadow-modern">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-muted/50 transition-colors" />
              <div className="hidden md:flex relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
                <Input
                  placeholder="Search..."
                  className="pl-11 w-80 bg-background/50 border-border/50 focus:bg-background transition-all"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              {user?.role === "admin" && (
                <div className="relative" ref={bellRef}>
                  <button
                    type="button"
                    onClick={() => setBellOpen((open) => !open)}
                    className="relative p-2.5 rounded-xl hover:bg-muted/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:scale-105 active:scale-95"
                    aria-label="Show notifications"
                  >
                    <Bell
                      ref={bellIconRef}
                      className={`h-5 w-5 transition-all duration-200 ${bellOpen ? "text-primary" : "text-muted-foreground"} ${unreadCount > 0 ? "text-amber-500" : ""}`}
                    />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-bold bg-gradient-to-r from-red-500 to-red-600 text-white shadow-modern-md animate-pulse border-2 border-background">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Badge>
                    )}
                  </button>
                  {/* Dropdown popover - Responsive */}
                  {bellOpen && (
                    <div className="absolute right-0 mt-2 w-[90vw] sm:w-96 max-w-md bg-card border-2 border-border/50 rounded-xl shadow-modern-xl z-[100] animate-in fade-in slide-in-from-top-2 max-h-[80vh] overflow-hidden flex flex-col backdrop-blur-md">
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-muted/30 to-muted/10 flex items-center justify-between sticky top-0 z-10">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold">Notifications</div>
                          {unreadCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {unreadCount} new
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setBellOpen(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Notifications List */}
                      <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                          <div className="text-sm px-4 py-8 text-muted-foreground text-center">
                            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No notifications yet.</p>
                          </div>
                        ) : (
                          <div className="divide-y">
                            {notifications.map((n) => {
                              const isUnread = !readNotifications.has(n.id);
                              // For payment notifications, only highlight if payment is pending (not approved, completed, or failed)
                              const isPaymentPending = (n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected') &&
                                n.payment_status &&
                                n.payment_status !== 'approved' &&
                                n.payment_status !== 'completed' &&
                                n.payment_status !== 'failed';
                              const shouldHighlight = isUnread && ((n.type !== 'payment' && n.type !== 'payment_pending' && n.type !== 'payment_approved' && n.type !== 'payment_rejected') || isPaymentPending);
                              return (
                                <div
                                  key={n.id}
                                  onClick={() => handleNotificationClick(n)}
                                  className={`px-4 py-3 border-l-4 ${getNotificationColor(n.type)} hover:bg-muted/50 transition-all cursor-pointer ${shouldHighlight ? 'bg-opacity-100' : 'bg-opacity-50'
                                    }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex-shrink-0">
                                      {getNotificationIcon(n.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={`text-sm ${shouldHighlight ? 'font-semibold' : 'font-medium'}`}>
                                        {n.users?.name && (
                                          <span className="text-primary font-semibold">{n.users.name}</span>
                                        )}
                                        <span className={n.users?.name ? ' ml-1' : ''}>{n.message}</span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                        </div>
                                        {(n.type === 'payment' || n.type === 'payment_pending' || n.type === 'payment_approved' || n.type === 'payment_rejected') && (
                                          <Badge
                                            variant="outline"
                                            className={`text-xs ${n.payment_status === 'approved' || n.payment_status === 'completed' || n.type === 'payment_approved'
                                              ? 'bg-primary text-primary border-primary'
                                              : n.payment_status === 'failed' || n.type === 'payment_rejected'
                                                ? 'bg-red-50 text-red-700 border-red-300'
                                                : 'bg-yellow-50 text-yellow-700 border-yellow-300'
                                              }`}
                                          >
                                            {n.payment_status === 'approved' || n.type === 'payment_approved'
                                              ? 'Approved'
                                              : n.payment_status === 'completed'
                                                ? 'Processed'
                                                : n.payment_status === 'failed' || n.type === 'payment_rejected'
                                                  ? 'Rejected'
                                                  : 'Pending'}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {shouldHighlight && (
                                        <div className="h-2 w-2 rounded-full bg-primary"></div>
                                      )}
                                      {n.type === 'payment' && isPaymentPending && (
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      {notifications.length > 0 && (
                        <div className="px-4 py-2 border-t bg-muted/30">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                              navigate('/finances');
                              setBellOpen(false);
                            }}
                          >
                            View All Payments
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-foreground">{user?.name}</div>
                  <div className="text-xs text-muted-foreground capitalize font-medium">{user?.role}</div>
                </div>
                <Avatar className="h-9 w-9 ring-2 ring-primary/20 hover:ring-primary/40 transition-all cursor-pointer hover:scale-105">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))] text-primary-foreground text-xs font-semibold shadow-modern">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <Button variant="outline" size="sm" onClick={handleLogout} className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors">
                  Logout
                </Button>
              </div>
            </div>
          </header>
          {/* Main Content */}
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Payment Approval Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          {loadingPayment ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading payment details...</p>
            </div>
          ) : selectedPayment ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-orange-500" />
                  {selectedPayment.status === "completed"
                    ? "Payment Already Approved"
                    : selectedPayment.status === "failed"
                      ? "Payment Rejected"
                      : "Payment Approval Required"}
                </DialogTitle>
                <DialogDescription>
                  {selectedPayment.status === "completed"
                    ? "This payment has already been processed and approved."
                    : selectedPayment.status === "failed"
                      ? "This payment has been rejected."
                      : "Review the payment details and approve or reject"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Member Info */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Member</span>
                  </div>
                  <p className="font-semibold">{selectedPayment.users?.name || "Unknown"}</p>
                  {selectedPayment.users?.email && (
                    <p className="text-xs text-muted-foreground">{selectedPayment.users.email}</p>
                  )}
                </div>

                {/* Payment Details */}
                <div className="space-y-3">
                  {(() => {
                    const tipAmount = Number(selectedPayment.tip_amount) || 0;
                    const totalAmount = Number(selectedPayment.amount) || 0;
                    const baseAmount = totalAmount - tipAmount;

                    return (
                      <>
                        <div className="flex justify-between items-center p-3 border rounded-lg">
                          <span className="text-sm text-muted-foreground">Base Payment</span>
                          <span className="text-lg font-bold">{currency.format(baseAmount)}</span>
                        </div>

                        {tipAmount > 0 && (
                          <>
                            <div className="flex justify-between items-center p-3 border-2 border-primary rounded-lg bg-green-50 dark:bg-green-950/20">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-green-700 dark:text-green-400">💵 Tip Amount</span>
                              </div>
                              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                {currency.format(tipAmount)}
                              </span>
                            </div>

                            {selectedPayment.trainer_id && (
                              <div className="flex justify-between items-center p-3 border-2 border-primary rounded-lg bg-primary dark:bg-primary/20">
                                <span className="text-sm font-semibold text-primary dark:text-primary">👤 Trainer Tipped</span>
                                <div className="flex items-center gap-2">
                                  {selectedTrainer ? (
                                    selectedTrainer.error ? (
                                      <span className="text-sm text-muted-foreground italic">
                                        {selectedTrainer.name}
                                      </span>
                                    ) : (
                                      <>
                                        {selectedTrainer.avatar && (
                                          <img
                                            src={selectedTrainer.avatar}
                                            alt={selectedTrainer.name}
                                            className="h-8 w-8 rounded-full object-cover border-2 border-primary"
                                          />
                                        )}
                                        <div className="flex flex-col items-end">
                                          <span className="text-sm font-bold text-primary dark:text-primary">
                                            {selectedTrainer.name}
                                          </span>
                                          {selectedTrainer.role && (
                                            <span className="text-xs text-muted-foreground">
                                              {selectedTrainer.role}
                                              {selectedTrainer.department && ` • ${selectedTrainer.department}`}
                                            </span>
                                          )}
                                          {selectedTrainer.rating && (
                                            <span className="text-xs text-yellow-600">
                                              ⭐ {selectedTrainer.rating}
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    )
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                      <span className="text-sm text-muted-foreground">Loading trainer info...</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="flex justify-between items-center p-3 border-2 border-primary rounded-lg bg-primary/5">
                              <span className="text-sm font-semibold">Total Amount</span>
                              <span className="text-lg font-bold text-primary">
                                {currency.format(totalAmount)}
                              </span>
                            </div>
                          </>
                        )}

                        {tipAmount === 0 && (
                          <div className="flex justify-between items-center p-3 border-2 border-primary rounded-lg bg-primary/5">
                            <span className="text-sm font-semibold">Total Amount</span>
                            <span className="text-lg font-bold text-primary">
                              {currency.format(totalAmount)}
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span className="text-sm text-muted-foreground">Description</span>
                    <span className="text-sm font-medium">{selectedPayment.description || "N/A"}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span className="text-sm text-muted-foreground">Payment Method</span>
                    <div className="flex items-center gap-2">
                      {selectedPayment.method === "Cash" && <Wallet className="h-4 w-4" />}
                      {(selectedPayment.method?.includes("Mobile") || selectedPayment.method?.includes("Money")) && <Smartphone className="h-4 w-4" />}
                      {selectedPayment.method === "Bank Transfer" && <Building2 className="h-4 w-4" />}
                      <span className="text-sm font-medium">{selectedPayment.method || "N/A"}</span>
                    </div>
                  </div>

                  {selectedPayment.months && (
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm text-muted-foreground">Duration</span>
                      <span className="text-sm font-medium">{selectedPayment.months} {selectedPayment.months === 1 ? 'month' : 'months'}</span>
                    </div>
                  )}

                  {selectedPayment.status === "completed" && selectedPayment.approved_by && (
                    <div className="flex justify-between items-center p-3 border-2 border-primary rounded-lg bg-green-50 dark:bg-green-950/20">
                      <span className="text-sm font-semibold text-green-700 dark:text-green-400">✅ Approval Status</span>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">
                          Approved by {selectedPayment.approved_by_user?.name || "Admin"}
                        </span>
                        {selectedPayment.approved_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(selectedPayment.approved_at), "MMM dd, yyyy 'at' h:mm a")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedPayment.status === "failed" && (
                    <div className="flex justify-between items-center p-3 border-2 border-red-500 rounded-lg bg-red-50 dark:bg-red-950/20">
                      <span className="text-sm font-semibold text-red-700 dark:text-red-400">❌ Payment Status</span>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-red-600 dark:text-red-400">
                          Payment Rejected
                        </span>
                        <span className="text-xs text-muted-foreground">
                          This payment has been rejected
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span className="text-sm text-muted-foreground">Date</span>
                    <span className="text-sm font-medium">
                      {format(new Date(selectedPayment.created_at || selectedPayment.paid_at), "MMM dd, yyyy 'at' h:mm a")}
                    </span>
                  </div>

                  {selectedPayment.transaction_reference && (
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm text-muted-foreground">Reference</span>
                      <span className="text-sm font-mono">{selectedPayment.transaction_reference}</span>
                    </div>
                  )}

                  {selectedPayment.mobile_number && (
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm text-muted-foreground">Mobile Number</span>
                      <span className="text-sm font-medium">{selectedPayment.mobile_number}</span>
                    </div>
                  )}

                  {selectedPayment.bank_name && (
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm text-muted-foreground">Bank</span>
                      <span className="text-sm font-medium">{selectedPayment.bank_name}</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPaymentDialogOpen(false);
                    setSelectedPayment(null);
                    setSelectedTrainer(null);
                  }}
                  disabled={processingPayment}
                  className="w-full sm:flex-1 order-3 sm:order-1"
                >
                  {selectedPayment.status === "completed" || selectedPayment.status === "failed" ? "Close" : "Cancel"}
                </Button>
                {selectedPayment.status !== "completed" && selectedPayment.status !== "failed" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={handleRejectPayment}
                      disabled={processingPayment}
                      className="w-full sm:flex-1 order-2"
                    >
                      {processingPayment ? (
                        "Processing..."
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleApprovePayment}
                      disabled={processingPayment}
                      className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 order-1 sm:order-3"
                    >
                      {processingPayment ? (
                        "Processing..."
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </>
                      )}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          ) : (
            <div className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Payment not found or already processed</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setPaymentDialogOpen(false);
                  navigate('/finances');
                }}
              >
                Go to Finances
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
