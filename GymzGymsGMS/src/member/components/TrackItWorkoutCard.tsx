import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface TrackItWorkoutCardProps {
  userId?: string;
}

interface Exercise {
  name: string;
  muscleGroup: string;
  sets: number;
  reps: number;
}

const DEFAULT_PLAN: Exercise[] = [
  { name: "Back Squat", muscleGroup: "Legs", sets: 4, reps: 6 },
  { name: "Bench Press", muscleGroup: "Chest", sets: 4, reps: 6 },
  { name: "Bent-Over Row", muscleGroup: "Back", sets: 3, reps: 8 },
];

export function TrackItWorkoutCard({ userId }: TrackItWorkoutCardProps) {
  const [plan, setPlan] = useState<Exercise[]>(DEFAULT_PLAN);
  const [completedSets, setCompletedSets] = useState(0);

  const totalSets = plan.reduce((sum, ex) => sum + ex.sets, 0);
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  useEffect(() => {
    if (!userId) return;

    const channel = (supabase as any)
      .channel("trackit-workouts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "workout_sessions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setCompletedSets((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [userId]);

  async function handleCompleteSet(exercise: Exercise) {
    if (!userId) return;
    setCompletedSets((prev) => Math.min(totalSets, prev + 1));
    await (supabase as any).from("workout_sessions").insert({
      user_id: userId,
      exercise_name: exercise.name,
      sets: 1,
      reps: exercise.reps,
      intensity_level: "Medium",
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-semibold">
            Today&apos;s Recommended Workout
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            AI suggests a balanced strength-focused session based on your last week.
          </p>
        </div>
        <Button size="sm">Start Workout</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Session completion</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {plan.map((exercise) => (
            <div
              key={exercise.name}
              className="flex flex-col justify-between rounded-lg border bg-muted/40 p-3 text-xs"
            >
              <div>
                <p className="text-sm font-semibold">{exercise.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {exercise.muscleGroup} · {exercise.sets} x {exercise.reps}
                </p>
              </div>
              <Button
                size="sm"
                className="mt-2 w-full"
                variant="secondary"
                onClick={() => handleCompleteSet(exercise)}
              >
                Log Set
              </Button>
            </div>
          ))}
        </div>

        <details className="rounded-md border bg-muted/40 p-3 text-xs">
          <summary className="cursor-pointer font-medium">
            Why this workout?
          </summary>
          <p className="mt-2 text-muted-foreground">
            TrackIt prioritises compound lifts to drive strength progress while keeping
            total volume manageable. As you log more sessions, difficulty and exercise
            selection will adapt around your recovery, streaks, and PR history.
          </p>
        </details>
      </CardContent>
    </Card>
  );
}


