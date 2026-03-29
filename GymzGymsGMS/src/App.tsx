import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Finances from "./pages/Finances";
import PrivateClasses from "./pages/PrivateClasses";
import Staff from "./pages/Staff";
import StaffProfile from "./pages/StaffProfile";
import Settings from "./pages/Settings";
import Inquiries from "./pages/Inquiries";
import NotFound from "./pages/NotFound";
import { GymCalendarManager } from "./admin/gym-calendar";
import { CheckInPage } from "./admin/checkin";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import MemberDashboard from "./pages/MemberDashboard";
import MemberProfile from "./pages/MemberProfile";
import MemberClasses from "./pages/MemberClasses";
import MemberPayments from "./pages/MemberPayments";
import MemberCalendar from "./pages/MemberCalendar";
import MemberAIChat from "./pages/MemberAIChat";
import AdminAIChat from "./pages/AdminAIChat";
import AISettings from "./pages/AISettings";
import AINotificationsDashboard from "./pages/AINotificationsDashboard";
import SentNotifications from "./pages/SentNotifications";
import GrowthQueue from "./pages/GrowthQueue";
import NoticeBoard from "./pages/NoticeBoard";
import Rooms from "./pages/Rooms";
import { MemberLayout } from "./components/MemberLayout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import EmailConfirmation from "./pages/EmailConfirmation";
import InviteComplete from "./pages/InviteComplete";
import MemberAttendance from "./pages/MemberAttendance";
import LimitedAccessLogs from "./pages/LimitedAccessLogs";
import Events from "./pages/admin/Events";
import EventAnalytics from "./pages/admin/EventAnalytics";
import EventRSVPManagement from "./pages/admin/EventRSVPManagement";
import OutdoorCRM from "./pages/admin/OutdoorCRM";
import Sponsors from "./pages/admin/Sponsors";
import SponsorReports from "./pages/admin/SponsorReports";
import DeletedAccounts from "./pages/DeletedAccounts";
import { DeepLinkHandler } from "./components/DeepLinkHandler";
import OACLayout from "./layouts/OACLayout";
import WebsiteTrafficOAC from "./pages/oac/WebsiteTrafficOAC";

const queryClient = new QueryClient();

// Use HashRouter in Electron (file://) so routes work without a server
const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;

function PrivateRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "platform_admin") {
      return <Navigate to="/oac/website-traffic" replace />;
    }
    const fallback =
      user.role === "member"
        ? "/member/dashboard"
        : user.role === "staff"
          ? "/staff/profile"
          : "/dashboard";
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

function AuthRedirect() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Navigate to="/dashboard" replace />;
  if (user?.role === 'staff') return <Navigate to="/staff/profile" replace />;
  if (user?.role === 'member') return <Navigate to="/member/dashboard" replace />;
  return null;
}

/** Entry route "/": send authenticated users to app, unauthenticated to login. No blank flash. */
function EntryRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  if (user) {
    if (user.role === "platform_admin") return <Navigate to="/oac/website-traffic" replace />;
    if (user.role === "admin" || user.role === "super_admin") return <Navigate to="/dashboard" replace />;
    if (user.role === "staff") return <Navigate to="/staff/profile" replace />;
    if (user.role === "member") return <Navigate to="/member/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
}

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {(window as any).electronAPI?.isElectron && <DeepLinkHandler />}
          <Routes>
            <Route path="/" element={<EntryRoute />} />
            <Route
              path="/login"
              element={<Login />}
            />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/email-confirmed" element={<EmailConfirmation />} />
            <Route path="/invite-complete" element={<InviteComplete />} />

            <Route
              element={
                <PrivateRoute allowedRoles={["platform_admin", "super_admin"]}>
                  <OACLayout />
                </PrivateRoute>
              }
            >
              <Route path="/oac" element={<Navigate to="/oac/website-traffic" replace />} />
              <Route path="/oac/website-traffic" element={<WebsiteTrafficOAC />} />
            </Route>

            <Route
              element={
                <PrivateRoute allowedRoles={["admin", "super_admin"]}>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route path="/admin" element={<Navigate to="/admin/checkin" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/admin/deleted-accounts" element={<DeletedAccounts />} />
              <Route path="/finances" element={<Finances />} />
              <Route path="/private-classes" element={<PrivateClasses />} />
              <Route path="/admin/gym-calendar" element={<GymCalendarManager />} />
              <Route path="/admin/checkin" element={<CheckInPage />} />
              <Route path="/admin/rooms" element={<Rooms />} />
              <Route path="/admin/ai-chat" element={<AdminAIChat />} />
              <Route path="/admin/ai-settings" element={<AISettings />} />
              <Route path="/admin/ai-notifications" element={<AINotificationsDashboard />} />
              <Route path="/admin/sent-notifications" element={<SentNotifications />} />
              <Route path="/admin/limited-access" element={<LimitedAccessLogs />} />
              <Route path="/admin/growth-queue" element={<GrowthQueue />} />
              <Route path="/admin/events" element={<Events />} />
              <Route path="/admin/event-analytics" element={<EventAnalytics />} />
              <Route path="/admin/event-rsvps" element={<EventRSVPManagement />} />
              <Route path="/admin/outdoor-crm" element={<OutdoorCRM />} />
              <Route path="/admin/sponsors" element={<Sponsors />} />
              <Route path="/admin/sponsor-reports" element={<SponsorReports />} />
              <Route path="/notice-board" element={<NoticeBoard />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/staff/profile" element={<StaffProfile />} />
              <Route path="/admin/inquiries" element={<Inquiries />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Staff routes */}
            <Route
              element={
                <PrivateRoute allowedRoles={["staff"]}>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route path="/staff/dashboard" element={<Dashboard />} />
              <Route path="/staff/members" element={<Members />} />
              <Route path="/staff/deleted-accounts" element={<DeletedAccounts />} />
              <Route path="/staff/finances" element={<Finances />} />
              <Route path="/staff/checkin" element={<CheckInPage />} />
              <Route path="/staff/rooms" element={<Rooms />} />
              <Route path="/staff/notice-board" element={<NoticeBoard />} />
              <Route path="/staff/profile" element={<StaffProfile />} />
              <Route path="/staff/settings" element={<Settings />} />
            </Route>

            {/* Member routes */}
            <Route
              element={
                <PrivateRoute allowedRoles={["member"]}>
                  <MemberLayout />
                </PrivateRoute>
              }
            >
              <Route path="/member/dashboard" element={<MemberDashboard />} />
              <Route path="/member/progress" element={<MemberDashboard />} />
              <Route path="/member/profile" element={<MemberProfile />} />
              <Route path="/member/classes" element={<MemberClasses />} />
              <Route path="/member/calendar" element={<MemberCalendar />} />
              <Route path="/member/payments" element={<MemberPayments />} />
              <Route path="/member/ai-chat" element={<MemberAIChat />} />
              <Route path="/member/notice-board" element={<NoticeBoard />} />
              <Route path="/member/attendance" element={<MemberAttendance />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

export default App;
