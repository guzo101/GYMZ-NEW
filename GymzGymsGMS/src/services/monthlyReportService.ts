/**
 * Automatic Monthly Report Generation Service
 *
 * Generates and downloads ALL GMS records as a comprehensive archive.
 * Triggered on the 1st day of each month (morning) or via Test button.
 *
 * Reports: Dashboard, Finance, Members, Attendance, Events, Staff, Support Inquiries
 */

import { format, startOfMonth, subMonths } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { addBrandedHeader, fetchGymNameForReport } from "@/lib/pdfBranding";
import { formatCurrency } from "@/lib/utils";
import { fetchGymPlans } from "./gymPricing";

const STORAGE_KEY = "gms_monthly_report_last_run";
const MORNING_CUTOFF_HOUR = 12;
const TABLE_OPTS = { showHead: "everyPage" as const, styles: { fontSize: 8 } };

const currency = new Intl.NumberFormat("en-ZM", {
  style: "currency",
  currency: "ZMW",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export interface MonthlyReportUser {
  id: string;
  gymId?: string;
  gym_id?: string;
  name?: string;
  email?: string;
  role?: string;
}

export function shouldRunMonthlyReport(): boolean {
  const now = new Date();
  if (now.getDate() !== 1) return false;
  if (now.getHours() >= MORNING_CUTOFF_HOUR) return false;
  try {
    const lastRun = localStorage.getItem(STORAGE_KEY);
    if (lastRun === format(now, "yyyy-MM")) return false;
  } catch {}
  return true;
}

function markMonthlyReportRun(): void {
  try {
    localStorage.setItem(STORAGE_KEY, format(new Date(), "yyyy-MM"));
  } catch {}
}

function getReportPeriodLabel(): string {
  return format(startOfMonth(subMonths(new Date(), 1)), "MMMM yyyy");
}

const Gymzprimary: [number, number, number] = [42, 75, 42];

/** Fetch ALL dashboard stats (all-time) */
async function fetchDashboardStatsAll(gymId: string) {
  const { count: totalMembers } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "member")
    .eq("gym_id", gymId);

  const { count: activeMembers } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "member")
    .eq("membership_status", "Active")
    .eq("gym_id", gymId);

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, status, payment_status, paid_at, payment_date, created_at, description, membership_type, plan_id")
    .eq("gym_id", gymId);

  const gymPlans = await fetchGymPlans(gymId, null);
  const planMap = new Map<string, string>();
  gymPlans.forEach((p) => planMap.set(p.id, p.planName));

  const successfulPayments = (payments || []).filter((p) => {
    const s = (p.status || p.payment_status || "").toLowerCase();
    return ["completed", "approved", "success", "paid"].includes(s);
  });

  const totalRevenue = successfulPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const mixMap: Record<string, number> = {};
  successfulPayments.forEach((p) => {
    const name = (p.plan_id && planMap.get(p.plan_id)) || p.description || p.membership_type || "Other";
    mixMap[name] = (mixMap[name] || 0) + 1;
  });

  const { count: newSignups } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "member")
    .eq("gym_id", gymId);

  const { count: checkinsTotal } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId);

  const { data: expiredWithDates } = await supabase
    .from("users")
    .select("id")
    .eq("role", "member")
    .eq("gym_id", gymId)
    .not("renewal_due_date", "is", null)
    .lte("renewal_due_date", new Date().toISOString());

  const totalExpired = expiredWithDates?.length || 0;
  let totalRenewed = 0;
  if (totalExpired > 0) {
    const ids = (expiredWithDates || []).map((m) => m.id);
    const { data: renewals } = await supabase
      .from("payments")
      .select("user_id, member_id")
      .in("status", ["completed", "approved", "success", "paid"])
      .or(`user_id.in.(${ids.join(",")}),member_id.in.(${ids.join(",")})`);
    totalRenewed = new Set((renewals || []).map((r) => r.user_id || r.member_id).filter(Boolean)).size;
  }
  const retention = totalExpired > 0 ? Math.round((totalRenewed / totalExpired) * 100) : 0;

  return {
    totalMembers: totalMembers || 0,
    activeMembers: activeMembers || 0,
    totalRevenue,
    retention,
    newSignups: newSignups || 0,
    checkinsTotal: checkinsTotal ?? 0,
    membershipMix: Object.entries(mixMap).map(([name, value]) => ({ name, value })),
  };
}

/** Fetch ALL finance transactions */
async function fetchAllFinanceData(gymId: string) {
  const { data: rawPayments } = await supabase
    .from("payments")
    .select("id, amount, status, payment_status, paid_at, payment_date, created_at, user_id, member_id, description, method, plan_id")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false });

  const planMap = new Map<string, string>();
  const gymPlans = await fetchGymPlans(gymId, null);
  gymPlans.forEach((p) => planMap.set(p.id, p.planName));

  const uids = [...new Set((rawPayments || []).map((p) => p.member_id || p.user_id).filter(Boolean))];
  const userMap = new Map<string, { name: string }>();
  if (uids.length > 0) {
    const { data: usersData } = await supabase.from("users").select("id, name").in("id", uids).eq("gym_id", gymId);
    usersData?.forEach((u) => userMap.set(u.id, u));
  }

  const transactions = (rawPayments || []).map((p) => {
    const uid = p.member_id || p.user_id;
    const member = userMap.get(uid);
    const status = (p.status || p.payment_status || "pending").toLowerCase().trim();
    return {
      id: p.id,
      amount: Number(p.amount || 0),
      paymentStatus: status,
      paymentDate: p.payment_date || p.paid_at || p.created_at,
      description: (p.plan_id && planMap.get(p.plan_id)) || p.description || "Subscription",
      method: p.method || "Cash",
      memberName: member?.name || "Unknown",
    };
  });

  const successful = transactions.filter((t) => ["completed", "approved", "success", "paid"].includes(t.paymentStatus));
  const pending = transactions.filter((t) => ["pending", "pending_approval", "pending_verification"].includes(t.paymentStatus));
  const monthlyRevenue = successful.reduce((s, t) => s + t.amount, 0);
  const uniquePaying = new Set(successful.map((t) => t.memberName)).size;

  return {
    transactions,
    stats: {
      monthlyRevenue,
      activeSubscriptions: uniquePaying,
      avgRevenue: uniquePaying > 0 ? monthlyRevenue / uniquePaying : 0,
      pendingAmount: pending.reduce((s, t) => s + t.amount, 0),
    },
  };
}

/** Fetch ALL members */
async function fetchAllMembers(gymId: string) {
  const { data } = await supabase
    .from("users")
    .select("id, name, email, membership_status, unique_id, membership_type, renewal_due_date, points, streak, created_at, join_date, last_payment_date")
    .eq("role", "member")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false });

  return (data || []).map((m) => ({
    uniqueId: m.unique_id || "---",
    name: m.name || m.email || "---",
    membershipType: (m.membership_type || "—").toUpperCase(),
    membershipStatus: (m.membership_status || "Inactive").toUpperCase(),
    renewalDueDate: m.renewal_due_date || null,
    points: Number(m.points || 0),
    streak: Number(m.streak || 0),
    registrationDate: m.join_date || m.created_at || null,
    lastPaidDate: m.last_payment_date || null,
  }));
}

/** Fetch ALL attendance */
async function fetchAllAttendance(gymId: string) {
  const { data } = await supabase
    .from("attendance")
    .select("id, user_id, check_in_time, check_out_time, status")
    .eq("gym_id", gymId)
    .order("check_in_time", { ascending: false });

  const uids = [...new Set((data || []).map((a) => a.user_id).filter(Boolean))];
  const userMap = new Map<string, string>();
  if (uids.length > 0) {
    const { data: usersData } = await supabase.from("users").select("id, name").in("id", uids).eq("gym_id", gymId);
    usersData?.forEach((u) => userMap.set(u.id, u.name || "Unknown"));
  }

  return (data || []).map((a) => ({
    memberName: userMap.get(a.user_id) || "Unknown",
    checkInTime: a.check_in_time,
    checkOutTime: a.check_out_time,
    status: a.status || "checked_in",
  }));
}

/** Fetch ALL events with attendees */
async function fetchAllEvents(gymId: string) {
  const { data: eventsData } = await supabase
    .from("events")
    .select("id, title, event_date, location, is_free, price, is_active")
    .eq("gym_id", gymId)
    .order("event_date", { ascending: false });

  const events = (eventsData || []).map((e) => ({
    id: e.id,
    title: e.title || "Untitled",
    eventDate: e.event_date,
    location: e.location || "—",
    isFree: e.is_free,
    price: e.price,
    isActive: e.is_active,
  }));

  // Fetch all event attendees (event_rsvps joined with users)
  const eventIds = events.map((e) => e.id);
  const attendeesByEvent = new Map<string, { name: string; status: string; rsvpDate: string }[]>();

  if (eventIds.length > 0) {
    const { data: rsvps } = await supabase
      .from("event_rsvps")
      .select("event_id, user_id, status, created_at")
      .in("event_id", eventIds)
      .eq("gym_id", gymId);

    const userIds = [...new Set((rsvps || []).map((r) => r.user_id).filter(Boolean))];
    const userMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase.from("users").select("id, name").in("id", userIds);
      usersData?.forEach((u) => userMap.set(u.id, u.name || "Unknown"));
    }

    (rsvps || []).forEach((r) => {
      const list = attendeesByEvent.get(r.event_id) || [];
      list.push({
        name: userMap.get(r.user_id) || "Unknown",
        status: (r.status || "confirmed").toUpperCase(),
        rsvpDate: r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy") : "—",
      });
      attendeesByEvent.set(r.event_id, list);
    });
  }

  return events.map((e) => ({
    ...e,
    attendees: attendeesByEvent.get(e.id) || [],
  }));
}

/** Fetch ALL staff */
async function fetchAllStaff(gymId: string) {
  const { data } = await supabase
    .from("users")
    .select("id, name, email, phone, status")
    .eq("gym_id", gymId)
    .eq("role", "staff")
    .order("name");

  return (data || []).map((s) => ({
    name: s.name || "—",
    email: s.email || "—",
    phone: s.phone || "—",
    status: s.status || "Active",
  }));
}

/** Fetch support inquiries */
async function fetchAllInquiries(_gymId: string) {
  try {
    const { data } = await supabase
      .from("website_inquiries")
      .select("id, full_name, email, message, status, source, created_at")
      .order("created_at", { ascending: false });
    return (data || []).map((i: any) => ({
      fullName: i.full_name || "—",
      email: i.email || "—",
      message: (i.message || "").slice(0, 200),
      status: i.status || "new",
      source: i.source || "—",
      createdAt: i.created_at,
    }));
  } catch {
    return [];
  }
}

function ensureNonEmpty<T>(arr: T[], placeholder: T[]): T[] {
  return arr.length > 0 ? arr : placeholder;
}

function addDashboardSection(
  doc: any,
  gymName: string,
  stats: Awaited<ReturnType<typeof fetchDashboardStatsAll>>,
  periodLabel: string,
  adminName: string
): void {
  const startY = addBrandedHeader(doc, gymName, "Dashboard Performance Summary", `Full Archive · Generated ${periodLabel}`, adminName);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(14);
  doc.text("Key Business Metrics (All-Time)", 15, startY + 5);

  const summaryMetrics = [
    ["Platform Members", stats.totalMembers.toString()],
    ["Active Community", stats.activeMembers.toString()],
    ["Total Revenue", formatCurrency(stats.totalRevenue)],
    ["Loyalty Retention", `${stats.retention}%`],
    ["Total Signups (All-Time)", stats.newSignups.toString()],
    ["Total Check-ins", stats.checkinsTotal.toString()],
  ];

  autoTable(doc, {
    startY: startY + 10,
    head: [["Metric", "Value"]],
    body: summaryMetrics,
    theme: "grid",
    headStyles: { fillColor: Gymzprimary, fontSize: 11, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 5 },
    margin: { left: 15, right: 15 },
  });

  if (stats.membershipMix.length > 0) {
    doc.addPage("p", "a4");
    doc.setFontSize(14);
    doc.text("Membership Mix", 15, 20);
    const mixData = stats.membershipMix.map((m) => [m.name, m.value.toString()]);
    autoTable(doc, {
      startY: 25,
      head: [["Plan", "Count"]],
      body: mixData,
      theme: "striped",
      headStyles: { fillColor: Gymzprimary },
      styles: { fontSize: 10 },
      margin: { left: 15 },
    });
  }
}

function addFinanceSection(
  doc: any,
  gymName: string,
  financeData: Awaited<ReturnType<typeof fetchAllFinanceData>>,
  periodLabel: string,
  adminName: string
): void {
  doc.addPage("p", "a4");
  const { stats, transactions } = financeData;

  const startY = addBrandedHeader(doc, gymName, "Finance Report", `Full Transaction History · Generated ${periodLabel}`, adminName);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("Performance Summary", 15, startY + 5);

  const summaryData = [
    ["Total Revenue", currency.format(stats.monthlyRevenue)],
    ["Active Customers", stats.activeSubscriptions.toString()],
    ["Avg. Value", currency.format(stats.avgRevenue)],
    ["Pending Amount", currency.format(stats.pendingAmount)],
  ];

  autoTable(doc, {
    startY: startY + 10,
    head: [["Metric", "Value"]],
    body: summaryData,
    theme: "striped",
    headStyles: { fillColor: Gymzprimary },
  });

  doc.addPage("p", "a4");
  doc.text("Transaction History (All Records)", 15, 20);

  const tableData = ensureNonEmpty(
    transactions.map((t) => [
      format(new Date(t.paymentDate), "MMM dd, yyyy"),
      t.memberName,
      t.description,
      t.method,
      t.paymentStatus.toUpperCase(),
      currency.format(t.amount),
    ]),
    [["No transactions", "—", "—", "—", "—", "—"]]
  );

  autoTable(doc, {
    startY: 25,
    head: [["Date", "Member", "Plan", "Method", "Status", "Amount"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: Gymzprimary },
    ...TABLE_OPTS,
  });
}

function addMembersSection(
  doc: any,
  gymName: string,
  members: Awaited<ReturnType<typeof fetchAllMembers>>,
  periodLabel: string,
  adminName: string
): void {
  doc.addPage("l", "a4");

  const startY = addBrandedHeader(doc, gymName, "Member Registry", `Full Snapshot · Generated ${periodLabel}`, adminName);

  const activeCount = members.filter((m) => m.membershipStatus === "Active").length;
  const totalPoints = members.reduce((s, m) => s + m.points, 0);
  const avgStreak = members.length > 0 ? (members.reduce((s, m) => s + m.streak, 0) / members.length).toFixed(1) : "0.0";

  autoTable(doc, {
    startY: 55,
    head: [["Metric", "Value"]],
    body: [
      ["Total Members", members.length.toString()],
      ["Active Memberships", activeCount.toString()],
      ["Registry Total Points", totalPoints.toLocaleString()],
      ["Registry Average Streak", avgStreak],
    ],
    theme: "striped",
    headStyles: { fillColor: Gymzprimary },
    styles: { fontSize: 9 },
    margin: { left: 15 },
  });

  const tableData = ensureNonEmpty(
    members.map((m) => [
      m.uniqueId,
      m.name,
      m.membershipType,
      m.membershipStatus,
      m.registrationDate ? format(new Date(m.registrationDate), "dd/MM/yyyy") : "---",
      m.lastPaidDate ? format(new Date(m.lastPaidDate), "dd/MM/yyyy") : "---",
      m.renewalDueDate ? format(new Date(m.renewalDueDate), "dd/MM/yyyy") : "---",
      m.points.toString(),
      m.streak.toString(),
    ]),
    [["—", "No members", "—", "—", "—", "—", "—", "—", "—"]]
  );

  autoTable(doc, {
    startY: (doc as any).lastAutoTable?.finalY + 15 || 100,
    head: [["ID", "Name/Email", "Tier", "Status", "Registered", "Last Paid", "Expiry", "Points", "Streak"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: Gymzprimary },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 50 }, 3: { fontStyle: "bold" } },
    ...TABLE_OPTS,
  });
}

function addAttendanceSection(
  doc: any,
  gymName: string,
  attendance: Awaited<ReturnType<typeof fetchAllAttendance>>,
  periodLabel: string,
  adminName: string
): void {
  doc.addPage("l", "a4");

  const startY = addBrandedHeader(doc, gymName, "Attendance Report", `Full Check-in History · Generated ${periodLabel}`, adminName);

  doc.text(`Total Check-ins: ${attendance.length}`, 15, startY + 10);

  const tableData = ensureNonEmpty(
    attendance.map((a) => [
      a.memberName,
      a.checkInTime ? format(new Date(a.checkInTime), "MMM dd, yyyy HH:mm") : "—",
      a.checkOutTime ? format(new Date(a.checkOutTime), "MMM dd, yyyy HH:mm") : "—",
      a.status,
    ]),
    [["No attendance records", "—", "—", "—"]]
  );

  autoTable(doc, {
    startY: startY + 18,
    head: [["Member", "Check-in", "Check-out", "Status"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: Gymzprimary },
    ...TABLE_OPTS,
  });
}

function addEventsSection(
  doc: any,
  gymName: string,
  events: Awaited<ReturnType<typeof fetchAllEvents>>,
  periodLabel: string,
  adminName: string
): void {
  doc.addPage("l", "a4");

  const startY = addBrandedHeader(doc, gymName, "Events Report", `All Events · Generated ${periodLabel}`, adminName);

  doc.text(`Total Events: ${events.length}`, 15, startY + 10);

  const tableData = ensureNonEmpty(
    events.map((e) => [
      e.title,
      e.eventDate ? format(new Date(e.eventDate), "MMM dd, yyyy") : "—",
      e.location,
      e.isFree ? "Yes" : "No",
      e.price != null ? currency.format(Number(e.price)) : "—",
      e.isActive ? "Active" : "Inactive",
      (e.attendees?.length || 0).toString(),
    ]),
    [["No events", "—", "—", "—", "—", "—", "—"]]
  );

  autoTable(doc, {
    startY: startY + 18,
    head: [["Title", "Date", "Location", "Free", "Price", "Status", "Attendees"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: Gymzprimary },
    ...TABLE_OPTS,
  });

  // Event Attendees section — list each event with its attendees
  const attendeeRows: [string, string, string, string][] = [];
  events.forEach((e) => {
    const attendees = e.attendees || [];
    if (attendees.length > 0) {
      attendees.forEach((a) => {
        attendeeRows.push([
          e.title,
          e.eventDate ? format(new Date(e.eventDate), "dd/MM/yyyy") : "—",
          a.name,
          a.status,
        ]);
      });
    } else {
      attendeeRows.push([e.title, e.eventDate ? format(new Date(e.eventDate), "dd/MM/yyyy") : "—", "No attendees", "—"]);
    }
  });

  if (attendeeRows.length > 0) {
    doc.addPage("l", "a4");
    doc.setFontSize(14);
    doc.text("Event Attendees", 15, 20);
    autoTable(doc, {
      startY: 25,
      head: [["Event", "Date", "Attendee", "Status"]],
      body: attendeeRows,
      theme: "grid",
      headStyles: { fillColor: Gymzprimary },
      ...TABLE_OPTS,
    });
  }
}

function addStaffSection(
  doc: any,
  gymName: string,
  staff: Awaited<ReturnType<typeof fetchAllStaff>>,
  periodLabel: string,
  adminName: string
): void {
  doc.addPage("p", "a4");

  const startY = addBrandedHeader(doc, gymName, "Staff Report", `All Staff · Generated ${periodLabel}`, adminName);

  doc.text(`Total Staff: ${staff.length}`, 15, startY + 10);

  const tableData = ensureNonEmpty(
    staff.map((s) => [s.name, s.email, s.phone, s.status]),
    [["No staff", "—", "—", "—"]]
  );

  autoTable(doc, {
    startY: startY + 18,
    head: [["Name", "Email", "Phone", "Status"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: Gymzprimary },
    ...TABLE_OPTS,
  });
}

function addInquiriesSection(
  doc: any,
  gymName: string,
  inquiries: Awaited<ReturnType<typeof fetchAllInquiries>>,
  periodLabel: string,
  adminName: string
): void {
  doc.addPage("p", "a4");

  const startY = addBrandedHeader(doc, gymName, "Support Inquiries", `All Inquiries · Generated ${periodLabel}`, adminName);

  doc.text(`Total Inquiries: ${inquiries.length}`, 15, startY + 10);

  const tableData = ensureNonEmpty(
    inquiries.map((i) => [
      i.fullName,
      i.email,
      i.message,
      i.status,
      i.source,
      i.createdAt ? format(new Date(i.createdAt), "MMM dd, yyyy") : "—",
    ]),
    [["No inquiries", "—", "—", "—", "—", "—"]]
  );

  autoTable(doc, {
    startY: startY + 18,
    head: [["Name", "Email", "Message", "Status", "Source", "Date"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: Gymzprimary },
    columnStyles: { 2: { cellWidth: 60 } },
    ...TABLE_OPTS,
  });
}

export async function runMonthlyReportIfDue(user: MonthlyReportUser | null, onProgress?: (message: string) => void, onComplete?: (success: boolean) => void): Promise<boolean> {
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) return false;
  const gymId = user.gymId || (user as any).gym_id;
  if (!gymId) return false;
  if (!shouldRunMonthlyReport()) return false;
  return executeMonthlyReport(user, onProgress, onComplete, true);
}

export async function runMonthlyReportNow(user: MonthlyReportUser | null, onComplete?: (success: boolean) => void): Promise<boolean> {
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) return false;
  const gymId = user.gymId || (user as any).gym_id;
  if (!gymId) return false;
  return executeMonthlyReport(user, undefined, onComplete, false);
}

async function executeMonthlyReport(user: MonthlyReportUser, onProgress?: (message: string) => void, onComplete?: (success: boolean) => void, markAsRun?: boolean): Promise<boolean> {
  const gymId = user.gymId || (user as any).gym_id;
  if (!gymId) return false;

  try {
    const periodLabel = getReportPeriodLabel();
    const adminName = user.name || user.email || "Admin";

    onProgress?.("Fetching gym details...");
    const gymName = await fetchGymNameForReport(gymId);
    const baseName = format(startOfMonth(subMonths(new Date(), 1)), "MMMM_yyyy");
    const fileName = `GMS_Monthly_Report_${baseName}.pdf`;

    onProgress?.("Generating dashboard summary...");
    const dashboardStats = await fetchDashboardStatsAll(gymId);

    onProgress?.("Generating finance report...");
    const financeData = await fetchAllFinanceData(gymId);

    onProgress?.("Generating membership report...");
    const members = await fetchAllMembers(gymId);

    onProgress?.("Generating attendance report...");
    const attendance = await fetchAllAttendance(gymId);

    onProgress?.("Generating events report...");
    const events = await fetchAllEvents(gymId);

    onProgress?.("Generating staff report...");
    const staff = await fetchAllStaff(gymId);

    onProgress?.("Generating inquiries report...");
    const inquiries = await fetchAllInquiries(gymId);

    onProgress?.("Building single PDF...");
    const doc = new jsPDF("p", "mm", "a4") as any;
    addDashboardSection(doc, gymName, dashboardStats, periodLabel, adminName);
    addFinanceSection(doc, gymName, financeData, periodLabel, adminName);
    addMembersSection(doc, gymName, members, periodLabel, adminName);
    addAttendanceSection(doc, gymName, attendance, periodLabel, adminName);
    addEventsSection(doc, gymName, events, periodLabel, adminName);
    addStaffSection(doc, gymName, staff, periodLabel, adminName);
    addInquiriesSection(doc, gymName, inquiries, periodLabel, adminName);

    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (markAsRun) markMonthlyReportRun();
    onComplete?.(true);
    return true;
  } catch (err) {
    console.error("Monthly report generation failed:", err);
    onComplete?.(false);
    return false;
  }
}
