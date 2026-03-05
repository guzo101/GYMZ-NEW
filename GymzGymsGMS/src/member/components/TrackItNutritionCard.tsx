import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrackItCircularProgress } from "./TrackItCircularProgress";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface TrackItNutritionCardProps {
  userId?: string;
}

export function TrackItNutritionCard({ userId }: TrackItNutritionCardProps) {
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
  });
  const [targets, setTargets] = useState({
    calories: 2200,
    protein: 160,
    carbs: 275,
    fats: 73,
    fiber: 30,
  });

  useEffect(() => {
    if (!userId) return;
    const today = format(new Date(), "yyyy-MM-dd");

    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data: targetRow } = (await (supabase as any)
        .from("daily_macro_targets")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .single()) as any;

      if (targetRow) {
        setTargets({
          calories: targetRow.daily_calorie_goal ?? 2200,
          protein: targetRow.protein_goal ?? 160,
          carbs: targetRow.carbs_goal ?? 275,
          fats: targetRow.fats_goal ?? 73,
          fiber: 30,
        });
      }

      const { data: logs } = (await (supabase as any)
        .from("daily_nutrition_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("logged_at", `${today}T00:00:00`)
        .lte("logged_at", `${today}T23:59:59`)) as any;

      if (!cancelled && logs) {
        const agg = logs.reduce(
          (acc: any, row: any) => ({
            calories: acc.calories + (Number(row.calories) || 0),
            protein: acc.protein + (Number(row.protein) || 0),
            carbs: acc.carbs + (Number(row.carbs) || 0),
            fats: acc.fats + (Number(row.fats) || 0),
            fiber: acc.fiber + (Number(row.fiber) || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 }
        );
        setTotals(agg);
      }

      setLoading(false);
    })();

    const channel = (supabase as any)
      .channel("trackit-nutrition")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "daily_nutrition_logs",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const row = payload.new;
          setTotals((prev) => ({
            calories: prev.calories + (Number(row.calories) || 0),
            protein: prev.protein + (Number(row.protein) || 0),
            carbs: prev.carbs + (Number(row.carbs) || 0),
            fats: prev.fats + (Number(row.fats) || 0),
            fiber: prev.fiber + (Number(row.fiber) || 0),
          }));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      (supabase as any).removeChannel(channel);
    };
  }, [userId]);

  const percentages = useMemo(() => {
    const pct = (value: number, target: number) =>
      target > 0 ? Math.min(999, (value / target) * 100) : 0;
    return {
      calories: pct(totals.calories, targets.calories),
      protein: pct(totals.protein, targets.protein),
      carbs: pct(totals.carbs, targets.carbs),
      fats: pct(totals.fats, targets.fats),
      fiber: pct(totals.fiber, targets.fiber),
    };
  }, [totals, targets]);

  const calorieColor =
    percentages.calories > 110
      ? "text-red-500"
      : percentages.calories > 95
      ? "text-yellow-500"
      : "text-emerald-500";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">
          Daily Nutrition Summary
        </CardTitle>
        <Button size="sm" variant="outline">
          Scan Food
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <TrackItCircularProgress value={percentages.calories} />
            <div className="space-y-1 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Calories Today
              </p>
              <p className={`text-lg font-semibold ${calorieColor}`}>
                {Math.round(totals.calories)} / {Math.round(targets.calories)} kcal
              </p>
              <p className="text-xs text-muted-foreground">
                {percentages.calories.toFixed(0)}% of today&apos;s target
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { key: "protein", label: "Protein", color: "bg-red-500" },
            { key: "carbs", label: "Carbs", color: "bg-primary" },
            { key: "fats", label: "Fats", color: "bg-yellow-400" },
            { key: "fiber", label: "Fiber", color: "bg-emerald-500" },
          ].map((macro) => {
            const value = (totals as any)[macro.key] ?? 0;
            const target = (targets as any)[macro.key] ?? 0;
            const pct = (percentages as any)[macro.key] ?? 0;
            return (
              <button
                key={macro.key}
                type="button"
                className="w-full rounded-md border bg-muted/40 px-3 py-2 text-left transition hover:bg-muted"
              >
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>{macro.label}</span>
                  <span className="text-muted-foreground">
                    {Math.round(value)}g / {Math.round(target)}g
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${macro.color}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-[10px] text-muted-foreground">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {loading && (
          <p className="text-xs text-muted-foreground">
            Pulling in today&apos;s meals and macro targets...
          </p>
        )}
      </CardContent>
    </Card>
  );
}


