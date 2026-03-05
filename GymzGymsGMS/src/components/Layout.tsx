/* @ts-nocheck */
import { useEffect, useState, useRef, useMemo } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { notifyPaymentApproved, notifyPaymentRejected } from "@/lib/notifications";
import { useNotifications } from "@/hooks/useNotifications";
import { GlobalSearch } from "./GlobalSearch";
import { GymzLogo } from "./GymzLogo";

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

  // Notifications logic using shared hook
  const { notifications, unreadCount, markAsRead, refresh: fetchAllData } = useNotifications();
  const [bellOpen, setBellOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'gym_joins' | 'event_joins' | 'backfilled'>('all');
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [gymName, setGymName] = useState<string>("");
  const bellRef = useRef(null);
  const bellIconRef = useRef<SVGSVGElement>(null);
  const lastNotificationClickRef = useRef<{ id: string; time: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { toast } = useToast();

  const currency = new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  useEffect(() => {
    const pChannel = supabase.channel('pay-v3-updates').on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchAllData()).subscribe();
    return () => {
      supabase.removeChannel(pChannel);
    };
  }, [fetchAllData]);

  useEffect(() => {
    async function fetchGymName() {
      const gymId = user?.gymId || (user as any)?.gym_id;
      if (!gymId) return;
      const { data } = await supabase
        .from("gyms")
        .select("name")
        .eq("id", gymId)
        .maybeSingle();
      if (data?.name) {
        setGymName(data.name);
      }
    }
    fetchGymName();
  }, [user?.gymId]);

  useEffect(() => {
    function handleDocClick(event) {
      if (!bellRef.current) return;
      if (bellOpen && !bellRef.current.contains(event.target)) setBellOpen(false);
    }
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [bellOpen]);

  useEffect(() => {
    if (bellOpen && notifications.length > 0) {
      const unread = notifications.filter(n => !n.is_read);
      if (unread.length > 0) {
        unread.forEach(n => markAsRead(n.id));
      }
    }
  }, [bellOpen, notifications, markAsRead]);

  const getNotificationIcon = (n: any) => {
    const iconCls = "h-3.5 w-3.5 flex-shrink-0";
    if (n.priority === 1) return <AlertCircle className={`${iconCls} text-red-600 animate-pulse`} />;
    switch (n.type) {
      case 'payment':
      case 'payment_pending':
      case 'payment_approved':
      case 'payment_completed':
        return <DollarSign className={`${iconCls} text-green-600`} />;
      case 'payment_rejected':
        return <XCircle className={`${iconCls} text-red-600`} />;
      case 'admin_update':
      case 'system_alert':
        return <AlertCircle className={`${iconCls} text-primary`} />;
      case 'member_signup':
      case 'member_joined_gym':
      case 'member_joined_event':
      case 'event_signup':
        return <User className={`${iconCls} text-primary`} />;
      default:
        return <Bell className={`${iconCls} text-gray-600`} />;
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const searchInput = document.getElementById("header-search-input");
        searchInput?.focus();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const getNotificationColor = (n: any) => {
    if (n.priority === 1 && n.status !== 'acknowledged') return 'bg-red-100 border-l-red-600 dark:bg-red-950/40 font-bold';
    switch (n.type) {
      case 'payment':
      case 'payment_pending':
        return 'bg-yellow-50 border-l-yellow-500 dark:bg-yellow-950/20';
      case 'payment_approved':
      case 'payment_completed':
        return 'bg-green-50 border-l-primary dark:bg-green-950/20';
      case 'payment_rejected':
        return 'bg-red-50 border-l-red-500 dark:bg-red-950/20';
      case 'admin_update':
      case 'system_alert':
        return 'bg-primary/5 border-l-primary dark:bg-primary/10';
      case 'member_signup':
      case 'member_joined_gym':
      case 'member_joined_event':
      case 'event_signup':
        return 'bg-primary/5 border-l-primary dark:bg-primary/10';
      default:
        return 'bg-gray-50 border-l-gray-500 dark:bg-gray-950/20';
    }
  };

  const getFinancesPath = () => (user?.role === 'staff' ? '/staff/finances' : '/finances');
  const getMembersPath = () => (user?.role === 'staff' ? '/staff/members' : '/members');
  const getEventRSVPsPath = () => '/admin/event-rsvps';

  const buildDetailPath = (notification: any): string | null => {
    const meta = notification.metadata || {};
    const paymentId = notification.payment_id;

    if (['payment', 'payment_pending', 'payment_approved', 'payment_completed', 'payment_rejected'].includes(notification.type)) {
      return paymentId ? `${getFinancesPath()}?paymentId=${paymentId}` : getFinancesPath();
    }
    if (['member_joined_gym', 'member_signup'].includes(notification.type)) {
      const memberId = meta.member_id || meta.user_id;
      return memberId ? `${getMembersPath()}?id=${memberId}` : getMembersPath();
    }
    if (['member_joined_event', 'event_signup'].includes(notification.type)) {
      const eventId = meta.event_id;
      return eventId ? `${getEventRSVPsPath()}?eventId=${eventId}` : getEventRSVPsPath();
    }
    if (notification.type === 'admin_update') return '/dashboard';
    return null;
  };

  const handleNotificationClick = async (notification: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!readNotifications.has(notification.id)) setReadNotifications(prev => new Set(prev).add(notification.id));
    const paymentId = notification.payment_id;

    const now = Date.now();
    const last = lastNotificationClickRef.current;
    const isDoubleClick = last?.id === notification.id && now - last.time < 400;
    const isProcessedPayment = ['payment_approved', 'payment_completed', 'payment_rejected'].includes(notification.type);

    // Double-click: always go to detailed record (payment, member, event, etc.)
    if (isDoubleClick) {
      lastNotificationClickRef.current = null;
      setBellOpen(false);
      const path = buildDetailPath(notification);
      if (path) navigate(path);
      return;
    }
    lastNotificationClickRef.current = { id: notification.id, time: now };

    // Single-click for processed payments: go to finances
    if (isProcessedPayment) {
      setBellOpen(false);
      const path = paymentId ? `${getFinancesPath()}?paymentId=${paymentId}` : getFinancesPath();
      navigate(path);
      return;
    }

    const isPendingPayment = notification.type === 'payment' || notification.type === 'payment_pending';
    if (isPendingPayment) {
      setLoadingPayment(true);
      setPaymentDialogOpen(true);
      setBellOpen(false);
      setSelectedTrainer(null);
      try {
        let paymentData = null;
        // Attempt 1: Fetch by payment_id WITHOUT strictly joining users first
        if (notification.payment_id) {
          console.log(`[Notification] Fetching payment ${notification.payment_id}`);
          const { data: simplePayment, error: simpleError } = await supabase
            .from("payments")
            .select("*")
            .eq("id", notification.payment_id)
            .maybeSingle();

          if (simpleError) console.error("[Notification] Payment fetch error:", simpleError);

          if (simplePayment) {
            // Now fetch the user manually to be safe against join failures
            if (simplePayment.user_id) {
              const { data: uData } = await supabase.from('users').select('name, email').eq('id', simplePayment.user_id).maybeSingle();
              paymentData = { ...simplePayment, users: uData };
            } else {
              paymentData = simplePayment;
            }
            // Fetch trainer name when payment has a tip
            if (paymentData && (Number(paymentData.tip_amount || 0) > 0) && paymentData.trainer_id) {
              const { data: tData } = await supabase.from('staff').select('name').eq('id', paymentData.trainer_id).maybeSingle();
              if (tData) paymentData = { ...paymentData, trainer_name: tData.name };
            }
          }
        }

        // Attempt 2: Fallback to finding latest payment by user_id
        if (!paymentData && notification.user_id) {
          console.log(`[Notification] Fallback: Fetching latest payment for user ${notification.user_id}`);
          const { data: latestPayment } = await supabase
            .from("payments")
            .select("*")
            .eq("user_id", notification.user_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestPayment) {
            const { data: uData } = await supabase.from('users').select('name, email').eq('id', latestPayment.user_id).maybeSingle();
            paymentData = { ...latestPayment, users: uData };
            if (paymentData && (Number(paymentData.tip_amount || 0) > 0) && paymentData.trainer_id) {
              const { data: tData } = await supabase.from('staff').select('name').eq('id', paymentData.trainer_id).maybeSingle();
              if (tData) paymentData = { ...paymentData, trainer_name: tData.name };
            }
          }
        }

        if (paymentData) {
          console.log("[Notification] Payment found:", paymentData);
          setSelectedPayment(paymentData);
        } else {
          console.error("[Notification] Payment not found via ID or UserID linkage.");
          setPaymentDialogOpen(false);
          toast({ title: "Payment Not Found", description: "Payment may have already been processed or access is denied.", variant: "destructive" });
        }
      } catch (err: any) { console.error(err); } finally { setLoadingPayment(false); }
    } else if (notification.type === 'admin_update') {
      setBellOpen(false);
      navigate('/dashboard');
    } else if (['member_joined_gym', 'member_joined_event', 'event_signup', 'member_signup'].includes(notification.type)) {
      setBellOpen(false);
      const path = buildDetailPath(notification);
      navigate(path || getMembersPath());
    }
  };

  const handleApprovePayment = async () => {
    const targetUserId = selectedPayment?.user_id || selectedPayment?.member_id;
    if (!selectedPayment || !targetUserId) {
      toast({ title: "Cannot Approve", description: "Payment has no linked user. Ensure user_id or member_id is set.", variant: "destructive" });
      return;
    }
    setProcessingPayment(true);
    try {
      // 1. Call Atomic Activation RPC (Canonical Path)
      // This handles: Payments update, Ledger credits/debits, Subscription creation/extension, and User status sync.
      const { data: activationResult, error: activationError } = await supabase.rpc('activate_subscription_from_payment', {
        p_payment_id: selectedPayment.id,
        p_admin_id: user.id
      });

      if (activationError) throw activationError;
      if (activationResult && !activationResult.success) {
        throw new Error(activationResult.error || 'Activation failed');
      }

      // 2. Send Notifications
      await notifyPaymentApproved({
        id: selectedPayment.id,
        amount: selectedPayment.amount || 0,
        user_id: targetUserId,
        member_name: selectedPayment.users?.name || 'Member',
        gym_id: user?.gymId || undefined
      });

      toast({
        title: "Payment Approved",
        description: `Membership activated successfully! Expiry: ${activationResult.new_expiry ? format(new Date(activationResult.new_expiry), 'MMM dd, yyyy') : 'N/A'}`
      });

      setPaymentDialogOpen(false);
      fetchAllData();
    } catch (err: any) {
      console.error("[GMS Approve] Error:", err);
      toast({
        title: "Activation Error",
        description: err.message || "Failed to process activation. Please check system logs.",
        variant: "destructive"
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleRejectPayment = async () => {
    const targetUserId = selectedPayment?.user_id || selectedPayment?.member_id;
    if (!selectedPayment) return;
    setProcessingPayment(true);
    try {
      // 1. Update Payment Status to 'failed'
      const { error: pError } = await supabase.from("payments").update({
        status: 'failed',
        payment_status: 'failed'
      }).eq("id", selectedPayment.id);

      if (pError) throw pError;

      // 2. Conditionally Update User Status
      // CRITICAL: Never set an active subscriber to 'Rejected' just because a top-up failed.
      if (targetUserId) {
        // A. Check for Active Subscription (Source of Truth)
        const { data: activeSub } = await supabase
          .from('subscriptions')
          .select('id, tier_id, status, ends_at')
          .eq('user_id', targetUserId)
          .eq('status', 'active')
          .gt('ends_at', new Date().toISOString())
          .maybeSingle();

        if (activeSub) {
          console.log(`[GMS] Payment rejected. User has Active Subscription (Ends: ${activeSub.ends_at}). preserving User Status.`);
        } else {
          // B. No active subscription found. Check current status string.
          const { data: userData } = await supabase
            .from('users')
            .select('membership_status')
            .eq('id', targetUserId)
            .single();

          const currentStatus = userData?.membership_status || '';

          // Only reject if they are clearly in an onboarding/pending state.
          // If they have some other status (e.g. "Expired", "Paused"), we shouldn't blindly set to "Rejected" either?
          // For now, adhere to strict onboarding statuses.
          const safeToReject = ['New', 'Pending', 'pending', 'new', 'pending_approval', 'Rejected', 'rejected'].includes(currentStatus);

          if (safeToReject) {
            console.log(`[GMS] No active sub & status is '${currentStatus}'. Setting to 'Rejected'.`);
            await supabase.from('users').update({
              membership_status: 'Rejected' // This triggers the "Action Required" screen in the app
            }).eq('id', targetUserId);
          } else {
            console.log(`[GMS] Payment rejected. No active sub, but status is '${currentStatus}' (Unknown/Custom). Preserving.`);
          }
        }
      }

      await notifyPaymentRejected({
        id: selectedPayment.id,
        amount: selectedPayment.amount || 0,
        user_id: targetUserId,
        member_name: selectedPayment.users?.name || 'Member',
        gym_id: user?.gymId || undefined
      });
      toast({ title: "Payment Rejected", description: "Payment has been marked as failed." });
      setPaymentDialogOpen(false);
      fetchAllData();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "Failed to reject payment", variant: "destructive" });
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full relative transition-colors duration-500 overflow-hidden">
        {/* Fixed Aurora Backdrop - GLOBAL LEVEL */}
        <div className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden bg-mesh-glow">
          <div className="absolute top-[-10%] right-[-10%] w-[65vw] h-[65vw] rounded-full bg-primary/20 blur-[130px] opacity-60 animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-secondary/15 blur-[110px] opacity-50" />
        </div>

        {/* Sidebar */}
        <AppSidebar />

        {/* Content Area - FIXED LAYOUT DEPTH */}
        <div className="flex-1 flex flex-col relative z-10 bg-transparent min-w-0 min-h-screen">
          {/* Header */}
          <header className="h-16 border-b border-border/40 bg-card/40 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between flex-shrink-0 z-40 transition-all duration-300">
            <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
              <SidebarTrigger className="h-9 w-9 flex-shrink-0 hover:bg-muted/50 transition-all duration-300 rounded-xl text-muted-foreground hover:text-primary active:scale-95" />
              <button
                type="button"
                onClick={() => navigate(user?.role === "staff" ? "/staff/dashboard" : "/dashboard")}
                className="hidden sm:flex items-center flex-shrink-0 h-9"
                aria-label="Gymz Home"
              >
                <GymzLogo className="h-8 w-auto" />
              </button>
              {gymName && (
                <div className="flex items-center">
                  <Badge variant="outline" className="px-2 md:px-3 py-1 font-semibold text-primary border-primary/30 bg-primary/5 shadow-sm flex-shrink-0 shrink">
                    <Building2 className="w-3.5 h-3.5 mr-1 md:mr-1.5 inline-block" />
                    <span className="truncate max-w-[80px] sm:max-w-[120px] lg:max-w-none">{gymName}</span>
                  </Badge>
                </div>
              )}
              <div className="hidden lg:flex relative flex-1 max-w-xs min-w-0">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
                <Input
                  id="header-search-input"
                  placeholder="Search... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  className="pl-11 w-full bg-background/30 border-border/30 focus:bg-background/50 transition-all border shadow-none rounded-xl"
                />
                <GlobalSearch
                  query={searchQuery}
                  setQuery={setSearchQuery}
                  open={searchOpen}
                  setOpen={setSearchOpen}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              {/* Compact mobile search trigger to reduce header crowding on small screens */}
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(true);
                  setTimeout(() => document.getElementById("header-search-input")?.focus(), 100);
                }}
                className="lg:hidden p-2 rounded-xl hover:bg-muted/80 transition-all duration-200 flex-shrink-0"
                aria-label="Search"
              >
                <Search className="h-5 w-5 text-muted-foreground" />
              </button>
              {["admin", "owner", "super_admin"].includes(user?.role || "") && (
                <div className="relative" ref={bellRef}>
                  <button type="button" onClick={() => setBellOpen((open) => !open)} className="relative p-2.5 rounded-xl hover:bg-muted/80 transition-all duration-200 hover:scale-105 active:scale-95">
                    <Bell ref={bellIconRef} className={`h-5 w-5 ${bellOpen ? "text-primary" : "text-muted-foreground"} ${unreadCount > 0 ? "text-amber-500" : ""}`} />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-bold bg-gradient-to-r from-red-500 to-red-600 text-white shadow-modern-md animate-pulse border-2 border-background">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Badge>
                    )}
                  </button>
                    {bellOpen && (
                    <div className="absolute right-0 mt-2 w-[360px] max-w-[90vw] bg-card border border-border/50 rounded-xl shadow-xl z-[100] animate-in fade-in slide-in-from-top-2 max-h-[70vh] overflow-hidden flex flex-col backdrop-blur-md">
                      <div className="px-5 py-4 border-b border-border/50 bg-muted/30 sticky top-0 z-10 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Notifications</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setBellOpen(false)}><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(['all', 'gym_joins', 'event_joins', 'backfilled'] as const).map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setNotificationFilter(f)}
                              className={`px-2 py-1 text-xs rounded-md transition-colors ${notificationFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted'}`}
                            >
                              {f === 'all' ? 'All' : f === 'gym_joins' ? 'Gym' : f === 'event_joins' ? 'Event' : 'Backfilled'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="overflow-y-auto flex-1 p-1.5 space-y-0.5">
                        {(() => {
                          const filtered = notifications.filter((n) => {
                            if (notificationFilter === 'all') return true;
                            if (notificationFilter === 'gym_joins') return n.type === 'member_joined_gym';
                            if (notificationFilter === 'event_joins') return ['member_joined_event', 'event_signup'].includes(n.type);
                            if (notificationFilter === 'backfilled') return n.is_backfilled === true;
                            return true;
                          });
                          return filtered.length === 0 ? <p className="text-center py-8 text-sm text-muted-foreground">No notifications</p> :
                          filtered.map((n) => (
                            <div
                              key={n.id}
                              role="button"
                              tabIndex={0}
                              onClick={(e) => handleNotificationClick(n, e)}
                              onPointerDown={(e) => e.stopPropagation()}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNotificationClick(n); } }}
                              title={['payment', 'payment_pending'].includes(n.type) ? 'Click to verify · Double-click to view payment' : 'Click to open · Double-click to view details'}
                              className={`py-2 px-2.5 rounded-md border-l-[3px] cursor-pointer hover:bg-muted/50 transition-all active:scale-[0.98] select-none ${getNotificationColor(n)}`}
                            >
                              <div className="flex gap-2 items-start">
                                <span className="flex-shrink-0 mt-0.5">{getNotificationIcon(n)}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium line-clamp-2 leading-tight text-foreground">{n.message}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(n.created_at))} ago</p>
                                    {n.is_backfilled && (
                                      <span className="text-[10px] text-muted-foreground">Backfilled</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="text-right hidden xl:block flex-shrink-0">
                <div className="text-sm font-semibold truncate max-w-[120px]">{user?.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{user?.role}</div>
              </div>
              <Avatar className="h-9 w-9 ring-2 ring-primary/20 hover:scale-105 transition-transform cursor-pointer flex-shrink-0">
                <AvatarImage src={(user as any)?.avatarUrl} alt={user?.name} />
                <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))] text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm" onClick={handleLogout} className="hover:bg-destructive/10 flex-shrink-0">Logout</Button>
            </div>
          </header>
          {/* Main Viewport */}
          <main className="flex-1 overflow-y-auto w-full p-4 md:p-6 custom-scrollbar">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="glass-card max-w-[320px] w-[calc(100vw-2rem)] p-5 border-primary/20 rounded-2xl shadow-modern-lg">
          <DialogHeader className="space-y-0.5 pb-4">
            <DialogTitle className="text-base font-bold text-primary">Payment Verification</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Review and process membership payment</DialogDescription>
          </DialogHeader>
          {loadingPayment ? <div className="py-6 text-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" /></div> : selectedPayment && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 py-2.5 px-3 bg-primary/5 rounded-lg border border-primary/10">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Member</span>
                <span className="font-semibold text-sm text-foreground truncate">{selectedPayment.users?.name || "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5 px-3 bg-primary/5 rounded-lg border border-primary/10">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Amount</span>
                <span className="font-bold text-base text-primary">{currency.format(selectedPayment.amount || 0)}</span>
              </div>
              {(Number(selectedPayment.tip_amount || 0) > 0) && (
                <div className="flex items-center justify-between gap-4 py-2.5 px-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Tip</span>
                  <span className="text-sm font-medium text-foreground">
                    {currency.format(selectedPayment.tip_amount || 0)}
                    {selectedPayment.trainer_name && (
                      <span className="text-muted-foreground font-normal"> → {selectedPayment.trainer_name}</span>
                    )}
                  </span>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1 h-9 text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg" onClick={handleApprovePayment} disabled={processingPayment}>Approve</Button>
                <Button size="sm" variant="outline" className="flex-1 h-9 text-sm border-destructive/30 text-destructive hover:bg-destructive/10 font-medium rounded-lg" onClick={handleRejectPayment} disabled={processingPayment}>Reject</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
