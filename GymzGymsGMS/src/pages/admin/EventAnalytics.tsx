import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Cell,
} from "recharts";
import { BarChart3, Users, TrendingUp, Calendar, Ticket, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { StatsCard } from "@/components/StatsCard";
import { Badge } from "@/components/ui/badge";

interface AnalyticsData {
    totalEvents: number;
    totalRSVPs: number;
    activeEvents: number;
    averageCapacity: number;
}

interface EventBar {
    name: string;
    rsvps: number;
    capacity: number | null;
    date: string;
}

const BRAND_GREEN = "hsl(120, 28%, 23%)";
const GOLD = "hsl(47, 87%, 59%)";

export default function EventAnalytics() {
    const { user } = useAuth();
    const [data, setData] = useState<AnalyticsData>({
        totalEvents: 0,
        totalRSVPs: 0,
        activeEvents: 0,
        averageCapacity: 0,
    });
    const [chartData, setChartData] = useState<EventBar[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.gymId) {
            fetchAnalytics();
        }
    }, [user?.gymId]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const { data: events, error } = await supabase
                .from("events")
                .select("id, title, rsvp_count, is_active, capacity, event_date")
                .eq("gym_id", user?.gymId)
                .order("rsvp_count", { ascending: false });

            if (error) throw error;

            if (events) {
                const stats = events.reduce(
                    (acc, curr) => ({
                        totalEvents: acc.totalEvents + 1,
                        totalRSVPs: acc.totalRSVPs + (curr.rsvp_count || 0),
                        activeEvents: acc.activeEvents + (curr.is_active ? 1 : 0),
                        capacitySum: acc.capacitySum + (curr.capacity || 0),
                        capacityCount: acc.capacityCount + (curr.capacity ? 1 : 0),
                    }),
                    { totalEvents: 0, totalRSVPs: 0, activeEvents: 0, capacitySum: 0, capacityCount: 0 }
                );

                setData({
                    totalEvents: stats.totalEvents,
                    totalRSVPs: stats.totalRSVPs,
                    activeEvents: stats.activeEvents,
                    averageCapacity:
                        stats.capacityCount > 0
                            ? Math.round(stats.capacitySum / stats.capacityCount)
                            : 0,
                });

                // Top 10 events for chart
                setChartData(
                    events.slice(0, 10).map((e) => ({
                        name:
                            e.title.length > 18
                                ? e.title.slice(0, 16) + "…"
                                : e.title,
                        rsvps: e.rsvp_count || 0,
                        capacity: e.capacity,
                        date: e.event_date,
                    }))
                );
            }
        } catch (err: any) {
            toast.error("Failed to load analytics: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fillRate =
        data.totalEvents > 0 && data.averageCapacity > 0
            ? Math.min(100, Math.round((data.totalRSVPs / (data.totalEvents * data.averageCapacity)) * 100))
            : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-sidebar-accent/10 p-6 rounded-2xl border border-sidebar-border/30 backdrop-blur-md">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-secondary animate-pulse" />
                        Event <span className="text-primary">Analytics</span>
                    </h1>
                    <p className="text-muted-foreground font-medium">
                        High-level performance metrics for your community engagement.
                    </p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Sign-ups"
                    value={loading ? "…" : data.totalRSVPs.toLocaleString()}
                    subtitle="Aggregated attendance intent"
                    icon={Users}
                    trend="up"
                />
                <StatsCard
                    title="Active Events"
                    value={loading ? "…" : data.activeEvents}
                    subtitle="Currently visible to members"
                    icon={Calendar}
                    trend="neutral"
                />
                <StatsCard
                    title="Avg. Capacity"
                    value={loading ? "…" : data.averageCapacity || "∞"}
                    subtitle="Mean spots per event"
                    icon={Ticket}
                    trend="neutral"
                />
                <StatsCard
                    title="Fill Rate"
                    value={loading ? "…" : `${fillRate}%`}
                    subtitle="Estimated efficiency"
                    icon={TrendingUp}
                    trend={fillRate >= 70 ? "up" : "neutral"}
                />
            </div>

            {/* Sign-ups Bar Chart */}
            <Card className="border-sidebar-border/40 bg-sidebar-background/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-sidebar-border/30 px-6 py-5 bg-sidebar-accent/5">
                    <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                        <Zap className="h-5 w-5 text-secondary" />
                        Sign-ups per <span className="text-primary">Event</span>
                        <Badge className="ml-2 bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                            Top 10
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 pb-4 px-4">
                    {loading ? (
                        <div className="h-64 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-3">
                            <BarChart3 className="h-12 w-12 text-muted-foreground/20" />
                            <p className="text-muted-foreground text-sm">No event data yet. Create your first event to see analytics.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart
                                data={chartData}
                                margin={{ top: 4, right: 16, left: 0, bottom: 40 }}
                                barCategoryGap="28%"
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="rgba(255,255,255,0.05)"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 700 }}
                                    tickLine={false}
                                    axisLine={false}
                                    angle={-30}
                                    textAnchor="end"
                                    interval={0}
                                />
                                <YAxis
                                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 600 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={32}
                                />
                                <Tooltip
                                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                                    contentStyle={{
                                        background: "hsl(var(--sidebar-background))",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        borderRadius: "12px",
                                        color: "white",
                                        fontSize: 12,
                                        fontWeight: 700,
                                    }}
                                    formatter={(value: number) => [value, "Sign-ups"]}
                                    labelFormatter={(label) => `Event: ${label}`}
                                />
                                <Bar dataKey="rsvps" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={index === 0 ? GOLD : BRAND_GREEN}
                                            fillOpacity={index === 0 ? 0.95 : 0.7 - index * 0.04}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* Top Events Table */}
            <Card className="border-sidebar-border/40 bg-sidebar-background/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-sidebar-border/30 px-6 py-5 bg-sidebar-accent/5">
                    <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-secondary" />
                        Top Events by <span className="text-primary">Engagement</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-10 flex justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground text-sm">No events to display.</div>
                    ) : (
                        <div className="divide-y divide-sidebar-border/20">
                            {chartData.map((ev, i) => {
                                const fillPct = ev.capacity
                                    ? Math.min(100, Math.round((ev.rsvps / ev.capacity) * 100))
                                    : null;
                                return (
                                    <div
                                        key={i}
                                        className="flex items-center gap-4 px-6 py-4 hover:bg-sidebar-accent/10 transition-colors group"
                                    >
                                        <div
                                            className="h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                                            style={{
                                                background: i === 0 ? "hsla(47,87%,59%,0.15)" : "hsla(120,28%,38%,0.12)",
                                                color: i === 0 ? GOLD : BRAND_GREEN,
                                                border: `1px solid ${i === 0 ? "hsla(47,87%,59%,0.3)" : "hsla(120,28%,38%,0.25)"}`,
                                            }}
                                        >
                                            #{i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white text-sm group-hover:text-primary transition-colors truncate">
                                                {ev.name}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground font-medium">
                                                {format(new Date(ev.date), "MMM d, yyyy")}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="text-sm font-black text-white">{ev.rsvps}</div>
                                                <div className="text-[9px] text-muted-foreground uppercase font-bold">Sign-ups</div>
                                            </div>
                                            {fillPct !== null && (
                                                <Badge
                                                    className={`text-[10px] font-bold ${fillPct >= 80
                                                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                                                        : fillPct >= 50
                                                            ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                                            : "bg-sidebar-accent/50 text-muted-foreground border-sidebar-border/30"
                                                        }`}
                                                >
                                                    {fillPct}% full
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
