import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface TrackItAchievementsProps {
  userId?: string;
}

export function TrackItAchievements({ userId }: TrackItAchievementsProps) {
  const [achievements, setAchievements] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      const { data } = (await (supabase as any)
        .from("user_achievements")
        .select("*")
        .eq("user_id", userId)
        .order("unlocked_at", { ascending: false })
        .limit(6)) as any;
      if (data) setAchievements(data);
    })();
  }, [userId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Achievement Badges</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3">
        {achievements.length === 0 ? (
          <p className="col-span-3 text-xs text-muted-foreground">
            Keep logging workouts and meals to start unlocking TrackIt badges.
          </p>
        ) : (
          achievements.map((a) => (
            <div
              key={a.achievement_id}
              className="flex flex-col items-center justify-center rounded-md border bg-muted/40 px-2 py-3 text-center text-[11px]"
            >
              <div className="mb-1 text-lg">🏆</div>
              <p className="font-medium truncate w-full">{a.achievement_type}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}


