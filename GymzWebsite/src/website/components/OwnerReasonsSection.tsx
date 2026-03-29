import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const reasons = [
  {
    title: "Increase monthly revenue",
    text: "Recover missed renewals and reduce payment leakage before it compounds.",
  },
  {
    title: "Serve clients better",
    text: "Give coaches and front desk one live view for faster follow-up.",
  },
  {
    title: "Scale without chaos",
    text: "Standardize operations across teams and branches while quality stays high.",
  },
];

export function OwnerReasonsSection() {
  return (
    <section id="about" className="bg-gradient-to-br from-white via-primary/20 to-white py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-black mb-3">Why gym owners choose Gymz</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Built for owners who want higher revenue and stronger retention.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reasons.map((reason) => (
            <Card key={reason.title} className="border-border/60">
              <CardHeader>
                <CardTitle className="text-xl">{reason.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">
                {reason.text}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
