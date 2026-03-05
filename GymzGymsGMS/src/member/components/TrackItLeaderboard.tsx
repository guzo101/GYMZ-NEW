import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface TrackItLeaderboardProps {
  userId?: string;
}

export function TrackItLeaderboard({ userId }: TrackItLeaderboardProps) {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = (await (supabase as any)
        .from("leaderboard_data")
        .select("*, users(name)")
        .order("weekly_points", { ascending: false })
        .limit(5)) as any;
      if (data) setRows(data);
    })();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Weekly Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">
            Leaderboard will light up as members start logging TrackIt activity.
          </p>
        ) : (
          rows.map((row, idx) => (
            <div
              key={row.leaderboard_id}
              className="flex items-center justify-between rounded-md border bg-muted/40 px-2 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 text-center text-[11px] font-semibold">
                  {idx + 1}
                </span>
                <span className="text-[11px]">
                  {row.users?.name || "Member"}
                  {row.user_id === userId && (
                    <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      You
                    </span>
                  )}
                </span>
              </div>
              <span className="text-[11px] font-medium">
                {row.weekly_points ?? 0} pts
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}


