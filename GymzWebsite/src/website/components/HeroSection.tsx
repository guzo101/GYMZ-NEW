import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-background via-primary/5 to-secondary/10">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary via-background to-background" />
      <div className="relative grid gap-10 lg:grid-cols-2 p-8 md:p-12 lg:p-16">
        <div className="space-y-6">
          <p className="uppercase tracking-[0.3em] text-xs text-muted-foreground">
            For people who want real results
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Get in the best shape of your life in 12 weeks — or your next month is on us.
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            No confusion. No random workouts. Just a clear plan, coaches who care, and a gym that runs on time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="text-base" asChild>
              <a href="#contact">
                Claim a free strategy session
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="text-base" asChild>
              <a href="#chat">
                Ask a quick question
                <MessageSquare className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>Average member stays 12+ months</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground" />
            <span>Sessions built around busy schedules</span>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-gradient-to-br from-primary/60 to-secondary/40 rounded-full blur-3xl opacity-50" />
          <div className="relative rounded-2xl border bg-card/70 backdrop-blur p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Live schedule snapshot</p>
                <p className="text-3xl font-bold">18 classes today</p>
              </div>
              <div className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                93% full
              </div>
            </div>
            <div className="space-y-3">
              {["Sunrise Flow", "Strength Lab", "Lunch Express", "Run Club"].map((item, idx) => {
                const slots = [8, 12, 6, 10];
                const times = ["05:30 • Rooftop", "07:00 • Studio A", "12:15 • Studio B", "17:45 • Trail"];
                return (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-xl border p-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{item}</p>
                      <p className="text-muted-foreground text-xs">{times[idx]}</p>
                    </div>
                    <span className="text-xs font-medium text-primary">
                      {slots[idx]} / 12 slots
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground mb-1">Visitor chat queue</p>
              <p className="text-lg font-semibold">“Can I try the performance block?”</p>
              <p className="text-xs text-muted-foreground mt-2">Front desk response SLA: 2 min</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

