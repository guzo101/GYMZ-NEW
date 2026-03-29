import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "./SectionHeader";
import { CheckCircle2 } from "lucide-react";

const ownerPoints = [
  {
    title: "Grow monthly revenue with AI retention",
    detail: "AI flags churn risk early so your team saves members before they quit.",
  },
  {
    title: "Win back inactive members faster",
    detail: "AI gives your team a daily reactivation list to revive old members quickly.",
  },
  {
    title: "Control payments and renewals in one view",
    detail: "Track paid, due, overdue, and renewal status in real time.",
  },
  {
    title: "Know exactly who is about to churn",
    detail: "Attendance and engagement signals show at-risk members immediately.",
  },
  {
    title: "Automate reminders and follow-ups with AI",
    detail: "AI sends personalized nudges to leads, inactive members, and at-risk clients.",
  },
  {
    title: "Publish events, merch updates, and campaigns easily",
    detail: "Keep members informed and engaged with fast in-app communications.",
  },
  {
    title: "Grow predictable recurring cash flow",
    detail: "Early retention action improves renewals and stabilizes monthly revenue.",
  },
];

const memberPoints = [
  {
    title: "Get started fast with the app",
    detail: "Quick sign-in gets members active immediately with less front-desk friction.",
  },
  {
    title: "Know exactly what to eat",
    detail: "Members get guided nutrition and macro targets to avoid overeating and stay goal-aligned.",
  },
  {
    title: "Dedicated AI coach support",
    detail: "An in-app AI coach helps each member stay consistent and focused on their fitness goal.",
  },
  {
    title: "Stay connected to gym events",
    detail: "Members get timely updates on challenges, events, and activities happening at your gym.",
  },
  {
    title: "Join a tribe with a shared goal",
    detail: "Community interaction builds accountability and keeps members motivated for the long term.",
  },
];

export function ProofSection() {
  return (
    <section id="proof" className="py-12 px-6 bg-gradient-to-br from-background via-primary/8 to-background">
      <div className="max-w-7xl mx-auto space-y-10">
        <SectionHeader eyebrow="What you get" align="center" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="overflow-hidden border-border/60">
            <CardHeader className="rounded-t-xl border-b border-primary/40 bg-primary/30 py-5">
              <div className="space-y-1.5 border-l-4 border-primary pl-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground leading-snug md:text-base">
                  What you get as a gym owner
                </CardTitle>
                <CardDescription className="text-[10px] font-medium uppercase tracking-[0.14em] text-primary md:text-xs">
                  Gym Management System (GMS)
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 bg-white pt-6">
              {ownerPoints.map((point) => (
                <div key={point.title} className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/70 p-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1 w-full">
                    <p className="font-semibold text-foreground">{point.title}</p>
                    <p className="text-sm text-muted-foreground">{point.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-border/60">
            <CardHeader className="rounded-t-xl border-b border-primary/40 bg-primary/30 py-5">
              <div className="space-y-1.5 border-l-4 border-primary pl-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground leading-snug md:text-base">
                  What your members get
                </CardTitle>
                <CardDescription className="text-[10px] font-medium uppercase tracking-[0.14em] text-primary md:text-xs">
                  Gymz App
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 bg-white pt-6">
              {memberPoints.map((point) => (
                <div key={point.title} className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/70 p-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1 w-full">
                    <p className="font-semibold text-foreground">{point.title}</p>
                    <p className="text-sm text-muted-foreground">{point.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
