import { Bot, Database, RefreshCw, TrendingUp, UserPlus, Wallet } from "lucide-react";

/** Six Gymz/GMS stages: data → win-backs → new joins → retention AI → billing → 2× revenue */
const chainSteps = [
  {
    title: "One member list in GMS",
    detail:
      "We import your old files and current roster into the Gym Management System—one place your team trusts.",
    icon: Database,
  },
  {
    title: "Win back inactive members",
    detail:
      "AI shows who went quiet and who to contact first—calls, SMS, and nudges before they are gone for good.",
    icon: RefreshCw,
  },
  {
    title: "Onboard new members in the app",
    detail:
      "New joins and trials use the Gymz member app—less front-desk chaos and faster paying memberships.",
    icon: UserPlus,
  },
  {
    title: "Stop churn early",
    detail:
      "Attendance and engagement alerts in GMS flag at-risk members so you act before renewals slip away.",
    icon: Bot,
  },
  {
    title: "Renewals and payments in one view",
    detail:
      "See paid, due, and overdue in real time—reminders and follow-ups so cash does not leak.",
    icon: Wallet,
  },
  {
    title: "Grow toward 2× monthly revenue",
    detail:
      "Retention, billing, and member value stack over time—stage six is where revenue can approach double what you see today.",
    icon: TrendingUp,
  },
];

export function RevenueGrowthChainSection() {
  return (
    <section id="about" className="py-12 px-6 bg-gradient-to-b from-background to-cream/25">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center">
          <p className="text-sm md:text-base font-bold tracking-widest uppercase text-secondary mb-2">
            For your gym · First 30 days
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-3 leading-[1.15] max-w-3xl mx-auto">
            This is what we&apos;ll do for your gym
          </h2>
          <p className="text-foreground font-semibold max-w-xl mx-auto text-base md:text-lg">
            <span className="text-primary">Double revenue</span> in{" "}
            <span className="text-secondary">30 days</span>. Six stages in Gymz.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chainSteps.map((step, index) => (
            <div key={step.title} className="rounded-xl border border-border/60 bg-gradient-to-br from-white to-primary/5 p-5 shadow-sm hover:shadow-md transition-shadow min-h-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                Stage {index + 1} of 6
              </p>
              <step.icon className="h-6 w-6 text-primary mb-3 shrink-0" aria-hidden />
              <h3 className="text-base md:text-lg font-bold mb-2 leading-snug">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
