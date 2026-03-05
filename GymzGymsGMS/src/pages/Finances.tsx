/* @ts-nocheck */
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/StatsCard";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Users,
  Download,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar as CalendarIcon,
  RefreshCw,
  Search
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfMonth,
  endOfMonth,
  subDays,
  startOfDay,
  endOfDay,
  isWithinInterval,
  eachDayOfInterval,
  eachMonthOfInterval,
  differenceInDays,
  startOfYear
} from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { notifyPaymentApproved, notifyPaymentRejected } from "@/lib/notifications";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { useNavigate, useSearchParams } from "react-router-dom";
import { addBrandedHeader } from "@/lib/pdfBranding";
import { fetchGymPlans } from "@/services/gymPricing";

// Zambia Kwacha currency formatter
const currency = new Intl.NumberFormat("en-ZM", {
  style: "currency",
  currency: "ZMW",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

interface Transaction {
  id: string;
  amount: number;
  paymentStatus: string;
  paymentDate: string;
  description: string;
  method: string;
  members: {
    id: string;
    name: string;
  } | null;
  plan: {
    planName: string;
  } | null;
}

// ── SANITIZATION LAYER (Absolute Harmony Standard) ─────────────────────────
const mapTransaction = (data: any, userMap: Map<string, any>, planMap?: Map<string, string>): Transaction => {
  const uid = data.member_id || data.user_id;
  const status = (data.status || data.payment_status || "pending").toLowerCase().trim();
  const date = data.payment_date || data.paid_at || data.created_at;
  const planName = (data.plan_id && planMap?.get(data.plan_id)) || data.description || (data.months ? `${data.months} Month Subscription` : 'Subscription');

  return {
    id: data.id,
    amount: Number(data.amount || 0),
    paymentStatus: status,
    paymentDate: date,
    description: data.description || (data.months ? `${data.months} Month Subscription` : 'Subscription'),
    method: data.method || 'Cash',
    members: userMap.get(uid) || { id: 'unknown', name: 'Unknown Member' },
    plan: { planName }
  };
};

export default function Finances() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const reportRef = useRef(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const handleApprovePayment = async (paymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setApproving(paymentId);
    try {
      // Use the RPC to safely handle all the atomic updates
      const { data: activationResult, error: activationError } = await supabase.rpc('activate_subscription_from_payment', {
        p_payment_id: paymentId,
        p_admin_id: user.id
      });
      if (activationError) throw activationError;

      // Fail-safe to ensure the status updates on the dashboard instantly
      await supabase.from("payments").update({ status: "completed", payment_status: "completed" }).eq("id", paymentId);

      const payment = transactions.find(t => t.id === paymentId);
      if (payment && payment.members) {
        await notifyPaymentApproved({
          id: paymentId,
          amount: payment.amount,
          user_id: payment.members.id,
          member_name: payment.members.name,
          gym_id: user?.gymId || undefined
        });
      }

      toast({ title: "Payment Approved", description: "Membership activated successfully." });
      fetchTransactions();
    } catch (err: any) {
      toast({ title: "Approval Failed", description: err.message, variant: "destructive" });
    } finally {
      setApproving(null);
    }
  };

  const handleRejectPayment = async (paymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setApproving(paymentId);
    try {
      await supabase.from("payments").update({ status: "failed", payment_status: "failed" }).eq("id", paymentId);

      const payment = transactions.find(t => t.id === paymentId);
      if (payment && payment.members) {
        await notifyPaymentRejected({
          id: paymentId,
          amount: payment.amount,
          user_id: payment.members.id,
          member_name: payment.members.name,
          gym_id: user?.gymId || undefined
        });
      }

      toast({ title: "Payment Rejected", description: "The payment was marked as failed." });
      fetchTransactions();
    } catch (err: any) {
      toast({ title: "Rejection Failed", description: err.message, variant: "destructive" });
    } finally {
      setApproving(null);
    }
  };

  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "ytd" | "month">("30d");
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    activeSubscriptions: 0,
    avgRevenue: 0,
    pendingAmount: 0,
  });

  useEffect(() => {
    fetchTransactions();

    const paymentsChannel = supabase
      .channel('finances-realtime-v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        fetchTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(paymentsChannel);
    };
  }, [user?.gymId]);

  useEffect(() => {
    if (transactions.length > 0) {
      applyFiltersAndSourceData();
    }
  }, [transactions, dateRange]);

  // Scroll to and highlight payment when paymentId in URL (e.g. from notification double-click)
  const paymentIdFromUrl = searchParams.get('paymentId');
  const hasHandledPaymentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!paymentIdFromUrl) return;
    if (filteredTransactions.length === 0 && transactions.length === 0) return;
    const row = document.querySelector(`[data-payment-id="${paymentIdFromUrl}"]`);
    if (row) {
      hasHandledPaymentIdRef.current = paymentIdFromUrl;
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'bg-primary/5', 'rounded');
      const t = setTimeout(() => {
        row.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'bg-primary/5', 'rounded');
        setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('paymentId'); return next; }, { replace: true });
      }, 3000);
      return () => clearTimeout(t);
    }
    if (hasHandledPaymentIdRef.current === paymentIdFromUrl) return;
    hasHandledPaymentIdRef.current = paymentIdFromUrl;
    if (transactions.some((t) => t.id === paymentIdFromUrl)) {
      toast({ title: 'Payment not in view', description: 'Adjust the date range to see this payment.', variant: 'default' });
    }
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('paymentId'); return next; }, { replace: true });
  }, [paymentIdFromUrl, filteredTransactions, transactions, setSearchParams, toast]);

  async function fetchTransactions() {
    if (!user?.gymId) {
      console.log("Finances: No gymId yet, skipping fetch");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: rawPayments, error: fetchError } = await supabase
        .from('payments')
        .select(`
          id, 
          amount, 
          status, 
          payment_status, 
          paid_at, 
          payment_date, 
          created_at,
          user_id, 
          member_id, 
          description, 
          method,
          months,
          plan_id
        `)
        .eq('gym_id', user.gymId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const planMap = new Map<string, string>();
      const gymPlans = await fetchGymPlans(user.gymId, null);
      gymPlans.forEach(p => planMap.set(p.id, p.planName));

      const uids = [...new Set(rawPayments.map(p => p.member_id || p.user_id).filter(Boolean))];
      const userMap = new Map();
      if (uids.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name').in('id', uids).eq('gym_id', user.gymId);
        usersData?.forEach(u => userMap.set(u.id, u));
      }

      const mapped = rawPayments.map(p => mapTransaction(p, userMap, planMap));

      setTransactions(mapped);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function applyFiltersAndSourceData() {
    const now = new Date();
    let startDate: Date;
    let isLarge = false;

    switch (dateRange) {
      case "7d": startDate = subDays(now, 7); break;
      case "90d": startDate = subDays(now, 90); isLarge = true; break;
      case "ytd": startDate = startOfYear(now); isLarge = true; break;
      case "month": startDate = startOfMonth(now); break;
      default: startDate = subDays(now, 30); break;
    }

    const filtered = transactions.filter(t => {
      const d = new Date(t.paymentDate);
      return d >= startDate && d <= now;
    });

    setFilteredTransactions(filtered);

    // Calculate Charts
    const interval = isLarge
      ? eachMonthOfInterval({ start: startDate, end: now })
      : eachDayOfInterval({ start: startDate, end: now });

    const chartData = interval.map(date => {
      const dateStr = format(date, isLarge ? "yyyy-MM" : "yyyy-MM-dd");
      const dayTotal = filtered
        .filter(t => ["completed", "approved", "success", "paid"].includes(t.paymentStatus))
        .filter(t => format(new Date(t.paymentDate), isLarge ? "yyyy-MM" : "yyyy-MM-dd") === dateStr)
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        date: format(date, isLarge ? "MMM" : "MMM dd"),
        amount: dayTotal
      };
    });

    setRevenueData(chartData);

    // Stats calculation
    const totalRev = filtered
      .filter(t => ["completed", "approved", "success", "paid"].includes(t.paymentStatus))
      .reduce((s, t) => s + t.amount, 0);

    const pending = filtered
      .filter(t => ["pending", "pending_approval", "pending_verification"].includes(t.paymentStatus))
      .reduce((s, t) => s + t.amount, 0);

    const uniqueMembers = new Set(filtered.map(t => t.members?.id)).size;

    setStats({
      monthlyRevenue: totalRev,
      activeSubscriptions: uniqueMembers,
      avgRevenue: uniqueMembers > 0 ? totalRev / uniqueMembers : 0,
      pendingAmount: pending
    });
  }

  const exportToPDF = async () => {
    setExporting(true);
    try {
      // Use any to avoid type check errors on the instance
      const doc = new jsPDF('p', 'mm', 'a4') as any;
      const pageWidth = doc.internal.pageSize.getWidth();

      const subtitle = `Range: ${dateRange.toUpperCase()} (${format(subDays(new Date(), dateRange === '7d' ? 7 : 30), 'MMM dd')} - ${format(new Date(), 'MMM dd')})`;
      const startY = await addBrandedHeader(doc, 'Gymz FINANCE REPORT', subtitle);

      // Summary Table
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text('Performance Summary', 15, startY + 5);

      const summaryData = [
        ['Total Revenue', currency.format(stats.monthlyRevenue)],
        ['Active Customers', stats.activeSubscriptions.toString()],
        ['Avg. Value', currency.format(stats.avgRevenue)],
        ['Pending Amount', currency.format(stats.pendingAmount)]
      ];


      autoTable(doc, {
        startY: startY + 10,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [42, 75, 42] }
      });

      let finalY = (doc as any).lastAutoTable?.finalY || 100;

      // Capture Chart
      const chartElement = document.getElementById('finance-chart');
      if (chartElement) {
        try {
          const canvas = await html2canvas(chartElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });
          const imgData = canvas.toDataURL('image/png');
          doc.text('Revenue Trend', 15, finalY + 15);
          doc.addImage(imgData, 'PNG', 15, finalY + 20, 180, 60);
          finalY += 85;
        } catch (chartErr) {
          console.warn("Chart capture skipped:", chartErr);
          finalY += 10;
        }
      }

      // Detailed Transactions
      doc.addPage();
      doc.text('Transaction History', 15, 20);

      const tableData = filteredTransactions.map(t => [
        format(new Date(t.paymentDate), 'MMM dd, yyyy'),
        t.members?.name || 'Unknown',
        t.description,
        t.method,
        t.paymentStatus.toUpperCase(),
        currency.format(t.amount)
      ]);

      autoTable(doc, {
        startY: 25,
        head: [['Date', 'Member', 'Plan', 'Method', 'Status', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [42, 75, 42] },
        styles: { fontSize: 8 }
      });

      doc.save(`Gymz_Finance_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);

      toast({
        title: "Report Generated",
        description: "Your PDF report has been downloaded successfully.",
      });
    } catch (err) {
      console.error("PDF Export Error:", err);
      toast({
        title: "Export Failed",
        description: "There was an error generating your PDF report. Please try again.",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed": case "approved": case "success": case "paid": return "bg-primary";
      case "pending": case "pending_approval": return "bg-yellow-500";
      case "failed": case "rejected": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 pb-20 min-w-0 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finances</h1>
          <p className="text-muted-foreground">Manage revenue, subscriptions, and financial reports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex bg-muted p-1 rounded-lg border border-border items-center gap-1 mr-2">
            {["7d", "30d", "90d", "ytd", "month"].map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${dateRange === r ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={exportToPDF} disabled={exporting}>
            {exporting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Generate Report
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-grid">
        <StatsCard
          title="Revenue"
          value={currency.format(stats.monthlyRevenue)}
          subtitle={`${dateRange.toUpperCase()} Period`}
          icon={DollarSign}
        />
        <StatsCard
          title="Paid Subscriptions"
          value={stats.activeSubscriptions.toString()}
          subtitle="Unique Payers"
          icon={Users}
        />
        <StatsCard
          title="Avg value"
          value={currency.format(stats.avgRevenue)}
          subtitle="Per Payer"
          icon={TrendingUp}
        />
        <StatsCard
          title="Pending Collection"
          value={currency.format(stats.pendingAmount)}
          subtitle="Unconfirmed"
          icon={CreditCard}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 glass-card overflow-hidden relative group">
          <CardHeader>
            {/* Absolute icon container for dashboard consistency */}
            <div className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-xl shadow-lg bg-gradient-to-br from-primary to-primary-foreground/20 transition-transform group-hover:scale-110">
              <TrendingUp className="h-3.5 w-3.5 text-white" />
            </div>
            <CardTitle className="text-lg">
              Revenue Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div id="finance-chart" className="h-[350px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorFinance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2A4B2A" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2A4B2A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={v => `K${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
                    formatter={(value) => [currency.format(Number(value)), 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#2A4B2A"
                    fill="url(#colorFinance)"
                    strokeWidth={3}
                    fillOpacity={1}
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Transaction Breakdown */}
        <Card className="glass-card relative group">
          <CardHeader>
            {/* Absolute icon container for dashboard consistency */}
            <div className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-xl shadow-lg bg-gradient-to-br from-primary to-primary-foreground/20 transition-transform group-hover:scale-110">
              <FileText className="h-3.5 w-3.5 text-white" />
            </div>
            <CardTitle className="text-lg">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="max-h-[400px] overflow-y-auto px-6 space-y-4">
              {transactions.slice(0, 20).map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-muted pb-3 last:border-0 hover:bg-muted/30 p-2 rounded-lg transition-all cursor-pointer group" onClick={() => navigate(`/members?id=${t.members?.id}&search=${encodeURIComponent(t.members?.name || "")}`)}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate group-hover:underline">{t.members?.name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(t.paymentDate), 'MMM dd, HH:mm')}</p>
                    <Badge variant="outline" className={`text-[9px] py-0 h-4 ${getStatusColor(t.paymentStatus)} text-white border-0 mt-1`}>
                      {t.paymentStatus}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="font-bold text-sm text-primary">{currency.format(t.amount)}</p>
                    {["pending", "pending_approval", "pending_verification"].includes(t.paymentStatus) && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" onClick={(e) => handleApprovePayment(t.id, e)} disabled={approving === t.id} className="h-6 w-6 p-0 bg-green-600 hover:bg-green-700">
                          {approving === t.id ? <RefreshCw className="h-3 w-3 animate-spin text-white" /> : <CheckCircle2 className="h-3 w-3 text-white" />}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={(e) => handleRejectPayment(t.id, e)} disabled={approving === t.id} className="h-6 w-6 p-0">
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {filteredTransactions.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <Search className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p>No records for this range</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Transaction Table */}
      <Card className="glass-card overflow-hidden min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base sm:text-lg truncate">Detailed Audit Log</CardTitle>
          <Badge variant="secondary" className="shrink-0">{filteredTransactions.length} records</Badge>
        </CardHeader>
        <CardContent className="px-2 sm:px-6 pb-6">
          {/* Mobile: card layout (no horizontal scroll) */}
          <div className="md:hidden space-y-3">
            {filteredTransactions.map((t) => (
              <div
                key={t.id}
                data-payment-id={t.id}
                className="rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/members?id=${t.members?.id}&search=${encodeURIComponent(t.members?.name || "")}`)}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.members?.name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(t.paymentDate), 'dd/MM/yy')} · {t.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge className={getStatusColor(t.paymentStatus)}>{t.paymentStatus}</Badge>
                      <span className="text-xs text-muted-foreground">{t.method}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary">{currency.format(t.amount)}</p>
                    {["pending", "pending_approval", "pending_verification"].includes(t.paymentStatus) ? (
                      <div className="flex justify-end gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" onClick={(e) => handleApprovePayment(t.id, e)} disabled={approving === t.id} className="h-7 px-2 bg-green-600 hover:bg-green-700 text-xs">
                          {approving === t.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" />Approve</>}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={(e) => handleRejectPayment(t.id, e)} disabled={approving === t.id} className="h-7 px-2">
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Processed</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: compact table that fits viewport */}
          <div className="hidden md:block min-w-0 overflow-x-auto">
            <table className="w-full min-w-0 text-left text-sm table-fixed">
              <thead>
                <tr className="border-b text-muted-foreground font-medium">
                  <th className="pb-3 px-1.5 sm:px-2 w-[11%]">Date</th>
                  <th className="pb-3 px-1.5 sm:px-2 w-[14%]">Member</th>
                  <th className="pb-3 px-1.5 sm:px-2 w-[18%]">Description</th>
                  <th className="pb-3 px-1.5 sm:px-2 w-[8%]">Method</th>
                  <th className="pb-3 px-1.5 sm:px-2 w-[12%]">Status</th>
                  <th className="pb-3 px-1.5 sm:px-2 w-[14%] text-right">Amount</th>
                  <th className="pb-3 px-1.5 sm:px-2 w-[23%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t) => (
                  <tr key={t.id} data-payment-id={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => navigate(`/members?id=${t.members?.id}&search=${encodeURIComponent(t.members?.name || "")}`)}>
                    <td className="py-3 px-1.5 sm:px-2 truncate" title={format(new Date(t.paymentDate), 'dd/MM/yyyy')}>{format(new Date(t.paymentDate), 'dd/MM/yy')}</td>
                    <td className="py-3 px-1.5 sm:px-2 font-medium truncate" title={t.members?.name}>{t.members?.name}</td>
                    <td className="py-3 px-1.5 sm:px-2 text-muted-foreground truncate" title={t.description}>{t.description}</td>
                    <td className="py-3 px-1.5 sm:px-2 text-muted-foreground truncate">{t.method}</td>
                    <td className="py-3 px-1.5 sm:px-2">
                      <Badge className={getStatusColor(t.paymentStatus)}>{t.paymentStatus}</Badge>
                    </td>
                    <td className="py-3 px-1.5 sm:px-2 text-right font-bold truncate">{currency.format(t.amount)}</td>
                    <td className="py-3 px-1.5 sm:px-2 text-right">
                      {["pending", "pending_approval", "pending_verification"].includes(t.paymentStatus) ? (
                        <div className="flex justify-end gap-1 sm:gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" onClick={(e) => handleApprovePayment(t.id, e)} disabled={approving === t.id} className="h-7 sm:h-8 px-1.5 sm:px-2 bg-green-600 hover:bg-green-700 text-xs shrink-0" title="Approve">
                            {approving === t.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Approve</span></>}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={(e) => handleRejectPayment(t.id, e)} disabled={approving === t.id} className="h-7 sm:h-8 px-1.5 sm:px-2 shrink-0" title="Reject">
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
