import { NavLink, useNavigate } from "react-router-dom";
import { Users, Calendar, DollarSign, BarChart3, User, Dumbbell, Settings, MessageSquare, ClipboardList } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GymzLogo } from "@/components/GymzLogo";

const memberLinks = [
  { to: "/member/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/member/notice-board", label: "Community Chat Room", icon: MessageSquare },
  { to: "/member/profile", label: "Profile", icon: User },
  { to: "/member/attendance", label: "Attendance", icon: Calendar },
  { to: "/member/payments", label: "Payments", icon: DollarSign },
  { to: "/member/classes", label: "Classes", icon: Calendar },
  { to: "/member/calendar", label: "Gym Calendar", icon: Calendar },
  { to: "/member/progress", label: "Progress", icon: Dumbbell },
  { to: "/member/ai-chat", label: "AI Chat", icon: MessageSquare },
  { to: "/member/settings", label: "Settings", icon: Settings },
];

interface MemberSidebarProps {
  disabled?: boolean;
}

export function MemberSidebar({ disabled = false }: MemberSidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"none" | "pending" | "rejected" | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      try {
        const { data } = await supabase
          .from("users")
          .select("membership_status")
          .eq("id", user.id)
          .single();

        if (data) {
          setMembershipStatus(data.membership_status);
        }
      } catch (err) {
        console.error("Error fetching membership status:", err);
      }
    })();

    // Check payment status
    (async () => {
      try {
        const { data } = await supabase
          .from("payments")
          .select("status")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          if (data.status === "pending_approval" || data.status === "pending") {
            setPaymentStatus("pending");
          } else if (data.status === "failed") {
            setPaymentStatus("rejected");
          } else {
            setPaymentStatus("none");
          }
        } else {
          setPaymentStatus("none");
        }
      } catch (err) {
        console.error("Error fetching payment status:", err);
        setPaymentStatus("none");
      }
    })();
  }, [user?.id]);

  const needsSubscription = membershipStatus !== "Active";
  const hasPendingPayment = paymentStatus === "pending";

  const handleLinkClick = (e: React.MouseEvent, to: string) => {
    if (disabled || (needsSubscription && !hasPendingPayment)) {
      e.preventDefault();
      if (to !== "/member/payments") {
        // Only redirect to payments if payment is rejected or no payment exists (not if pending)
        if (paymentStatus === "rejected" || paymentStatus === "none") {
          navigate("/member/payments", { replace: true });
        }
      }
    }
  };

  return (
    <aside className="min-h-screen w-20 md:w-56 bg-card border-r px-2 py-4 flex flex-col gap-8">
      <div className="hidden md:flex flex-col items-center gap-2 pb-4 border-b">
        <GymzLogo className="h-10 w-auto" />
        <div className="font-bold text-lg tracking-tight">Member Portal</div>
      </div>
      <div className="md:hidden flex justify-center pb-4 border-b">
        <GymzLogo className="h-8 w-auto" />
      </div>
      <nav className="flex-1 flex flex-col gap-2">
        {memberLinks.map(link => (
          disabled || (needsSubscription && link.to !== "/member/payments" && !hasPendingPayment) ? (
            <div
              key={link.to}
              className="flex items-center gap-3 px-3 py-2 rounded transition-all opacity-50 cursor-not-allowed"
              onClick={(e) => handleLinkClick(e, link.to)}
            >
              <link.icon className="h-5 w-5" />
              <span className="hidden md:inline">{link.label}</span>
            </div>
          ) : (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={(e) => handleLinkClick(e, link.to)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded transition-all ${isActive ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}
            >
              <link.icon className="h-5 w-5" />
              <span className="hidden md:inline">{link.label}</span>
            </NavLink>
          )
        ))}
      </nav>
    </aside>
  );
}
