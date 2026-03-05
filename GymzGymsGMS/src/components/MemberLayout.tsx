/* @ts-nocheck */
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MemberSidebar } from "./MemberSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Bell, AlertCircle, Info, CheckCircle, XCircle } from "lucide-react";
import { useMemo, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { WaitingApprovalModal } from "@/components/WaitingApprovalModal";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

export function MemberLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);
  const bellIconRef = useRef(null);
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<"none" | "pending" | "rejected" | null>(null);

  const initials = useMemo(() => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [user?.name]);

  // Check membership status and payment status
  useEffect(() => {
    if (!user?.id || user?.role !== "member") {
      setLoadingStatus(false);
      return;
    }

    let isMounted = true;

    const fetchMembershipStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("membership_status")
          .eq("id", user.id)
          .single();

        if (!error && data && isMounted) {
          setMembershipStatus(data.membership_status || "Pending");
        }
      } catch (err) {
        console.error("Error fetching membership status:", err);
      } finally {
        if (isMounted) {
          setLoadingStatus(false);
        }
      }
    };

    const fetchPaymentStatus = async () => {
      try {
        // Fetch the most recent payment for this user
        const { data, error } = await supabase
          .from("payments")
          .select("status")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (!error && data) {
          console.log("Payment status fetched:", data.status);
          if (data.status === "pending_approval" || data.status === "pending") {
            console.log("Setting payment status to pending");
            setPaymentStatus("pending");
          } else if (data.status === "failed") {
            console.log("Setting payment status to rejected");
            setPaymentStatus("rejected");
          } else if (data.status === "completed") {
            // If payment is completed but membership is still not active, check if there's a newer pending payment
            // For now, if payment is completed, we assume no pending payment
            console.log("Payment completed, setting status to none");
            setPaymentStatus("none");
          } else {
            console.log("Payment status unknown:", data.status, "setting to none");
            setPaymentStatus("none");
          }
        } else if (!error && !data) {
          // No payments found
          console.log("No payments found, setting status to none");
          setPaymentStatus("none");
        } else if (error) {
          console.error("Error fetching payment status:", error);
          setPaymentStatus("none");
        }
      } catch (err) {
        console.error("Error fetching payment status:", err);
        if (isMounted) {
          setPaymentStatus("none");
        }
      }
    };

    fetchMembershipStatus();
    fetchPaymentStatus();

    // Subscribe to real-time updates for membership status
    const membershipChannel = supabase
      .channel(`member-status-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${user.id}`
      }, (payload) => {
        if (payload.new.membership_status && isMounted) {
          setMembershipStatus(payload.new.membership_status);
        }
      })
      .subscribe();

    // Subscribe to real-time updates for payments
    const paymentChannel = supabase
      .channel(`member-payments-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        // Update payment status immediately when payments change
        if (isMounted && payload.new) {
          const status = payload.new.status;
          console.log("Payment status changed via real-time:", status);
          if (status === "pending_approval" || status === "pending") {
            console.log("Setting payment status to pending (real-time)");
            setPaymentStatus("pending");
          } else if (status === "failed") {
            console.log("Setting payment status to rejected (real-time)");
            setPaymentStatus("rejected");
          } else if (status === "completed") {
            // If payment is completed, check if membership is active
            // If not active, there might be another pending payment, so refetch
            console.log("Payment completed, refetching status");
            fetchPaymentStatus();
          } else {
            console.log("Payment status unknown (real-time):", status);
            setPaymentStatus("none");
          }
        } else if (isMounted) {
          // Refetch payment status when payments change
          console.log("Refetching payment status (real-time)");
          fetchPaymentStatus();
        }
      })
      .subscribe();

    // Safety timeout to ensure loading completes
    const timeout = setTimeout(() => {
      if (isMounted) {
        setLoadingStatus(false);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      membershipChannel.unsubscribe();
      paymentChannel.unsubscribe();
    };
  }, [user?.id, user?.role]);

  // No manual fetching needed, useNotifications handles it now

  // Click outside handler to close popover
  useEffect(() => {
    function handleDocClick(event) {
      if (!bellRef.current) return;
      if (bellOpen && !bellRef.current.contains(event.target)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [bellOpen]);

  // Mark notifications as read when bell is opened
  useEffect(() => {
    if (bellOpen && notifications.length > 0) {
      notifications.filter(n => !n.is_read).forEach(n => markAsRead(n.id));
    }
  }, [bellOpen, notifications, markAsRead]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }
  function getNotificationIcon(n) {
    if (n.priority === 1) return <AlertCircle className="h-4 w-4 text-primary animate-pulse" />;

    switch (n.type) {
      case 'renewal_reminder':
        return <AlertCircle className="h-4 w-4 text-primary" />;
      case 'class_scheduled':
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'admin_update':
        return <Info className="h-4 w-4 text-primary" />;
      case 'profile_update':
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'payment':
      case 'payment_approved':
      case 'payment_completed':
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'payment_pending':
        return <AlertCircle className="h-4 w-4 text-primary" />;
      case 'payment_rejected':
        return <XCircle className="h-4 w-4 text-primary" />;
      default:
        return <Info className="h-4 w-4 text-primary" />;
    }
  }

  function getNotificationColor(n) {
    if (n.priority === 1 && n.status !== 'acknowledged') {
      return 'bg-primary/20 border-primary font-bold';
    }

    switch (n.type) {
      case 'renewal_reminder':
        return 'bg-primary/5 border-primary/20';
      case 'class_scheduled':
        return 'bg-primary/10 border-primary/20';
      case 'admin_update':
        return 'bg-primary/10 border-primary/20';
      case 'profile_update':
        return 'bg-primary/5 border-primary/20';
      case 'payment':
      case 'payment_approved':
      case 'payment_completed':
        return 'bg-primary/5 border-primary/20';
      case 'payment_pending':
        return 'bg-primary/5 border-primary/20';
      case 'payment_rejected':
        return 'bg-primary/10 border-primary/20';
      default:
        return 'bg-primary/5 border-primary/10';
    }
  }

  // unreadCount now from useNotifications

  // Check if user needs to subscribe - check membership status
  const needsSubscription = !membershipStatus || membershipStatus.toLowerCase() !== "active";
  // Detect payments page and selected plan (used to avoid blocking UI)
  const isOnPaymentsPage = location.pathname === "/member/payments";
  const hasPlanParam = new URLSearchParams(location.search).get("plan");

  // Determine which modal to show based on payment status
  // Wait for payment status to be loaded (not null) before deciding
  const paymentStatusLoaded = paymentStatus !== null;
  const hasPendingPayment = paymentStatus === "pending";
  const hasRejectedPayment = paymentStatus === "rejected";
  const hasNoPayment = paymentStatus === "none";

  // Only show waiting modal if payment status is loaded and pending
  const showWaitingModal = !loadingStatus && paymentStatusLoaded && needsSubscription && hasPendingPayment && !isOnPaymentsPage;

  // Only show subscription modal if payment status is loaded and there's no pending payment.
  // IMPORTANT: Never block the payments page itself so members can always see the payment form.
  const showSubscriptionModal =
    !loadingStatus &&
    paymentStatusLoaded &&
    needsSubscription &&
    !hasPendingPayment &&
    !isOnPaymentsPage;

  // Redirect to payments page if user tries to navigate elsewhere without active subscription
  // But only if payment was rejected or no payment exists (not if pending)
  useEffect(() => {
    if (!loadingStatus && paymentStatusLoaded && needsSubscription && !isOnPaymentsPage && (hasRejectedPayment || hasNoPayment)) {
      navigate("/member/payments", { replace: true });
    }
  }, [loadingStatus, paymentStatusLoaded, needsSubscription, isOnPaymentsPage, navigate, hasRejectedPayment, hasNoPayment]);

  return (
    <div className="flex min-h-screen bg-background relative">
      {/* Blur overlay when subscription is needed - behind modal */}
      {(showSubscriptionModal || showWaitingModal) && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md z-40 pointer-events-none" />
      )}

      <div className={`flex-1 flex ${(showSubscriptionModal || showWaitingModal) ? "blur-sm pointer-events-none" : ""}`}>
        <MemberSidebar disabled={showSubscriptionModal} />
        <div className="flex-1 flex flex-col">
          <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b bg-card flex-shrink-0 z-40 transition-all duration-300">
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
              <div className="relative w-full max-w-xs hidden lg:block flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search classes, trainers, or plans" className="pl-10 w-full" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              {user?.role === "member" && (
                <div className="relative" ref={bellRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBellOpen((open) => !open);
                    }}
                    className="relative p-1 rounded-full hover:bg-muted transition-colors"
                    aria-label="Show notifications"
                  >
                    <Bell
                      ref={bellIconRef}
                      className={`h-5 w-5 text-muted-foreground transition-colors ${bellOpen ? "text-primary" : ""} ${unreadCount > 0 ? "text-primary" : ""}`}
                    />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-primary animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Badge>
                    )}
                  </button>
                  {/* Dropdown popover */}
                  {bellOpen && (
                    <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white border rounded-lg shadow-xl z-[100] animate-in fade-in slide-in-from-top-2 px-0 py-2 max-h-[500px] overflow-y-auto">
                      <div className="px-4 py-3 border-b bg-muted/50 sticky top-0">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">Notifications</div>
                          {unreadCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {unreadCount} new
                            </Badge>
                          )}
                        </div>
                      </div>
                      {notifications.length === 0 ? (
                        <div className="text-sm px-4 py-8 text-muted-foreground text-center">
                          No notifications yet.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`px-4 py-3 hover:bg-gray-50 transition cursor-pointer border-l-4 ${getNotificationColor(n)} ${!n.is_read ? 'bg-opacity-100' : 'bg-opacity-50'}`}
                              onClick={() => {
                                // Mark as read on click
                                if (!n.is_read) {
                                  markAsRead(n.id);
                                }

                                // Navigate to action_url if it exists
                                if (n.action_url) {
                                  setBellOpen(false); // Close notification dropdown
                                  navigate(n.action_url);
                                }
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex-shrink-0">
                                  {getNotificationIcon(n)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm font-medium ${!n.is_read ? 'font-semibold' : ''}`}>
                                    {n.message}
                                  </div>
                                  {n.action_url && n.action_label && (
                                    <div className="text-xs text-primary font-medium mt-1 flex items-center gap-1">
                                      <span>→ {n.action_label}</span>
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(n.created_at))} ago
                                  </div>
                                </div>
                                {!n.is_read && (
                                  <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5"></div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="text-right hidden xl:block flex-shrink-0">
                <div className="text-sm font-semibold truncate max-w-[120px]">{user?.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{user?.role || "member"}</div>
              </div>
              <Avatar className="h-9 w-9 flex-shrink-0">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback>{initials}</AvatarFallback>
                )}
              </Avatar>
              <Button variant="outline" size="sm" onClick={handleLogout} className="flex-shrink-0">
                Logout
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Waiting Approval Modal - Show when payment is pending */}
      {showWaitingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto w-full h-full flex items-center justify-center">
            <WaitingApprovalModal open={true} />
          </div>
        </div>
      )}

      {/* Subscription Modal - Show when membership is not Active and no pending payment */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto w-full h-full flex items-center justify-center">
            <SubscriptionModal open={true} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
          20%, 40%, 60%, 80% { transform: translateX(3px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
