import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins, TrendingUp, Users, Building2, PieChart, RefreshCw, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend, AreaChart, Area, Tooltip } from "recharts";
import { formatDate } from "@/lib/tokenAnalyticsUtils";

const FEATURE_TYPES = ["AI_CHAT", "COMMUNITY_CHAT", "FOOD_SCAN", "AI_COACH", "NUTRITION_AI", "OTHER"] as const;
const TIME_RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

function getTimeRangeFilter(range: string): { from: string } {
  const now = new Date();
  const from = new Date(now);
  if (range === "today") from.setHours(0, 0, 0, 0);
  else if (range === "week") from.setDate(from.getDate() - 7);
  else if (range === "month") from.setDate(1);
  else if (range === "year") from.setMonth(0, 1);
  return { from: from.toISOString() };
}

export default function TokenAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gyms, setGyms] = useState<{ id: string; name: string }[]>([]);
  const [usage, setUsage] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [balanceRows, setBalanceRows] = useState<any[]>([]);
  const [allTimeTokensUsed, setAllTimeTokensUsed] = useState<number>(0);
  const [limits, setLimits] = useState<any[]>([]);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ tokens: "", cost: "", notes: "" });
  const [savingLimit, setSavingLimit] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);

  const [gymId, setGymId] = useState<string>("all");
  const [featureType, setFeatureType] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("month");

  useEffect(() => {
    (async () => {
      const { data: gymsData } = await supabase.from("gyms").select("id, name").order("name");
      setGyms(gymsData || []);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { from } = getTimeRangeFilter(timeRange);

    (async () => {
      const usageQuery = supabase
        .from("ai_token_usage")
        .select(`
          id, user_id, gym_id, feature_type, tokens_input, tokens_output, tokens_total,
          model_used, request_cost_usd, user_gender, user_age_group, created_at,
          gyms ( name ),
          users ( name, email )
        `)
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (gymId !== "all") usageQuery.eq("gym_id", gymId);
      if (featureType !== "all") usageQuery.eq("feature_type", featureType);

      const [usageRes, summaryRes, balanceRes, totalsRes, limitsRes] = await Promise.all([
        usageQuery,
        supabase.from("ai_token_usage_summary").select("*").order("year", { ascending: false }).order("month", { ascending: false }).limit(120),
        supabase.from("ai_token_balance").select("*").order("purchased_at", { ascending: false }).limit(50),
        supabase.rpc("get_ai_token_usage_totals"),
        supabase.from("ai_token_limits").select("*, gyms(name)").order("gym_id"),
      ]);

      if (cancelled) return;
      setUsage(usageRes.data || []);
      setSummary(summaryRes.data || []);
      setBalanceRows(balanceRes.data || []);
      setAllTimeTokensUsed(Number(totalsRes.data?.total_tokens_used ?? 0));
      setLimits(limitsRes.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [gymId, featureType, timeRange]);

  const totals = useMemo(() => {
    const totalTokens = usage.reduce((s, r) => s + (r.tokens_total || 0), 0);
    const totalCost = usage.reduce((s, r) => s + Number(r.request_cost_usd || 0), 0);
    const totalRequests = usage.length;
    return { totalTokens, totalCost, totalRequests };
  }, [usage]);

  const byGym = useMemo(() => {
    const map: Record<string, { name: string; tokens: number; cost: number; requests: number }> = {};
    usage.forEach((r) => {
      const id = r.gym_id || "unknown";
      if (!map[id]) map[id] = { name: r.gyms?.name || id, tokens: 0, cost: 0, requests: 0 };
      map[id].tokens += r.tokens_total || 0;
      map[id].cost += Number(r.request_cost_usd || 0);
      map[id].requests += 1;
    });
    return Object.entries(map)
      .map(([id, v]) => ({ gym_id: id, ...v }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);
  }, [usage]);

  const byFeature = useMemo(() => {
    const map: Record<string, number> = {};
    usage.forEach((r) => {
      const f = r.feature_type || "OTHER";
      map[f] = (map[f] || 0) + (r.tokens_total || 0);
    });
    return Object.entries(map).map(([name, tokens]) => ({ name, tokens }));
  }, [usage]);

  const byUser = useMemo(() => {
    const map: Record<string, { name: string; email?: string; tokens: number }> = {};
    usage.forEach((r) => {
      const id = r.user_id || "unknown";
      const displayName = r.users?.name || (typeof id === "string" && id.length > 20 ? `${id.slice(0, 8)}…` : id);
      if (!map[id]) map[id] = { name: displayName, email: r.users?.email, tokens: 0 };
      map[id].tokens += r.tokens_total || 0;
    });
    return Object.entries(map)
      .map(([id, v]) => ({ user_id: id, ...v }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);
  }, [usage]);

  const monthlyTrend = useMemo(() => {
    const byMonth: Record<string, { month: string; tokens: number; cost: number }> = {};
    summary.forEach((r) => {
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
      if (gymId !== "all" && r.gym_id !== gymId) return;
      if (!byMonth[key]) byMonth[key] = { month: key, tokens: 0, cost: 0 };
      byMonth[key].tokens += Number(r.total_tokens_used || 0);
      byMonth[key].cost += Number(r.total_cost_usd || 0);
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, v]) => v);
  }, [summary, gymId]);

  const dailyStacked = useMemo(() => {
    const byDay: Record<string, Record<string, number> & { date: string }> = {};
    usage.forEach((r) => {
      const d = new Date(r.created_at).toISOString().slice(0, 10);
      const f = r.feature_type || "OTHER";
      if (!byDay[d]) byDay[d] = { date: d };
      byDay[d][f] = (byDay[d][f] || 0) + (r.tokens_total || 0);
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [usage]);

  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const compareData = useMemo(() => {
    if (!compareA || !compareB || compareA === compareB) return null;
    const gymNames = Object.fromEntries(gyms.map((g) => [g.id, g.name]));
    const a = usage.filter((r) => r.gym_id === compareA);
    const b = usage.filter((r) => r.gym_id === compareB);
    const tokensA = a.reduce((s, r) => s + (r.tokens_total || 0), 0);
    const tokensB = b.reduce((s, r) => s + (r.tokens_total || 0), 0);
    const byFeatureA: Record<string, number> = {};
    const byFeatureB: Record<string, number> = {};
    a.forEach((r) => { const f = r.feature_type || "OTHER"; byFeatureA[f] = (byFeatureA[f] || 0) + (r.tokens_total || 0); });
    b.forEach((r) => { const f = r.feature_type || "OTHER"; byFeatureB[f] = (byFeatureB[f] || 0) + (r.tokens_total || 0); });
    const features = [...new Set([...Object.keys(byFeatureA), ...Object.keys(byFeatureB)])];
    return {
      nameA: gymNames[compareA] || compareA,
      nameB: gymNames[compareB] || compareB,
      tokensA,
      tokensB,
      bars: features.map((f) => ({ feature: f, gymA: byFeatureA[f] || 0, gymB: byFeatureB[f] || 0 })),
      summary: [{ name: gymNames[compareA] || "Gym A", tokens: tokensA }, { name: gymNames[compareB] || "Gym B", tokens: tokensB }],
    };
  }, [usage, compareA, compareB, gyms]);

  const tokensPurchased = balanceRows.reduce((s, r) => s + Number(r.tokens_purchased || 0), 0);
  const tokensRemaining = Math.max(0, tokensPurchased - allTimeTokensUsed);

  // Explicit palette for dark UI: high contrast, distinct
  const CHART_PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#4ade80", "#fb923c"];
  const barConfig = { tokens: { label: "Tokens", color: CHART_PALETTE[0] } };
  const pieColors = CHART_PALETTE;

  return (
    <div className="min-h-screen bg-mesh-glow text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-muted-foreground hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Token Usage</h1>
            <p className="text-muted-foreground mt-1">Monitor and control AI token consumption across the platform.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Label className="text-muted-foreground">Gym</Label>
          <Label className="text-muted-foreground">Feature</Label>
          <Label className="text-muted-foreground">Time range</Label>
          <div />
          <Select value={gymId} onValueChange={setGymId}>
            <SelectTrigger className="bg-black/40 border-white/10 text-white rounded-xl">
              <SelectValue placeholder="All gyms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All gyms</SelectItem>
              {gyms.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={featureType} onValueChange={setFeatureType}>
            <SelectTrigger className="bg-black/40 border-white/10 text-white rounded-xl">
              <SelectValue placeholder="All features" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All features</SelectItem>
              {FEATURE_TYPES.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="bg-black/40 border-white/10 text-white rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div />
        </div>

        {loading ? (
          <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span>Loading token data...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4" /> Total tokens used
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totals.totalTokens.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Total cost (USD)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">${totals.totalCost.toFixed(4)}</p>
                </CardContent>
              </Card>
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <PieChart className="h-4 w-4" /> Requests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totals.totalRequests}</p>
                </CardContent>
              </Card>
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4" /> Tokens remaining
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{tokensRemaining.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Purchased: {tokensPurchased.toLocaleString()} · Used: {allTimeTokensUsed.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Token usage by gym</CardTitle>
                  <CardDescription className="text-zinc-400">Top 10 gyms by token usage (filtered)</CardDescription>
                </CardHeader>
                <CardContent className="bg-white/[0.03] rounded-xl border border-white/5">
                  {byGym.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No data</p>
                  ) : (
                    <ChartContainer config={barConfig} className="h-[280px] w-full">
                      <BarChart data={byGym} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 12 }} angle={-25} textAnchor="end" height={60} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="tokens" radius={[6, 6, 0, 0]} stroke="rgba(255,255,255,0.2)" strokeWidth={1}>
                          {byGym.map((_, i) => (
                            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                  {byGym.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-xs text-zinc-500 mb-2">Drill down by gym</p>
                      <div className="flex flex-wrap gap-2">
                        {byGym.map((g) => (
                          <Button key={g.gym_id} variant="outline" size="sm" className="rounded-lg border-white/20 text-white hover:bg-white/10" onClick={() => navigate(`/token-analytics/gym/${g.gym_id}`)}>
                            {g.name} ({g.tokens.toLocaleString()})
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Token usage by feature</CardTitle>
                  <CardDescription className="text-zinc-400">Share of total tokens (filtered)</CardDescription>
                </CardHeader>
                <CardContent className="bg-white/[0.03] rounded-xl border border-white/5">
                  {byFeature.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No data</p>
                  ) : (
                    <ChartContainer config={barConfig} className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={byFeature}
                            dataKey="tokens"
                            nameKey="name"
                            cx="50%"
                            cy="45%"
                            innerRadius={50}
                            outerRadius={85}
                            paddingAngle={2}
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth={1}
                            label={({ name, percent, x, y }) => (
                              percent >= 0.07 ? (
                                <text x={x} y={y} fill="rgba(255,255,255,0.95)" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11 }}>
                                  {name} {(percent * 100).toFixed(0)}%
                                </text>
                              ) : null
                            )}
                            labelLine={false}
                          >
                            {byFeature.map((_, i) => (
                              <Cell key={i} fill={pieColors[i % pieColors.length]} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ paddingTop: 8 }} formatter={(value) => <span className="text-white/90 text-xs">{value}</span>} />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="glass-card border-white/5 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Daily usage (stacked by feature)</CardTitle>
                <CardDescription className="text-zinc-400">Tokens per day broken down by feature — trader view</CardDescription>
              </CardHeader>
              <CardContent className="bg-white/[0.03] rounded-xl border border-white/5">
                {dailyStacked.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No data</p>
                ) : (
                  <ChartContainer config={barConfig} className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyStacked} margin={{ top: 10, right: 10, left: 10, bottom: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 12 }} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 12 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        {["AI_CHAT", "AI_COACH", "COMMUNITY_CHAT", "FOOD_SCAN", "NUTRITION_AI", "OTHER"].filter((f) => dailyStacked.some((d) => (d[f] ?? 0) > 0)).map((f, i) => (
                          <Area key={f} type="monotone" dataKey={f} stackId="1" fill={CHART_PALETTE[i % CHART_PALETTE.length]} stroke={CHART_PALETTE[i % CHART_PALETTE.length]} fillOpacity={0.8} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card border-white/5 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Monthly token trend</CardTitle>
                <CardDescription className="text-zinc-500">From summary table (last 12 months)</CardDescription>
              </CardHeader>
              <CardContent className="bg-white/[0.03] rounded-xl border border-white/5">
                {monthlyTrend.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No summary data. Run refresh_ai_token_usage_summary for gyms/months.</p>
                ) : (
                  <ChartContainer config={barConfig} className="h-[260px] w-full">
                    <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                      <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 12 }} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="tokens" fill={CHART_PALETTE[1]} stroke="rgba(255,255,255,0.2)" strokeWidth={1} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card border-white/5 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Compare two gyms</CardTitle>
                <CardDescription className="text-zinc-400">Side-by-side token usage by feature — investigator view</CardDescription>
              </CardHeader>
              <CardContent className="bg-white/[0.03] rounded-xl border border-white/5">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground text-sm">Gym A</Label>
                    <Select value={compareA || "_"} onValueChange={(v) => setCompareA(v === "_" ? "" : v)}>
                      <SelectTrigger className="w-[200px] bg-black/40 border-white/10 text-white rounded-xl">
                        <SelectValue placeholder="Select gym…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_">Select gym…</SelectItem>
                        {gyms.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground text-sm">Gym B</Label>
                    <Select value={compareB || "_"} onValueChange={(v) => setCompareB(v === "_" ? "" : v)}>
                      <SelectTrigger className="w-[200px] bg-black/40 border-white/10 text-white rounded-xl">
                        <SelectValue placeholder="Select gym…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_">Select gym…</SelectItem>
                        {gyms.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {compareData && compareData.bars.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-4 text-center">
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-xs text-zinc-500">{compareData.nameA}</p>
                        <p className="text-xl font-bold">{compareData.tokensA.toLocaleString()} tokens</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <p className="text-xs text-zinc-500">{compareData.nameB}</p>
                        <p className="text-xl font-bold">{compareData.tokensB.toLocaleString()} tokens</p>
                      </div>
                    </div>
                    <ChartContainer config={barConfig} className="h-[260px] w-full">
                      <BarChart data={compareData.bars} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                        <XAxis dataKey="feature" tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 11 }} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 11 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="gymA" name={compareData.nameA} fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="gymB" name={compareData.nameB} fill={CHART_PALETTE[1]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Select two different gyms above to compare.</p>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card border-white/5 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" /> Top token-consuming users
                </CardTitle>
                <CardDescription className="text-zinc-400">Filtered by current filters · Click View detail to drill to user level</CardDescription>
              </CardHeader>
              <CardContent>
                {byUser.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No data</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="text-xs text-zinc-500 uppercase tracking-widest border-b border-white/10">
                          <th className="py-3 font-bold">User</th>
                          <th className="py-3 font-bold">Email</th>
                          <th className="py-3 font-bold text-right">Tokens</th>
                          <th className="py-3 font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {byUser.map((u) => (
                          <tr key={u.user_id} className="hover:bg-white/5">
                            <td className="py-2">{u.name || u.user_id}</td>
                            <td className="py-2 text-muted-foreground">{u.email ?? "—"}</td>
                            <td className="py-2 text-right font-mono">{u.tokens.toLocaleString()}</td>
                            <td className="py-2 text-right">
                              <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300" onClick={() => navigate(`/token-analytics/user/${u.user_id}`)}>View detail</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card border-white/5 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">All requests (raw export)</CardTitle>
                <CardDescription className="text-zinc-400">Every AI request in the filtered period — who, where, when, feature, tokens. Export for audit or analysis.</CardDescription>
              </CardHeader>
              <CardContent>
                {usage.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No data</p>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="mb-4 rounded-xl border-white/20 text-white hover:bg-white/10" onClick={() => {
                      const headers = ["When", "Gym", "User", "Email", "Feature", "Tokens In", "Tokens Out", "Tokens Total", "Model", "Cost USD"];
                      const rows = usage.map((r) => [
                        formatDate(r.created_at),
                        (r.gyms as any)?.name ?? r.gym_id ?? "",
                        (r.users as any)?.name ?? "",
                        (r.users as any)?.email ?? "",
                        r.feature_type ?? "",
                        r.tokens_input ?? 0,
                        r.tokens_output ?? 0,
                        r.tokens_total ?? 0,
                        r.model_used ?? "",
                        Number(r.request_cost_usd ?? 0).toFixed(4),
                      ]);
                      const csv = [headers.join(","), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `token-usage-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}>
                      <Download className="h-4 w-4 mr-2" /> Export CSV
                    </Button>
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 bg-zinc-900/95 z-10">
                          <tr className="text-xs text-zinc-500 uppercase tracking-widest border-b border-white/10">
                            <th className="py-2 text-left font-bold">When</th>
                            <th className="py-2 text-left font-bold">Gym</th>
                            <th className="py-2 text-left font-bold">User</th>
                            <th className="py-2 text-left font-bold">Feature</th>
                            <th className="py-2 text-right font-bold">In</th>
                            <th className="py-2 text-right font-bold">Out</th>
                            <th className="py-2 text-right font-bold">Total</th>
                            <th className="py-2 text-left font-bold">Model</th>
                            <th className="py-2 text-right font-bold">Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {usage.slice(0, 500).map((r) => (
                            <tr key={r.id} className="hover:bg-white/5">
                              <td className="py-1.5 text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
                              <td className="py-1.5">{(r.gyms as any)?.name ?? r.gym_id?.slice(0, 8) ?? "—"}</td>
                              <td className="py-1.5">{(r.users as any)?.name ?? (r.users as any)?.email ?? r.user_id?.slice(0, 8) ?? "—"}</td>
                              <td className="py-1.5">{r.feature_type}</td>
                              <td className="py-1.5 text-right font-mono">{Number(r.tokens_input ?? 0).toLocaleString()}</td>
                              <td className="py-1.5 text-right font-mono">{Number(r.tokens_output ?? 0).toLocaleString()}</td>
                              <td className="py-1.5 text-right font-mono">{Number(r.tokens_total ?? 0).toLocaleString()}</td>
                              <td className="py-1.5 text-muted-foreground">{r.model_used ?? "—"}</td>
                              <td className="py-1.5 text-right">${Number(r.request_cost_usd ?? 0).toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {usage.length > 500 && <p className="text-xs text-zinc-500 mt-2">Showing first 500 of {usage.length}. Export CSV for full data.</p>}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Token limits</CardTitle>
                  <CardDescription className="text-zinc-500">Per-gym / per-feature daily limits and cooldowns</CardDescription>
                </CardHeader>
                <CardContent>
                  {limits.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No limits set. AI is unrestricted except by platform balance.</p>
                  ) : (
                    <div className="overflow-x-auto text-sm">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="text-zinc-500 border-b border-white/10">
                            <th className="py-2 text-left">Gym</th>
                            <th className="py-2 text-left">Feature</th>
                            <th className="py-2 text-right">Daily limit</th>
                            <th className="py-2 text-right">User daily</th>
                            <th className="py-2 text-right">Cooldown (s)</th>
                            <th className="py-2 text-center">On</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {limits.map((l) => (
                            <tr key={l.id}>
                              <td className="py-1">{l.gyms?.name ?? l.gym_id ?? "—"}</td>
                              <td className="py-1">{l.feature_type}</td>
                              <td className="py-1 text-right font-mono">{l.daily_token_limit ?? "—"}</td>
                              <td className="py-1 text-right font-mono">{l.user_daily_limit ?? "—"}</td>
                              <td className="py-1 text-right">{l.cooldown_seconds ?? 0}</td>
                              <td className="py-1 text-center">{l.is_feature_enabled ? "Yes" : "No"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Token purchases</CardTitle>
                  <CardDescription className="text-zinc-500">Record new purchases to update platform balance</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setPurchaseDialogOpen(true)} className="rounded-xl mb-4">Record purchase</Button>
                  {balanceRows.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No purchases recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto text-sm">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="text-zinc-500 border-b border-white/10">
                            <th className="py-2 text-left">Date</th>
                            <th className="py-2 text-right">Tokens</th>
                            <th className="py-2 text-right">Cost (USD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {balanceRows.slice(0, 10).map((r) => (
                            <tr key={r.id}>
                              <td className="py-1">{r.purchased_at ? new Date(r.purchased_at).toLocaleDateString() : "—"}</td>
                              <td className="py-1 text-right font-mono">{Number(r.tokens_purchased || 0).toLocaleString()}</td>
                              <td className="py-1 text-right">${Number(r.purchase_cost_usd || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
          <DialogContent className="bg-zinc-900 border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Record token purchase</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label className="text-muted-foreground">Tokens purchased</Label>
                <Input type="number" placeholder="e.g. 1000000" className="mt-1 bg-black/40 border-white/10" value={purchaseForm.tokens} onChange={(e) => setPurchaseForm((f) => ({ ...f, tokens: e.target.value }))} />
              </div>
              <div>
                <Label className="text-muted-foreground">Cost (USD)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 5.00" className="mt-1 bg-black/40 border-white/10" value={purchaseForm.cost} onChange={(e) => setPurchaseForm((f) => ({ ...f, cost: e.target.value }))} />
              </div>
              <div>
                <Label className="text-muted-foreground">Notes (optional)</Label>
                <Input placeholder="Optional" className="mt-1 bg-black/40 border-white/10" value={purchaseForm.notes} onChange={(e) => setPurchaseForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>Cancel</Button>
              <Button disabled={savingPurchase || !purchaseForm.tokens || !purchaseForm.cost} onClick={async () => {
                setSavingPurchase(true);
                const { error } = await supabase.from("ai_token_balance").insert({
                  tokens_purchased: parseInt(purchaseForm.tokens, 10) || 0,
                  purchase_cost_usd: parseFloat(purchaseForm.cost) || 0,
                  notes: purchaseForm.notes || null,
                });
                setSavingPurchase(false);
                if (error) { toast.error(error.message); return; }
                toast.success("Purchase recorded");
                setPurchaseForm({ tokens: "", cost: "", notes: "" });
                setPurchaseDialogOpen(false);
                const { data } = await supabase.from("ai_token_balance").select("*").order("purchased_at", { ascending: false }).limit(50);
                setBalanceRows(data || []);
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
