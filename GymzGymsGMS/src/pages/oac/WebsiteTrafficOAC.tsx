import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subDays, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Globe, RefreshCw, Users, Eye, MousePointerClick } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StatsCard } from "@/components/StatsCard";

type Row = {
  path: string;
  created_at: string;
  session_id: string | null;
  referrer: string | null;
};

const DAYS = 30;
const BRAND = "hsl(120, 28%, 23%)";

export default function WebsiteTrafficOAC() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = subDays(new Date(), DAYS).toISOString();
      const { data, error } = await supabase
        .from("website_traffic_events")
        .select("path, created_at, session_id, referrer")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20000);

      if (error) throw error;
      setRows((data as Row[]) || []);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Could not load website traffic");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const sessions = new Set<string>();
    for (const r of rows) {
      if (r.session_id) sessions.add(r.session_id);
    }
    const byPath = new Map<string, number>();
    for (const r of rows) {
      const p = r.path || "/";
      byPath.set(p, (byPath.get(p) || 0) + 1);
    }
    const topPaths = [...byPath.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, views]) => ({ name: name.length > 48 ? `${name.slice(0, 46)}…` : name, views }));

    const byDay = new Map<string, number>();
    for (const r of rows) {
      const d = format(startOfDay(new Date(r.created_at)), "yyyy-MM-dd");
      byDay.set(d, (byDay.get(d) || 0) + 1);
    }
    const chartDays: { label: string; views: number }[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = format(startOfDay(subDays(new Date(), i)), "yyyy-MM-dd");
      chartDays.push({
        label: format(new Date(d + "T12:00:00"), "MMM d"),
        views: byDay.get(d) || 0,
      });
    }

    return {
      totalViews: rows.length,
      uniqueSessions: sessions.size,
      topPaths,
      chartDays,
    };
  }, [rows]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-7 w-7 text-primary" />
            Marketing site traffic
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Anonymous page views from gymzandnutrition.com (last {DAYS} days). Not shown on gym dashboards.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard
          title="Page views"
          value={loading ? "—" : stats.totalViews.toLocaleString()}
          icon={Eye}
          trend="neutral"
        />
        <StatsCard
          title="Sessions (estimate)"
          value={loading ? "—" : stats.uniqueSessions.toLocaleString()}
          icon={Users}
          trend="neutral"
        />
        <StatsCard
          title="Top path hits"
          value={loading ? "—" : (stats.topPaths[0]?.views ?? 0).toLocaleString()}
          icon={MousePointerClick}
          trend="neutral"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily views</CardTitle>
          <CardDescription>Counts of recorded events per day</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              Loading…
            </div>
          ) : stats.chartDays.every((d) => d.views === 0) ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No data yet. Deploy the marketing site with analytics and the{" "}
              <code className="text-xs bg-muted px-1 rounded">record-website-event</code> Edge Function.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartDays} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                <Tooltip
                  contentStyle={{ borderRadius: 8 }}
                  formatter={(v: number) => [v, "Views"]}
                />
                <Bar dataKey="views" fill={BRAND} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top paths</CardTitle>
          <CardDescription>Where visitors landed (path + query if recorded)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : stats.topPaths.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paths recorded in this window.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.topPaths.map((p) => (
                <li
                  key={p.name}
                  className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0"
                >
                  <code className="text-xs bg-muted/80 px-2 py-0.5 rounded break-all">{p.name}</code>
                  <span className="shrink-0 font-medium tabular-nums">{p.views}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
