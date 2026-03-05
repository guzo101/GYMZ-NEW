import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Line,
  LineChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Bar,
  BarChart,
  Area,
  AreaChart,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

interface TrackItChartsProps {
  userId?: string;
}

export function TrackItCharts({ userId }: TrackItChartsProps) {
  const [strengthData, setStrengthData] = useState<any[]>([]);
  const [prData, setPrData] = useState<any[]>([]);
  const [volumeData, setVolumeData] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      const since = format(subDays(new Date(), 29), "yyyy-MM-dd");

      const { data: sessions } = (await (supabase as any)
        .from("workout_sessions")
        .select("*")
        .eq("user_id", userId)
        .gte("completed_at", since)) as any;

      if (sessions) {
        const byDay: Record<string, any> = {};
        sessions.forEach((s: any) => {
          const day = format(new Date(s.completed_at), "MM-dd");
          const key = `${day}-${s.exercise_name}`;
          const current = byDay[key]?.weight ?? 0;
          const weight = Number(s.weight) || 0;
          if (weight > current) {
            byDay[key] = { day, exercise: s.exercise_name, weight };
          }
        });
        setStrengthData(Object.values(byDay));

        const byWeek: Record<string, number> = {};
        sessions.forEach((s: any) => {
          const day = format(new Date(s.completed_at), "EEE");
          const vol = (Number(s.sets) || 0) * (Number(s.reps) || 0) * (Number(s.weight) || 0);
          byWeek[day] = (byWeek[day] || 0) + vol;
        });
        setVolumeData(
          ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({
            day: d,
            volume: byWeek[d] || 0,
          }))
        );
      }

      const { data: prs } = (await (supabase as any)
        .from("personal_records")
        .select("*")
        .eq("user_id", userId)) as any;
      if (prs) {
        setPrData(
          prs.map((pr: any) => ({
            exercise: pr.exercise_name,
            maxWeight: Number(pr.max_weight) || 0,
          }))
        );
      }
    })();
  }, [userId]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Strength Progress (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={strengthData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Personal Records</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={prData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="exercise" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="maxWeight" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Weekly Workout Volume
          </CardTitle>
        </CardHeader>
        <CardContent className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="#0ea5e9"
                fill="#0ea5e9"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}


