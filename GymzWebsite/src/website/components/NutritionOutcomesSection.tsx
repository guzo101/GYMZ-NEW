import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const outcomes = [
  {
    title: "Better client progress",
    detail: "Members follow clear nutrition guidance inside your ecosystem.",
  },
  {
    title: "Higher satisfaction",
    detail: "Better results increase trust in your gym and your coaching team.",
  },
  {
    title: "Longer member lifetime",
    detail: "Stronger outcomes help members stay consistent for longer.",
  },
];

export function NutritionOutcomesSection() {
  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Nutrition Outcomes</p>
          <h2 className="text-3xl md:text-4xl font-black mb-3">Retention grows when clients get results</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Gymz nutrition supports client goals and increases long-term membership value.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {outcomes.map((outcome) => (
            <Card key={outcome.title} className="border-border/60">
              <CardHeader>
                <CardTitle className="text-xl">{outcome.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{outcome.detail}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
