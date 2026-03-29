import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Coins, TrendingUp, Users, PieChart, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  Tooltip,
} from "recharts";
import { getTimeRangeFilter, TIME_RANGES, CHART_PALETTE, formatDate } from "@/lib/tokenAnalyticsUtils";

export default function TokenAnalyticsGymDetail() {
  const { gymId } = useParams<{ gymId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gymName, setGymName] = useState<string>("");
  const [usage, setUsage] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<string>("month");

  useEffect(() => {
    if (!gymId) return;
    (async () => {
      const { data: gym } = await supabase.from("gyms").select("name").eq("id", gymId).single();
      setGymName(gym?.name ?? gymId);
    })();
  }, [gymId]);

  useEffect(() => {
    if (!gymId) return;
    let cancelled = false;
    setLoading(true);
    const { from } = getTimeRangeFilter(timeRange);

    (async () => {
      const { data } = await supabase
        .from("ai_token_usage")
        .select(`
          id, user_id, gym_id, feature_type, tokens_input, tokens_output, tokens_total,
          model_used, request_cost_usd, created_at,
          users ( name, email )
        `)
        .eq("gym_id", gymId)
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (cancelled) return;
      setUsage(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [gymId, timeRange]);

  const totals = useMemo(() => {
    const totalTokens = usage.reduce((s, r) => s + (r.tokens_total || 0), 0);
    const totalCost = usage.reduce((s, r) => s + Number(r.request_cost_usd || 0), 0);
    return { totalTokens, totalCost, requests: usage.length };
  }, [usage]);

  const byUser = useMemo(() => {
    const map: Record<string, { name: string; email?: string; tokens: number; requests: number }> = {};
    usage.forEach((r) => {
      const id = r.user_id || "unknown";
      const displayName = (r.users as any)?.name || (typeof id === "string" && id.length > 20 ? `${id.slice(0, 8)}…` : id);
      if (!map[id]) map[id] = { name: displayName, email: (r.users as any)?.email, tokens: 0, requests: 0 };
      map[id].tokens += r.tokens_total || 0;
      map[id].requests += 1;
    });
    return Object.entries(map)
      .map(([id, v]) => ({ user_id: id, ...v }))
      .sort((a, b) => b.tokens - a.tokens);
  }, [usage]);

  const byFeature = useMemo(() => {
    const map: Record<string, number> = {};
    usage.forEach((r) => {
      const f = r.feature_type || "OTHER";
      map[f] = (map[f] || 0) + (r.tokens_total || 0);
    });
    return Object.entries(map).map(([name, tokens]) => ({ name, tokens }));
  }, [usage]);

  const dailyStacked = useMemo(() => {
    const byDay: Record<string, Record<string, number> & { date: string }> = {};
    const features = new Set<string>();
    usage.forEach((r) => {
      const d = new Date(r.created_at).toISOString().slice(0, 10);
      const f = r.feature_type || "OTHER";
      features.add(f);
      if (!byDay[d]) byDay[d] = { date: d };
      byDay[d][f] = (byDay[d][f] || 0) + (r.tokens_total || 0);
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [usage]);

  const barConfig = { tokens: { label: "Tokens", color: CHART_PALETTE[0] } };

  if (!gymId) {
    return (
      <div className="min-h-screen bg-mesh-glow text-white p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Missing gym.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh-glow text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/token-analytics")} className="text-muted-foreground hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6" /> {gymName || "…"}
            </h1>
            <p className="text-muted-foreground mt-1">Token usage drill-down for this gym.</p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground text-sm">Time range</Label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px] bg-black/40 border-white/10 text-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Coins className="h-4 w-4" /> Total tokens</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{totals.totalTokens.toLocaleString()}</p></CardContent>
              </Card>
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Cost (USD)</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">${totals.totalCost.toFixed(4)}</p></CardContent>
              </Card>
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Requests</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{totals.requests}</p></CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card border-white/5 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Daily usage (stacked by feature)</CardTitle>
                  <CardDescription className="text-zinc-400">Tokens per day by feature type</CardDescription>
                </CardHeader>
                <CardContent className="bg-white/[0.03] rounded-xl border border-white/5">
                  {dailyStacked.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No data</p>
                  ) : (
                    <ChartContainer config={barConfig} className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyStacked} margin={{ top: 10, right: 10, left: 10, bottom: 24 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                          <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 11 }} />
                          <YAxis tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 11 }} />
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
                  <CardTitle className="text-lg">By feature</CardTitle>
                  <CardDescription className="text-zinc-400">Share of tokens</CardDescription>
                </CardHeader>
                <CardContent className="bg-white/[0.03] rounded-xl border border-white/5">
                  {byFeature.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No data</p>
                  ) : (
                    <ChartContainer config={barConfig} className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie data={byFeature} dataKey="tokens" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} stroke="rgba(255,255,255,0.15)" strokeWidth={1}
                            label={({ name, percent, x, y }) => percent >= 0.07 ? <text x={x} y={y} fill="rgba(255,255,255,0.95)" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11 }}>{name} {(percent * 100).toFixed(0)}%</text> : null} labelLine={false}>
                            {byFeature.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltipContent />} />
                          <Legend formatter={(v) => <span className="text-white/90 text-xs">{v}</span>} />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="glass-card border-white/5 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> Users in this gym</CardTitle>
                <CardDescription className="text-zinc-400">Click a user to see request-level detail</CardDescription>
              </CardHeader>
              <CardContent className="bg-white/[0.03] rounded-xl border border-white/5">
                {byUser.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No data</p>
                ) : (
                  <>
                    <ChartContainer config={barConfig} className="h-[280px] w-full mb-6">
                      <BarChart data={byUser.slice(0, 15)} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.9)", fontSize: 11 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="tokens" radius={[6, 6, 0, 0]} stroke="rgba(255,255,255,0.2)" strokeWidth={1}>
                          {byUser.slice(0, 15).map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="text-xs text-zinc-500 uppercase tracking-widest border-b border-white/10">
                            <th className="py-3 text-left font-bold">User</th>
                            <th className="py-3 text-left font-bold">Email</th>
                            <th className="py-3 text-right font-bold">Tokens</th>
                            <th className="py-3 text-right font-bold">Requests</th>
                            <th className="py-3 text-right font-bold">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {byUser.map((u) => (
                            <tr key={u.user_id} className="hover:bg-white/5">
                              <td className="py-2">{u.name || u.user_id}</td>
                              <td className="py-2 text-muted-foreground">{u.email ?? "—"}</td>
                              <td className="py-2 text-right font-mono">{u.tokens.toLocaleString()}</td>
                              <td className="py-2 text-right">{u.requests}</td>
                              <td className="py-2 text-right">
                                <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300" onClick={() => navigate(`/token-analytics/user/${u.user_id}?gymId=${gymId}`)}>View detail</Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card border-white/5 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">All requests (raw)</CardTitle>
                <CardDescription className="text-zinc-400">Every AI request in the selected period — who, when, feature, tokens</CardDescription>
              </CardHeader>
              <CardContent>
                {usage.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No requests</p>
                ) : (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 bg-zinc-900/95 z-10">
                        <tr className="text-xs text-zinc-500 uppercase tracking-widest border-b border-white/10">
                          <th className="py-2 text-left font-bold">When</th>
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
                        {usage.map((r) => (
                          <tr key={r.id} className="hover:bg-white/5">
                            <td className="py-1.5 text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
                            <td className="py-1.5">{(r.users as any)?.name ?? (r.users as any)?.email ?? r.user_id?.slice(0, 8)}</td>
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
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
