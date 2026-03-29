import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "./SectionHeader";

const slots = [
  {
    title: "Owner Dashboard Screenshot",
    note: "Recommended: analytics + engagement view (16:9)",
    keyName: "hero_product_collage",
    imagePath: "/showcase/owner-dashboard.png",
  },
  {
    title: "Coach Workflow Screenshot",
    note: "Recommended: plan management + member progress",
    keyName: "coach_workflow_view",
    imagePath: "/showcase/coach-workflow.png",
  },
  {
    title: "Member App Screenshot",
    note: "Recommended: progress + accountability touchpoints",
    keyName: "member_experience_view",
    imagePath: "/showcase/member-app.png",
  },
  {
    title: "Smart Retrofit Visual",
    note: "Recommended: real machine + tablet/sensor context",
    keyName: "smart_retrofit_visual",
    imagePath: "/showcase/smart-retrofit.png",
  },
];

export function ShowcaseImageSlotsSection() {
  return (
    <section id="showcase" className="space-y-10">
      <SectionHeader
        eyebrow="Showcase"
        title="Product visuals to add before launch"
        description="Drop your approved screenshots and gym photos in these slots to strengthen trust and conversions."
      />
      <div className="grid gap-6 md:grid-cols-2">
        {slots.map((slot) => (
          <Card key={slot.keyName} className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">{slot.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-44 rounded-xl border border-border/70 bg-primary/5 overflow-hidden">
                <img
                  src={slot.imagePath}
                  alt={slot.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                File path: <span className="font-mono">{slot.imagePath}</span>
              </p>
              <p className="text-sm text-muted-foreground">{slot.note}</p>
              <p className="text-xs text-muted-foreground">
                Tracking key: <span className="font-semibold text-foreground">{slot.keyName}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
