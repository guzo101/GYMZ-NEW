import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrackItCircularProgress } from "@/member/components/TrackItCircularProgress";
import { TrackItNutritionCard } from "@/member/components/TrackItNutritionCard";
import { TrackItWorkoutCard } from "@/member/components/TrackItWorkoutCard";
import { TrackItCharts } from "@/member/components/TrackItCharts";
import { TrackItAchievements } from "@/member/components/TrackItAchievements";
import { TrackItLeaderboard } from "@/member/components/TrackItLeaderboard";

const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

export default function MemberDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    if (!user?.email) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: dbUser } = (await db
        .from("users")
        .select("*")
        .eq("email", user.email)
        .single()) as any;

      if (!dbUser || cancelled) {
        setLoading(false);
        return;
      }

      setProfile(dbUser);

      const { data: xpRows } = (await db
        .from("xp_transactions")
        .select("points")
        .eq("user_id", dbUser.id)) as any;

      const totalXp =
        xpRows?.reduce((sum: number, row: any) => sum + (row.points ?? 0), 0) ?? 0;
      setXp(totalXp);

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const levelInfo = useMemo(() => {
    const level = Math.max(1, Math.floor(xp / 1000) || 1);
    const currentLevelXp = (level - 1) * 1000;
    const nextLevelXp = level * 1000;
    const progress = ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

    let tier = "Starter";
    if (level >= 11 && level <= 25) tier = "Fitness Enthusiast";
    else if (level >= 26 && level <= 50) tier = "Iron Warrior";
    else if (level >= 51) tier = "Legend";

    return { level, tier, progress: Math.min(100, Math.max(0, progress)) };
  }, [xp]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center space-x-3">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">
          Loading your TrackIt dashboard...
        </span>
      </div>
    );
  }

  const memberName = profile?.name || user?.name || "Member";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            TrackIt Dashboard
          </h1>
        </div>
        <div className="flex w-full flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm md:w-auto md:min-w-[260px]">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              Level {levelInfo.level} · {levelInfo.tier}
            </span>
            <span>{xp.toLocaleString()} XP</span>
          </div>
          <Progress value={levelInfo.progress} className="h-2" />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Next level at {(levelInfo.level + 1) * 1000} XP</span>
            <span>{Math.round(levelInfo.progress)}% to next level</span>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-6">
          <TrackItWorkoutCard userId={profile?.id} />
          <TrackItNutritionCard userId={profile?.id} />
        </div>
        <div className="space-y-6">
          <TrackItAchievements userId={profile?.id} />
          <TrackItLeaderboard userId={profile?.id} />
        </div>
      </section>

      <section>
        <Tabs defaultValue="progress" className="space-y-4">
          <TabsList>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="nutrition">Meals &amp; Macros</TabsTrigger>
            <TabsTrigger value="workouts">Workouts</TabsTrigger>
            <TabsTrigger value="challenges">Challenges</TabsTrigger>
          </TabsList>
          <TabsContent value="progress" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border bg-muted/40 p-4">
                  <TrackItCircularProgress value={72} label="Goal Progress" />
                </div>
                <div className="space-y-2 text-sm">
                  <p className="font-medium">At-a-glance tracking</p>
                  <p className="text-muted-foreground">
                    As you log workouts and meals, this section will visualise trends in
                    strength, volume, and consistency so you can see momentum build.
                  </p>
                </div>
              </CardContent>
            </Card>
            <TrackItCharts userId={profile?.id} />
          </TabsContent>
          <TabsContent value="nutrition" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Meal-by-meal breakdown, favorites, and barcode history will appear here as
              you start logging more food.
            </p>
          </TabsContent>
          <TabsContent value="workouts" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exercise-specific insights, form scores, and PR streaks will populate from
              your logged sessions.
            </p>
          </TabsContent>
          <TabsContent value="challenges" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Daily, weekly, and monthly TrackIt challenges will unlock as your coach
              enables them for your account.
            </p>
          </TabsContent>
        </Tabs>
      </section>
    </div >
  );
}

