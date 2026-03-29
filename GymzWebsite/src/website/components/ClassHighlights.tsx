import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "./SectionHeader";
import { useWebsiteShowcase } from "../hooks/useWebsiteShowcase";

export function ClassHighlights() {
  const { featuredClasses, upcomingEvents, spotlightTrainers, isLoading, isError } = useWebsiteShowcase();

  return (
    <section id="programs" className="space-y-10">
      <SectionHeader
        eyebrow="Classes & Coaching"
        title="Classes and coaching so you’re never guessing"
        description="Join a class, work with a coach or follow your own plan — there’s support at every level."
      />
      {isError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          We couldn’t load the latest classes right now. Please refresh in a moment.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <h3 className="text-section-eyebrow uppercase">Featured Classes</h3>
          {isLoading ? (
            <SkeletonList />
          ) : (
            <div className="space-y-4">
              {featuredClasses.map((klass) => (
                <Card key={klass.id} className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-lg">{klass.name}</CardTitle>
                    <CardDescription>{klass.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                    <Badge variant="outline">{klass.difficulty ?? "All levels"}</Badge>
                    <span>{klass.durationMinutes} mins • {klass.trainer_name ?? "Coach TBD"}</span>
                  </CardContent>
                </Card>
              ))}
              {featuredClasses.length === 0 && (
                <p className="text-sm text-muted-foreground">Class data syncs in once the front desk publishes schedules.</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-section-eyebrow uppercase">Upcoming Events</h3>
          {isLoading ? (
            <SkeletonList />
          ) : (
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <Card key={event.id} className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                    <CardDescription>{event.description || "Event details will be confirmed."}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>{event.event_date} • {event.start_time ?? "TBA"}</p>
                    {event.location && <p>{event.location}</p>}
                  </CardContent>
                </Card>
              ))}
              {upcomingEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">Front desk will populate the calendar and it appears here instantly.</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-section-eyebrow uppercase">Coaches & Support</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Personal training</p>
            <p>Work 1:1 with a coach for custom programs and faster results. Sessions available mornings, evenings and weekends.</p>
            <p className="font-semibold text-foreground mt-3">Beginner orientation</p>
            <p>Your first visit includes a quick tour and basic plan so you know exactly what to do when you walk in.</p>
            <p className="font-semibold text-foreground mt-3">Questions?</p>
            <p>Call or use the chat to ask about classes, trainers or the best option for your goals.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((idx) => (
        <div key={idx} className="h-28 rounded-2xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}

