import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const retentionSteps = [
  {
    title: "Revive old members",
    detail: "Gymz identifies inactive members and guides targeted re-engagement.",
  },
  {
    title: "Prioritize follow-up",
    detail: "Your team sees exactly who to contact first, every day.",
  },
  {
    title: "Protect recurring revenue",
    detail: "Early action reduces churn and improves monthly member value.",
  },
];

export function AIRetentionSection() {
  return (
    <section id="retention" className="py-12 px-6 bg-gradient-to-br from-white via-primary/10 to-white">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="max-w-3xl mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Retention Engine</p>
          <h2 className="text-3xl md:text-4xl font-black mb-3">AI retention that grows revenue</h2>
          <p className="text-muted-foreground">
            One focused system to recover old members, reduce churn, and increase member lifetime value.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {retentionSteps.map((step) => (
            <Card key={step.title} className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg">{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {step.detail}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
