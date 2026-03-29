/* @ts-nocheck */
import { useEffect, useState, useRef, useMemo } from "react";
import { StatsCard } from "@/components/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  X,
  Download,
  FileText,
  Search,
  Zap,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  Ticket,
  Bell
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { sanitizeMembershipStatuses } from "@/services/membershipService";
import { DataMapper } from "@/utils/dataMapper";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  formatDistanceToNow,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  startOfYear,
  differenceInDays
} from "date-fns";
import { generateAndVerifyUniqueUserId, formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { fetchGymNameForReport } from '@/lib/pdfBranding';
import { QuickActions } from "@/components/QuickActions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RetentionStrategies } from "@/components/RetentionStrategies";
import { fetchGymPlans } from "@/services/gymPricing";
import { Skeleton } from "@/components/ui/skeleton";

// Maximally distinct colors: no blue/purple/violet cluster - each color clearly different
const PLAN_PALETTE = [
  "#2A4B2A",  // dark green (primary)
  "#DC2626",  // red
  "#2563EB",  // blue (only one blue)
  "#CA8A04",  // gold
  "#FF6B6B",  // coral (replaced violet - was too similar to blue)
  "#059669",  // emerald
  "#EA580C",  // orange
  "#0891B2",  // cyan
  "#DB2777",  // pink
  "#65A30D",  // lime
  "#FF1493",  // hot pink (replaced indigo - was too similar to blue)
  "#F59E0B",  // amber
  "#0D9488",  // teal
  "#BE185D",  // rose
  "#16A34A",  // green
  "#C026D3",  // fuchsia
];

/** Returns color for a plan. Use planColorMap when available so each unique type gets a distinct color. */
function getPlanColor(planName: string, index: number, planColorMap?: Record<string, string>): string {
  if (planColorMap?.[planName]) return planColorMap[planName];
  return PLAN_PALETTE[index % PLAN_PALETTE.length];
}

// Resolves plan display name from payment: plan_id → gym plan name, else membership_type, else description, else "Other"
function resolvePlanName(p: any, planMap: Map<string, string>): string {
  if (p.plan_id && planMap.has(p.plan_id)) return planMap.get(p.plan_id)!;
  const type = (p.membership_type || p.membershipType || "").trim();
  if (type) return type;
  const desc = (p.description || "").trim();
  if (desc) return desc;
  return "Other";
}

// Offline-first: dashboard cache key and icon name mapping for serializable recentActivities
const DASHBOARD_CACHE_PREFIX = "dashboard_cache_";
function getDashboardCacheKey(gymIdOrUserId: string) {
  return DASHBOARD_CACHE_PREFIX + gymIdOrUserId;
}
const ACTIVITY_ICON_MAP: Record<string, LucideIcon> = {
  DollarSign,
  CheckCircle,
  UserPlus,
  Bell,
  Ticket,
};

export default function Dashboard() {
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    checkinsToday: 0,
    monthlyRevenue: 0,
    pendingAmount: 0,
    newSignups: 0,
    retention: 0,
    activeMemberRate: 0,
    churnRate: 0,
    renewalRate: 0,
    atRiskCount: 0,
    expiringThisMonth: 0,
    monthlyRevenueTarget: 10000
  });

  const [revenueData, setRevenueData] = useState([]);
  const [signupData, setSignupData] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [membershipData, setMembershipData] = useState([]);
  const [genderData, setGenderData] = useState([]);
  const [ageData, setAgeData] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  const [dataLoading, setDataLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState("30d");
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState("range");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPlan, setSelectedPlan] = useState("All");
  const [gymPlanNames, setGymPlanNames] = useState<string[]>([]);
  const [planIdToName, setPlanIdToName] = useState<Map<string, string>>(new Map());

  const [rawPaymentsData, setRawPaymentsData] = useState([]);

  // Each unique membership type gets a distinct color; same type = same color across charts
  const planColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    membershipData.forEach((item, i) => {
      map[item.name] = PLAN_PALETTE[i % PLAN_PALETTE.length];
    });
    return map;
  }, [membershipData]);

  useEffect(() => {
    if (user?.gymId) {
      sanitizeMembershipStatuses().catch(e => console.error("Error sanitizing:", e));
    }
  }, [user?.gymId]);

  useEffect(() => {
    const cacheKey = user?.gymId ?? user?.id;
    const isAdminOrStaff = user?.role === "admin" || user?.role === "staff";
    let isBackgroundRefresh = false;
    if (isAdminOrStaff && cacheKey) {
      try {
        const raw = typeof localStorage !== "undefined" ? localStorage.getItem(getDashboardCacheKey(cacheKey)) : null;
        if (raw) {
          const cached = JSON.parse(raw);
          const rangeMatches = cached?.dateRange === dateRange && !customStartDate && !customEndDate;
          if (cached && typeof cached.stats === "object" && rangeMatches) {
            setStats(cached.stats);
            setRevenueData(cached.revenueData || []);
            setSignupData(cached.signupData || []);
            setAttendanceData(cached.attendanceData || []);
            setMembershipData(cached.membershipData || []);
            setGenderData(cached.genderData || []);
            setAgeData(cached.ageData || []);
            setRawPaymentsData((cached.rawPaymentsData || []).map((p: any) => ({
              ...p,
              resolvedDate: p.resolvedDate ? new Date(p.resolvedDate) : p.resolvedDate,
            })));
            setGymPlanNames(cached.gymPlanNames || []);
            setPlanIdToName(cached.planIdToName ? new Map(Object.entries(cached.planIdToName)) : new Map());
            if (cached.dateRange) setDateRange(cached.dateRange);
            setRecentActivities((cached.recentActivities || []).map((a: any) => ({
              id: a.id,
              type: a.type,
              title: a.title,
              subtitle: a.subtitle,
              time: new Date(a.time),
              status: a.status,
              iconColor: a.iconColor || "bg-primary/10 text-primary",
              icon: ACTIVITY_ICON_MAP[a.iconName] || Bell,
            })));
            setDataLoading(false);
            isBackgroundRefresh = true;
          }
        }
      } catch (_) {
        // Invalid or missing cache; will fetch below
      }
      fetchDashboardData(isBackgroundRefresh);
    } else if (isAdminOrStaff) {
      fetchDashboardData();
    }

    // REAL-TIME: Robust multi-table subscription
    if (!user?.gymId) return;
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `gym_id=eq.${user.gymId}` }, () => {
        console.log("Real-time: Payment update received");
        fetchDashboardData();
        toast({ title: "Live update", description: "Payment records updated" });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `gym_id=eq.${user.gymId}` }, () => {
        console.log("Real-time: User update received");
        fetchDashboardData();
        toast({ title: "Live update", description: "Member records updated" });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `gym_id=eq.${user.gymId}` }, () => {
        console.log("Real-time: Attendance update received");
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs', filter: `gym_id=eq.${user.gymId}` }, () => {
        console.log("Real-time: Attendance log update received");
        fetchDashboardData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        console.log("Real-time: New notification received");
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, () => {
        console.log("Real-time: Event sign-up received");
        fetchDashboardData();
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [user?.role, user?.gymId, dateRange, customStartDate, customEndDate]);

  async function fetchDashboardData(isBackgroundRefresh = false) {
    if (!user?.gymId) {
      console.log("Dashboard: No gymId yet, skipping fetch");
      setDataLoading(false);
      return;
    }
    if (!isBackgroundRefresh) setDataLoading(true);
    try {
      const now = new Date();

      let startDate;
      let isLargeRange = false;

      // Check if custom date range is set
      if (customStartDate && customEndDate) {
        startDate = customStartDate;
        const daysDiff = differenceInDays(customEndDate, customStartDate);
        isLargeRange = daysDiff > 60;
      } else {
        switch (dateRange) {
          case "7d": startDate = subDays(now, 7); break;
          case "90d": startDate = subDays(now, 90); isLargeRange = true; break;
          case "ytd": startDate = startOfYear(now); isLargeRange = true; break;
          case "month": startDate = startOfMonth(now); break;
          default: startDate = subDays(now, 30); break;
        }
      }

      const endDate = customEndDate || now;

      // Fetch gym's configured plans for dynamic plan resolution
      const gymPlans = await fetchGymPlans(user.gymId, null);
      const planMap = new Map<string, string>();
      const planNames: string[] = [];
      gymPlans.forEach(plan => {
        planMap.set(plan.id, plan.planName);
        planNames.push(plan.planName);
      });
      setPlanIdToName(planMap);
      setGymPlanNames(planNames);

      // Universal Robust Fetch for Payments (include plan_id for gym plan resolution)
      const { data: rawPayments } = await supabase
        .from("payments")
        .select("id, amount, status, payment_status, paid_at, payment_date, created_at, user_id, member_id, description, membership_type, plan_id")
        .eq("gym_id", user.gymId);

      const mappedPayments = (rawPayments || []).map(p => ({
        ...p,
        amount: Number(p.amount || 0),
        resolvedStatus: (p.status || p.payment_status || "pending").toLowerCase().trim(),
        resolvedDate: new Date(p.payment_date || p.paid_at || p.created_at)
      }));

      setRawPaymentsData(mappedPayments);

      // Filtered successful payments for charts
      const successfulPayments = mappedPayments.filter(p =>
        ["completed", "approved", "success", "paid"].includes(p.resolvedStatus)
      );

      // Members
      const { count: totalMembers } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "member").eq("gym_id", user.gymId);
      const { count: activeMembers } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "member").eq("membership_status", "Active").eq("gym_id", user.gymId);
      const { data: allMembersInRange } = await supabase.from("users").select("created_at").eq("role", "member").eq("gym_id", user.gymId).gte("created_at", startDate.toISOString());
      const { data: allMembersForDemographics } = await supabase
        .from("users")
        .select("gender, age")
        .eq("role", "member")
        .eq("gym_id", user.gymId);

      const { count: newSignups } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "member").eq("gym_id", user.gymId).gte("created_at", startDate.toISOString());

      // Attendance (Dashboard):
      // - Member app writes to `attendance` (check_in_time)
      // - Admin check-in writes to `attendance_logs` (checkin_time)
      // Aggregate both so charts reflect all real check-ins.
      const [{ data: rawAttendance }, { data: rawAttendanceLogs }] = await Promise.all([
        supabase
          .from("attendance")
          // Use FK join to scope by gym via users table.
          // This keeps trends working even when `attendance.gym_id` is missing or not populated.
          .select("id, check_in_time, user:users!inner(gym_id)")
          .eq("user.gym_id", user.gymId)
          .gte("check_in_time", startDate.toISOString()),
        supabase
          .from("attendance_logs")
          // Same approach for robustness across schema versions/backfills.
          .select("id, checkin_time, user:users!inner(gym_id)")
          .eq("user.gym_id", user.gymId)
          .gte("checkin_time", startDate.toISOString()),
      ]);

      const attendanceFromMemberApp = (rawAttendance || []).map((row: any) => ({
        id: row.id,
        checkInTime: row.check_in_time,
        source: "attendance",
      }));

      const attendanceFromAdminCheckin = (rawAttendanceLogs || []).map((row: any) => ({
        id: row.id,
        checkInTime: row.checkin_time,
        source: "attendance_logs",
      }));

      const attLogs = [...attendanceFromMemberApp, ...attendanceFromAdminCheckin]
        .filter((l: any) => !!l?.checkInTime)
        .sort((a: any, b: any) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());

      // Processing Charts
      const interval = isLargeRange ? eachMonthOfInterval({ start: startDate, end: endDate }) : eachDayOfInterval({ start: startDate, end: endDate });

      const processedRev = interval.map(date => {
        const dStr = format(date, isLargeRange ? "yyyy-MM" : "yyyy-MM-dd");
        const total = successfulPayments
          .filter(p => format(p.resolvedDate, isLargeRange ? "yyyy-MM" : "yyyy-MM-dd") === dStr)
          .reduce((s, p) => s + p.amount, 0);
        return { date: format(date, isLargeRange ? "MMM" : "MMM dd"), amount: total };
      });

      const processedAtt = interval.map(date => {
        const dStr = format(date, isLargeRange ? "yyyy-MM" : "yyyy-MM-dd");
        const count = (attLogs || []).filter(log => format(new Date(log.checkInTime), isLargeRange ? "yyyy-MM" : "yyyy-MM-dd") === dStr).length;
        return { date: format(date, isLargeRange ? "MMM" : "MMM dd"), count };
      });

      const processedSignup = interval.map(date => {
        const dStr = format(date, isLargeRange ? "yyyy-MM" : "yyyy-MM-dd");
        const count = (allMembersInRange || []).filter(u => format(new Date(u.created_at), isLargeRange ? "yyyy-MM" : "yyyy-MM-dd") === dStr).length;
        return { date: format(date, isLargeRange ? "MMM" : "MMM dd"), count };
      });

      // Stats
      const monthlyRev = successfulPayments
        .filter(p => p.resolvedDate >= startOfMonth(now))
        .reduce((s, p) => s + p.amount, 0);

      // Monthly target: rolling 3-month average (dynamic per gym), fallback 10000 if no history
      const threeMonthsAgo = subDays(now, 90);
      const last3MonthsRev = successfulPayments
        .filter(p => p.resolvedDate >= threeMonthsAgo)
        .reduce((s, p) => s + p.amount, 0);
      const monthlyRevenueTarget = last3MonthsRev > 0 ? Math.max(10000, Math.round(last3MonthsRev / 3)) : 10000;

      const pending = mappedPayments
        .filter(p => ["pending", "pending_approval"].includes(p.resolvedStatus))
        .reduce((s, p) => s + p.amount, 0);

      // Membership Mix — use actual plan names from gym plans + payment data (no hardcoded Basic/Couple/etc)
      const mixMap: Record<string, number> = {};
      successfulPayments.forEach(p => {
        const t = resolvePlanName(p, planMap);
        mixMap[t] = (mixMap[t] || 0) + 1;
      });

      // Demographics: gender and age distributions from users table
      const genderCountMap: Record<string, number> = {};
      const ageBuckets: { label: string; min: number; max: number | null; value: number }[] = [
        { label: "< 18", min: 0, max: 17, value: 0 },
        { label: "18-24", min: 18, max: 24, value: 0 },
        { label: "25-34", min: 25, max: 34, value: 0 },
        { label: "35-44", min: 35, max: 44, value: 0 },
        { label: "45-54", min: 45, max: 54, value: 0 },
        { label: "55+", min: 55, max: null, value: 0 },
      ];

      (allMembersForDemographics || []).forEach((m: any) => {
        const rawGender = (m.gender || "").toString().trim();
        const normalizedGender = rawGender
          ? rawGender.charAt(0).toUpperCase() + rawGender.slice(1).toLowerCase()
          : "Unspecified";
        genderCountMap[normalizedGender] = (genderCountMap[normalizedGender] || 0) + 1;

        const age = typeof m.age === "number" ? m.age : m.age ? Number(m.age) : null;
        if (age && age > 0) {
          const bucket = ageBuckets.find(b => (age >= b.min) && (b.max === null || age <= b.max));
          if (bucket) {
            bucket.value += 1;
          }
        }
      });

      const genderSeries = Object.entries(genderCountMap).map(([name, value]) => ({ name, value }));
      const ageSeries = ageBuckets.filter(b => b.value > 0).map(b => ({ name: b.label, value: b.value }));

      setGenderData(genderSeries);
      setAgeData(ageSeries);

      // Recent Activity Aggregation
      const activities = [];

      // Add Recent Payments
      mappedPayments.slice(0, 5).forEach(p => {
        activities.push({
          id: `pay-${p.id}`,
          type: 'payment',
          title: `Payment: ${formatCurrency(p.amount)}`,
          subtitle: p.description || 'Membership Payment',
          time: p.resolvedDate,
          status: p.resolvedStatus,
          icon: DollarSign,
          iconName: 'DollarSign',
          iconColor: 'bg-primary/10 text-primary'
        });
      });

      // Add Recent Check-ins
      (attLogs || []).slice(0, 5).forEach(log => {
        activities.push({
          id: `att-${log.id}`,
          type: 'attendance',
          title: 'Member Check-in',
          subtitle: 'Main Floor Entrance',
          time: new Date(log.checkInTime),
          status: 'success',
          icon: CheckCircle,
          iconName: 'CheckCircle',
          iconColor: 'bg-primary/10 text-primary'
        });
      });

      // Add Recent Signups
      (allMembersInRange || []).slice(0, 5).forEach((u, i) => {
        activities.push({
          id: `signup-${i}`,
          type: 'signup',
          title: 'New Member Registered',
          subtitle: 'System Acquisition',
          time: new Date(u.created_at),
          status: 'pending',
          icon: UserPlus,
          iconName: 'UserPlus',
          iconColor: 'bg-primary/10 text-primary'
        });
      });

      // Add Admin Notifications (member_signup, payment_pending, event_signup, etc.)
      const { data: adminNotifs } = await supabase
        .from("notifications")
        .select("id, type, message, created_at")
        .is("user_id", null)
        .eq("gym_id", user.gymId)
        .order("created_at", { ascending: false })
        .limit(15);

      (adminNotifs || []).forEach((n: any) => {
        const nType = (n.type || "").toLowerCase();
        let icon = Bell;
        let iconName = "Bell";
        let iconColor = "bg-primary/10 text-primary";
        if (nType.includes("payment")) {
          icon = DollarSign;
          iconName = "DollarSign";
          iconColor = nType.includes("pending") ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary";
        } else if (nType.includes("member_signup") || nType.includes("signup")) {
          icon = UserPlus;
          iconName = "UserPlus";
        } else if (nType.includes("event_signup")) {
          icon = Ticket;
          iconName = "Ticket";
          iconColor = "bg-emerald-500/10 text-emerald-600";
        } else if (nType.includes("check")) {
          icon = CheckCircle;
          iconName = "CheckCircle";
        }
        activities.push({
          id: `notif-${n.id}`,
          type: "notification",
          title: n.message || "System update",
          subtitle: nType.replace(/_/g, " "),
          time: new Date(n.created_at),
          status: "new",
          icon,
          iconName,
          iconColor,
        });
      });

      // Sort and set
      const sortedActivities = activities.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 15);
      setRecentActivities(sortedActivities);

      setRevenueData(processedRev);
      setAttendanceData(processedAtt);
      setSignupData(processedSignup);
      setMembershipData(Object.entries(mixMap).map(([name, value]) => ({ name, value })));

      // ========================================
      // RETENTION CALCULATION - MULTI-METRIC SYSTEM (ALL-TIME)
      // ========================================

      // CRITICAL FIX: Calculate retention across ALL TIME, not just current period
      // This prevents false 100% retention when no members expired recently

      // 1. Get members whose memberships have EXPLICITLY expired
      // IMPORTANT: `renewal_due_date` is a DATE column; use YYYY-MM-DD (not full ISO timestamps) in filters.
      const todayStr = format(now, "yyyy-MM-dd");
      const { data: expiredWithDates } = await supabase
        .from("users")
        .select("id, renewal_due_date, created_at, name, email, membership_type")
        .eq("role", "member")
        .eq("gym_id", user.gymId)
        .not("renewal_due_date", "is", null)
        .lte("renewal_due_date", todayStr);

      // 2. Get members who joined long ago and have NO expiry date
      // We calculate fallback expiry thresholds based on membership type
      const startOfToday = todayStr;
      const thirtyDaysAgo = format(subDays(now, 31), "yyyy-MM-dd");

      // Grabbing all members with NULL expiry to filter them more accurately in JS
      const { data: potentialFallbackLapses } = await supabase
        .from("users")
        .select("id, name, membership_expiry, created_at, membership_type")
        .eq("role", "member")
        .eq("gym_id", user.gymId)
        .is("membership_expiry", null);

      const expiredWithoutDates = (potentialFallbackLapses || []).filter(member => {
        const joinDate = member.created_at;
        const typeStr = (member.membership_type || "").toLowerCase();
        const isDayPass = typeStr.includes("day");

        if (isDayPass) {
          // Day Pass expires at midnight, so if they joined any time BEFORE today, they are expired
          return joinDate < startOfToday;
        } else {
          // Standard members expire after 31 days
          return joinDate < thirtyDaysAgo;
        }
      });

      const allExpiredMembers = [...(expiredWithDates || []), ...expiredWithoutDates];

      // 3. Optimized renewal processing (bulk matching instead of query-storm)
      let totalRenewed = 0;
      if (allExpiredMembers.length > 0) {
        const expiredMap = new Map();
        let earliestExpiry = now.toISOString();

        allExpiredMembers.forEach(m => {
          let expiry = m.renewal_due_date;
          if (!expiry && m.created_at) {
            const date = new Date(m.created_at);
            const isDay = (m.membership_type || "").toLowerCase().includes("day");
            if (isDay) date.setDate(date.getDate() + 1);
            else date.setDate(date.getDate() + 31);
            expiry = date.toISOString();
          }
          if (expiry?.length === 10) expiry += "T23:59:59";
          if (expiry) {
            expiredMap.set(m.id, expiry);
            if (expiry < earliestExpiry) earliestExpiry = expiry;
          }
        });

        const ids = Array.from(expiredMap.keys());
        const renewalResults = [];

        // Batch IDs for Supabase .in() query
        for (let i = 0; i < ids.length; i += 60) {
          const batch = ids.slice(i, i + 60);
          const { data: batchPays } = await supabase
            .from("payments")
            .select("user_id, member_id, paid_at")
            .in("status", ["completed", "approved", "success", "paid"])
            .gte("paid_at", earliestExpiry)
            .or(`user_id.in.(${batch.join(',')}),member_id.in.(${batch.join(',')})`);
          if (batchPays) renewalResults.push(...batchPays);
        }

        const renewedIds = new Set();
        renewalResults.forEach(p => {
          const uid = p.user_id || p.member_id;
          if (expiredMap.has(uid) && p.paid_at >= expiredMap.get(uid)) {
            renewedIds.add(uid);
          }
        });
        totalRenewed = renewedIds.size;
      }
      const totalExpired = allExpiredMembers?.length || 0;

      // 3. Calculate members at start of period (for churn)
      const { count: membersAtPeriodStart } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "member")
        .eq("membership_status", "Active")
        .eq("gym_id", user.gymId)
        .lt("created_at", startDate.toISOString());

      // 4. Members who became inactive in this period
      const { count: membersLost } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "member")
        .eq("membership_status", "Inactive")
        .eq("gym_id", user.gymId)
        .gte("updated_at", startDate.toISOString());

      // 5. Members expiring in next 30 days (at-risk)
      const thirtyDaysOut = new Date();
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

      const { data: atRiskMembers } = await supabase
        .from("users")
        .select("id, name, email, renewal_due_date")
        .eq("role", "member")
        .eq("membership_status", "Active")
        .eq("gym_id", user.gymId)
        .gte("renewal_due_date", new Date().toISOString())
        .lte("renewal_due_date", thirtyDaysOut.toISOString())
        .order("renewal_due_date", { ascending: true });

      // 6. Members expiring this month (for monthly tracking)
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const { count: expiringThisMonthCount } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "member")
        .eq("membership_status", "Active")
        .eq("gym_id", user.gymId)
        .gte("renewal_due_date", monthStart.toISOString())
        .lte("renewal_due_date", monthEnd.toISOString());
      // ========================================
      // CALCULATE ALL RETENTION METRICS
      // ========================================

      // Classic Retention (ALL-TIME renewal-based) - PRIMARY METRIC
      // Shows the overall renewal rate across the gym's entire history
      const classicRetention = totalExpired > 0
        ? (totalRenewed / totalExpired) * 100
        : 0; // 0% if no one has expired yet (not 100%!)

      // Active Member Rate (current simple calculation)
      const activeMemberRate = totalMembers > 0
        ? (activeMembers / totalMembers) * 100
        : 0;

      // Churn Rate (% of members lost in current period)
      const churnRate = (membersAtPeriodStart || 1) > 0
        ? ((membersLost || 0) / (membersAtPeriodStart || 1)) * 100
        : 0;

      // Renewal Rate (same as classic retention for all-time)
      const renewalRate = totalExpired > 0
        ? (totalRenewed / totalExpired) * 100
        : 0;

      const statsPayload = {
        totalMembers: totalMembers || 0,
        activeMembers: activeMembers || 0,
        checkinsToday: (attLogs || []).filter(l => format(new Date(l.checkInTime), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')).length,
        monthlyRevenue: monthlyRev,
        pendingAmount: pending,
        newSignups: newSignups || 0,
        retention: Math.round(classicRetention),
        activeMemberRate: Math.round(activeMemberRate),
        churnRate: Math.round(churnRate * 10) / 10,
        renewalRate: Math.round(renewalRate),
        atRiskCount: atRiskMembers?.length || 0,
        expiringThisMonth: expiringThisMonthCount || 0,
        monthlyRevenueTarget
      };
      setStats(statsPayload);

      // Offline-first: persist last successful dashboard response for instant load on next open
      try {
        const cacheKey = getDashboardCacheKey(user.gymId ?? user.id);
        const cachePayload = {
          stats: statsPayload,
          revenueData: processedRev,
          signupData: processedSignup,
          attendanceData: processedAtt,
          membershipData: Object.entries(mixMap).map(([name, value]) => ({ name, value })),
          genderData: genderSeries,
          ageData: ageSeries,
          rawPaymentsData: mappedPayments.map((p: any) => ({
            ...p,
            resolvedDate: p.resolvedDate?.toISOString?.() ?? p.resolvedDate,
          })),
          gymPlanNames: planNames,
          planIdToName: Object.fromEntries(planMap),
          dateRange,
          recentActivities: sortedActivities.map((a: any) => ({
            id: a.id,
            type: a.type,
            title: a.title,
            subtitle: a.subtitle,
            time: a.time.toISOString(),
            status: a.status,
            iconName: a.iconName || "Bell",
            iconColor: a.iconColor,
          })),
        };
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
        }
      } catch (cacheErr) {
        console.warn("[Dashboard] Cache write failed:", cacheErr);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Data sync issue", description: "Dashboard showing cached data", variant: "destructive" });
    } finally {
      setDataLoading(false);
    }
  }

  // Derived filtered data for charts — filter by actual plan name
  const filteredRevenueData = (() => {
    const successfulPayments = rawPaymentsData.filter(p =>
      ["completed", "approved", "success", "paid"].includes(p.resolvedStatus) &&
      (selectedPlan === "All" || resolvePlanName(p, planIdToName) === selectedPlan)
    );

    const now = new Date();
    let startDate;
    let isLargeRange = false;

    if (customStartDate && customEndDate) {
      startDate = customStartDate;
      isLargeRange = differenceInDays(customEndDate, customStartDate) > 60;
    } else {
      switch (dateRange) {
        case "7d": startDate = subDays(now, 7); break;
        case "90d": startDate = subDays(now, 90); isLargeRange = true; break;
        case "ytd": startDate = startOfYear(now); isLargeRange = true; break;
        case "month": startDate = startOfMonth(now); break;
        default: startDate = subDays(now, 30); break;
      }
    }
    const endDate = customEndDate || now;
    const interval = isLargeRange ? eachMonthOfInterval({ start: startDate, end: endDate }) : eachDayOfInterval({ start: startDate, end: endDate });

    return interval.map(date => {
      const dStr = format(date, isLargeRange ? "yyyy-MM" : "yyyy-MM-dd");
      const total = successfulPayments
        .filter(p => format(p.resolvedDate, isLargeRange ? "yyyy-MM" : "yyyy-MM-dd") === dStr)
        .reduce((s, p) => s + p.amount, 0);
      return { date: format(date, isLargeRange ? "MMM" : "MMM dd"), amount: total };
    });
  })();

  const exportDashboardPDF = async () => {
    setExporting(true);
    try {
      const gymName = await fetchGymNameForReport(user?.gymId || (user as any)?.gym_id);
      const safeFilename = gymName.replace(/[^a-zA-Z0-9_-]/g, '_');

      const doc = new jsPDF('p', 'mm', 'a4') as any;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Premium Design Tokens
      const Gymzprimary: [number, number, number] = [42, 75, 42]; // #2A4B2A
      const GymzDarkprimary: [number, number, number] = [27, 46, 27]; // #1B2E1B
      const subtleGray: [number, number, number] = [248, 248, 252];
      const adminName = user?.name || user?.email || 'Admin';

      const drawHeader = (pageDoc: any, title: string) => {
        // Main Header Bar
        pageDoc.setFillColor(...Gymzprimary);
        pageDoc.rect(0, 0, pageWidth, 45, 'F');

        // Accent bar
        pageDoc.setFillColor(...GymzDarkprimary);
        pageDoc.rect(0, 45, pageWidth, 2, 'F');

        // Gym Name (primary, prominent)
        pageDoc.setTextColor(255, 255, 255);
        pageDoc.setFontSize(22);
        pageDoc.setFont(undefined, 'bold');
        pageDoc.text(gymName, 15, 18);

        // "Powered by Gymz AI" (very subtle)
        pageDoc.setFontSize(6);
        pageDoc.setFont(undefined, 'normal');
        pageDoc.setTextColor(150, 170, 150);
        pageDoc.text('Powered by Gymz AI', 15, 23);

        // Report Title
        pageDoc.setFontSize(12);
        pageDoc.setTextColor(255, 255, 255);
        pageDoc.text(title.toUpperCase(), 15, 32);

        // Metadata
        pageDoc.setFontSize(9);
        pageDoc.setTextColor(220, 220, 220);
        pageDoc.text(`GEN: ${format(new Date(), 'dd MMM yyyy | HH:mm')} by ${adminName}`, pageWidth - 15, 20, { align: 'right' });
        pageDoc.text(`PERIOD: ${dateRange.toUpperCase()}`, pageWidth - 15, 26, { align: 'right' });
      };

      const drawFooter = (pageDoc: any, pageNum: number, total: number) => {
        pageDoc.setFillColor(...subtleGray);
        pageDoc.rect(0, pageHeight - 20, pageWidth, 20, 'F');

        // Border line
        pageDoc.setDrawColor(230, 230, 230);
        pageDoc.line(0, pageHeight - 20, pageWidth, pageHeight - 20);

        pageDoc.setTextColor(140, 140, 140);
        pageDoc.setFontSize(7);
        pageDoc.text(`Generated by ${adminName}  ·  Powered by Gymz AI`, 15, pageHeight - 10);
        pageDoc.text(`CONFIDENTIAL | Page ${pageNum} of ${total}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
      };

      // --- PAGE 1: EXECUTIVE SUMMARY ---
      drawHeader(doc, 'Executive Performance Summary');

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Key Business Metrics', 15, 65);

      const summaryMetrics = [
        ['Total Members', stats.totalMembers.toString()],
        ['Active Members', stats.activeMembers.toString()],
        ['Revenue', formatCurrency(stats.monthlyRevenue)],
        ['Retention Rate', `${stats.retention}%`],
        ['New Signups', stats.newSignups.toString()],
        ['Check-ins Today', stats.checkinsToday.toString()]
      ];

      autoTable(doc, {
        startY: 72,
        head: [['Metric Segment', 'Current Value']],
        body: summaryMetrics,
        theme: 'grid',
        headStyles: { fillColor: Gymzprimary, fontSize: 11, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [250, 250, 252] } },
        margin: { left: 15, right: 15 }
      });

      // --- ANALYTICAL PAGES ---
      const reports = [
        { id: 'rev-chart', title: 'Financial Growth & Revenue realized' },
        { id: 'att-chart', title: 'Attendance Engagement Analytics' },
        { id: 'mix-chart', title: 'Community Distribution (Membership Mix)' },
        { id: 'signup-chart', title: 'Acquisition & Registration Velocity' },
        { id: 'system-summary', title: 'Health Metrics & Retention snapshot' }
      ];

      for (const report of reports) {
        const el = document.getElementById(report.id);
        if (el) {
          try {
            const canvas = await html2canvas(el, {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false
            });
            const img = canvas.toDataURL('image/png');
            doc.addPage();
            drawHeader(doc, 'Detailed Analytics');

            doc.setTextColor(40, 40, 40);
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text(report.title, 15, 65);

            // Proportional layout for premium look
            const usableWidth = pageWidth - 30;
            const canvasAR = canvas.width / canvas.height;
            let imgWidth = usableWidth;
            let imgHeight = usableWidth / canvasAR;

            // Cap height to leave room for footer and spacing
            const maxChartHeight = pageHeight - 120;
            if (imgHeight > maxChartHeight) {
              imgHeight = maxChartHeight;
              imgWidth = maxChartHeight * canvasAR;
            }

            const xOffset = 15 + (usableWidth - imgWidth) / 2;
            doc.addImage(img, 'PNG', xOffset, 75, imgWidth, imgHeight);

            // Add a clean border around graphs
            doc.setDrawColor(240, 240, 245);
            doc.setLineWidth(0.5);
            doc.rect(xOffset - 2, 73, imgWidth + 4, imgHeight + 4);

          } catch (chartErr) {
            console.error(`Report capture failed for ${report.id}:`, chartErr);
          }
        }
      }

      // Add footers to every page
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(doc, i, totalPages);
      }

      doc.save(`${safeFilename}_Premium_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      toast({ title: "Premium Report Ready", description: "Your high-fidelity performance statement has been generated." });
    } catch (e) {
      console.error("Dashboard PDF Error:", e);
      toast({ title: "Export Failed", description: "Could not generate premium statement. Please try again.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleMonthSelect = (month: number) => {
    setSelectedMonth(month);
    const start = new Date(selectedYear, month, 1);
    const end = new Date(selectedYear, month + 1, 0);
    setCustomStartDate(start);
    setCustomEndDate(end);
  };

  // Auth loading: full-screen spinner (no user yet)
  if (loading) return <div className="flex h-screen items-center justify-center bg-mesh-glow"><RefreshCw className="animate-spin h-8 w-8 text-primary" /></div>;

  // Data loading: show layout skeleton so dashboard doesn't feel blank
  if (dataLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6 pb-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 px-1">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-11 w-40 rounded-xl" />
            <Skeleton className="h-11 w-36 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="lg:col-span-2 h-[420px] rounded-2xl" />
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
        <div className="flex items-center justify-center gap-2 py-8">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground font-medium">Loading your dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6 px-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-xs font-medium text-muted-foreground/70 mt-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live Tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={exportDashboardPDF} disabled={exporting} className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-modern-lg px-6 h-11 transition-all hover:scale-105 active:scale-95">
            {exporting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export Analytics
          </Button>
        </div>
      </div>

      <QuickActions />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Members" value={stats.totalMembers} icon={Users} trend="neutral" />
        <StatsCard title="Today's Check-ins" value={stats.checkinsToday} subtitle="Attendance" icon={CheckCircle} trend="up" />
        <StatsCard title="Monthly Revenue" value={formatCurrency(stats.monthlyRevenue)} subtitle="Revenue" icon={DollarSign} trend="up" />
        <StatsCard title="New Signups" value={`+${stats.newSignups}`} subtitle="Acquisition" icon={TrendingUp} trend="up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 glass-card overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4 pb-0">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500/20" />
                {selectedPlan === "All" ? "Revenue Trend" : `${selectedPlan} Revenue`}
              </CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {(["All", ...new Set([...gymPlanNames, ...membershipData.map(m => m.name)].filter(Boolean))]).map((plan, idx) => {
                  const isActive = selectedPlan === plan;
                  const color = plan === "All" ? "hsl(var(--primary))" : getPlanColor(plan, idx, planColorMap);
                  return (
                    <button
                      key={plan}
                      onClick={() => setSelectedPlan(plan)}
                      className={`px-3 py-1 text-[9px] font-bold rounded-lg transition-all border ${isActive
                        ? "text-white shadow-md scale-105"
                        : "text-muted-foreground hover:text-foreground opacity-60 border-transparent bg-stone-100/10"
                        }`}
                      style={{
                        backgroundColor: isActive ? color : undefined,
                        borderColor: isActive ? color : undefined
                      }}
                    >
                      {plan.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap ml-auto">
              <div className="flex bg-stone-100/10 backdrop-blur-md p-1 rounded-xl border border-white/5 items-center gap-1">
                {["7d", "30d", "90d", "ytd"].map((r) => (
                  <button
                    key={r}
                    onClick={() => { setDateRange(r); setCustomStartDate(null); setCustomEndDate(null); }}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${dateRange === r && !customStartDate ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground opacity-60"}`}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`text-[10px] font-bold h-8 px-3 rounded-lg border-stone-200/20 ${customStartDate ? 'bg-primary text-white border-primary' : 'bg-stone-500/5'}`}
                  >
                    <Calendar className="h-3 w-3 mr-1.5" />
                    {customStartDate && customEndDate
                      ? `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d')}`
                      : 'CUSTOM'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Tabs defaultValue="month" value={pickerMode} onValueChange={setPickerMode} className="w-full">
                    <div className="p-3 border-b">
                      <div className="text-sm font-semibold mb-2">Select Date Range</div>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="month">Month</TabsTrigger>
                        <TabsTrigger value="range">Date Range</TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="month" className="p-3 mt-0 space-y-3">
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">Select Year</div>
                        <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">Select Month</div>
                        <div className="grid grid-cols-3 gap-2">
                          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                            <Button
                              key={month}
                              variant={selectedMonth === idx ? "default" : "outline"}
                              size="sm"
                              className="text-xs"
                              onClick={() => handleMonthSelect(idx)}
                            >
                              {month}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <Button
                        className="w-full font-bold"
                        size="sm"
                        onClick={() => { setDateRange('custom'); setDatePickerOpen(false); }}
                        disabled={selectedMonth === null}
                      >
                        Apply Selection
                      </Button>
                    </TabsContent>

                    <TabsContent value="range" className="p-3 mt-0 space-y-3">
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1 font-bold">START DATE</div>
                          <CalendarComponent
                            mode="single"
                            selected={customStartDate}
                            onSelect={(date) => setCustomStartDate(date)}
                            initialFocus
                          />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1 font-bold">END DATE</div>
                          <CalendarComponent
                            mode="single"
                            selected={customEndDate}
                            onSelect={(date) => setCustomEndDate(date)}
                            disabled={(date) => customStartDate ? date < customStartDate : false}
                          />
                        </div>
                      </div>
                      <Button
                        className="w-full font-bold"
                        size="sm"
                        onClick={() => { setDateRange('custom'); setDatePickerOpen(false); }}
                        disabled={!customStartDate || !customEndDate}
                      >
                        Apply Range
                      </Button>
                    </TabsContent>
                  </Tabs>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent id="rev-chart" className="h-[360px] p-5 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredRevenueData}>
                <defs>
                  <linearGradient id="cDynamic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={selectedPlan === "All" ? "hsl(var(--primary))" : getPlanColor(selectedPlan, 0, planColorMap)} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={selectedPlan === "All" ? "hsl(var(--primary))" : getPlanColor(selectedPlan, 0, planColorMap)} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 700 }} tickFormatter={v => `K${v}`} />
                <Tooltip
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', color: '#fff', borderRadius: '16px', border: 'none', backdropFilter: 'blur(8px)', padding: '12px' }}
                  itemStyle={{ fontWeight: 900 }}
                />
                <Area type="monotone" dataKey="amount" stroke={selectedPlan === "All" ? "hsl(var(--primary))" : getPlanColor(selectedPlan, 0, planColorMap)} fill="url(#cDynamic)" strokeWidth={4} fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card flex flex-col relative overflow-hidden border-primary/10">
          <CardHeader className="pb-0"><CardTitle className="text-lg font-bold tracking-tight">Membership Mix</CardTitle></CardHeader>
          <CardContent id="mix-chart" className="flex-1 flex flex-col justify-center items-center pb-8 pt-4 min-h-[320px]">
            <div className="h-[280px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={membershipData}
                    innerRadius={75}
                    outerRadius={105}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                    onClick={(data) => {
                      if (data && data.name) {
                        setSelectedPlan(data.name === selectedPlan ? "All" : data.name);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {membershipData.map((m, i) => (
                      <Cell
                        key={i}
                        fill={planColorMap[m.name] ?? PLAN_PALETTE[i % PLAN_PALETTE.length]}
                        fillOpacity={selectedPlan === "All" || selectedPlan === m.name ? 1 : 0.2}
                        className="transition-all duration-500"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'rgba(0,0,0,0.85)', border: 'none', borderRadius: '16px', color: '#fff', backdropFilter: 'blur(8px)' }}
                    itemStyle={{ color: '#fff', fontWeight: 900 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-foreground tracking-tighter">
                  {membershipData.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
                <span className="text-[9px] uppercase font-bold text-muted-foreground/60 tracking-[0.2em] mt-1">Total Sales</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-5 w-full px-8 mt-4">
              {membershipData.map((m, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 transition-all cursor-pointer ${selectedPlan !== "All" && selectedPlan !== m.name ? "opacity-30 grayscale" : "opacity-100"}`}
                  onClick={() => setSelectedPlan(m.name === selectedPlan ? "All" : m.name)}
                >
                  <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: planColorMap[m.name] ?? PLAN_PALETTE[i % PLAN_PALETTE.length] }} />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/50 tracking-widest leading-none">{m.name}</span>
                    <span className="text-xl font-bold leading-tight tabular-nums">{m.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-card overflow-hidden">
          <CardHeader><CardTitle className="text-lg">Attendance Trends</CardTitle></CardHeader>
          <CardContent id="att-chart" className="h-[260px] p-5 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceData}>
                <defs><linearGradient id="cAtt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 700 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', color: '#fff', borderRadius: '16px', border: 'none', backdropFilter: 'blur(8px)', padding: '12px' }}
                  itemStyle={{ fontWeight: 900 }}
                />
                <Area type="monotone" dataKey="count" stroke="#10b981" fill="url(#cAtt)" strokeWidth={4} fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden">
          <CardHeader><CardTitle className="text-lg">Gender Distribution</CardTitle></CardHeader>
          <CardContent className="h-[260px] p-5 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  stroke="none"
                >
                  {genderData.map((g: any, i: number) => (
                    <Cell
                      key={g.name}
                      fill={PLAN_PALETTE[i % PLAN_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(0,0,0,0.85)', border: 'none', borderRadius: '16px', color: '#fff', backdropFilter: 'blur(8px)' }}
                  itemStyle={{ color: '#fff', fontWeight: 900 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden">
          <CardHeader><CardTitle className="text-lg">Age Distribution</CardTitle></CardHeader>
          <CardContent className="h-[260px] p-5 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {ageData.map((a: any, i: number) => (
                    <Cell key={a.name} fill={PLAN_PALETTE[i % PLAN_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card id="system-summary" className="glass-card bg-gradient-to-br from-primary/[0.02] to-transparent overflow-hidden border-primary/10 lg:col-span-3">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              System Vitality
            </CardTitle>
            <p className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest mt-0.5">System Health</p>
          </CardHeader>
          <CardContent className="space-y-7">
            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-muted-foreground">Monthly Target Progress</span>
                <span className="text-primary">{stats.monthlyRevenueTarget > 0 ? Math.round((stats.monthlyRevenue / stats.monthlyRevenueTarget) * 100) : 0}%</span>
              </div>
              <div className="h-2.5 w-full bg-stone-200 dark:bg-stone-900 rounded-full overflow-hidden shadow-inner p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-primary via-primary/80 to-secondary rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                  style={{ width: `${Math.min(100, stats.monthlyRevenueTarget > 0 ? (stats.monthlyRevenue / stats.monthlyRevenueTarget) * 100 : 0)}%` }}
                />
              </div>
            </div>

            {/* Enhanced Retention Metrics */}
            <div className="grid grid-cols-2 gap-4">
              {/* Primary: Classic Retention Rate */}
              <div className="p-4 bg-background/40 rounded-2xl border border-white/5 shadow-sm group hover:border-primary/20 transition-colors">
                <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-tighter mb-1.5">Retention Rate</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold tabular-nums text-primary">
                    {stats.retention}%
                  </p>
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <p className="text-[9px] mt-1.5 font-bold uppercase tracking-widest text-primary/80">
                  {stats.retention >= 80 ? 'Optimal' : stats.retention >= 70 ? 'Stable' : 'Monitoring'}
                </p>
              </div>

              {/* Churn Rate */}
              <div className="p-4 bg-background/40 rounded-2xl border border-white/5 shadow-sm group hover:border-primary/20 transition-colors">
                <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-tighter mb-1.5">Churn Velocity</p>
                <p className="text-2xl font-bold tabular-nums text-primary">
                  {stats.churnRate}%
                </p>
                <p className="text-[9px] text-muted-foreground/40 mt-1.5 font-bold uppercase tracking-widest">At-risk members</p>
              </div>
            </div>

            {/* At-Risk Members Alert */}
            {
              stats.atRiskCount > 0 && (
                <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3 shadow-sm">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-primary mb-0.5">
                      {stats.atRiskCount} Expirations Imminent
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground/70 leading-tight">
                      System recommends immediate outreach strategies.
                    </p>
                  </div>
                </div>
              )
            }

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border/10">
              <div className="space-y-1">
                <p className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-widest">Active Rate</p>
                <p className="text-xl font-bold tabular-nums">{stats.activeMemberRate}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-widest">Unrealized Rev</p>
                <p className="text-xl font-bold text-amber-500 tabular-nums">{formatCurrency(stats.pendingAmount)}</p>
              </div>
            </div>
          </CardContent >
        </Card >
      </div >

      {/* Retention Improvement Strategies - Show when retention needs attention or members at risk */}
      {
        (stats.retention < 80 || stats.atRiskCount > 0) && (
          <RetentionStrategies retention={stats.retention} />
        )
      }

      {/* Registration Trend / Signup Velocity */}
      <Card className="glass-card overflow-hidden border-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Registration Velocity
          </CardTitle>
          <p className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">Signups over time</p>
        </CardHeader>
        <CardContent id="signup-chart" className="h-[260px] p-5 pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={signupData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(var(--primary), 0.05)' }}
                contentStyle={{ background: 'rgba(0,0,0,0.85)', border: 'none', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Activity Audit Section */}
      <Card className="glass-card overflow-hidden border-stone-200/20 shadow-xl">
        <CardHeader className="border-b border-border/10 bg-muted/5 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary animate-spin-slow" />
            Activity Log
          </CardTitle>
          <p className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">Recent Transactions</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/10">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="p-4 flex items-center justify-between hover:bg-primary/[0.03] transition-all duration-300 group">
                  <div className="flex items-center gap-5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${activity.iconColor} shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                      <activity.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold tracking-tight text-foreground/90 mb-0.5">{activity.title}</h5>
                      <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-tight opacity-70">{activity.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground/60 tracking-widest mb-1.5">{formatDistanceToNow(activity.time)} ago</p>
                    <Badge variant="outline" className={`text-[9px] h-5 px-2.5 font-bold border-none bg-stone-100 dark:bg-stone-800/50 capitalize rounded-md tracking-wider`}>
                      {activity.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-20 text-center space-y-6">
                <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Zap className="h-10 w-10 text-muted-foreground opacity-20" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-lg font-bold text-foreground mb-1">Audit Clear</p>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">No recent system records detected. The environment is currently operating in idle state.</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div >
  );
}
