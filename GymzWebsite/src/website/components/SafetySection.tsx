import { SectionHeader } from "./SectionHeader";
import { ShieldCheck, Camera, Sparkles, Users } from "lucide-react";

const items = [
  {
    icon: ShieldCheck,
    title: "Safe & Secure",
    text: "Secure entry, staffed hours and CCTV so you can focus on your workout.",
  },
  {
    icon: Sparkles,
    title: "Clean Every Day",
    text: "Equipment wiped down daily with a clear cleaning rota on display.",
  },
  {
    icon: Users,
    title: "Welcoming to All",
    text: "No ego, no judgment. Beginners and all fitness levels are expected here.",
  },
  {
    icon: Camera,
    title: "Women in Mind",
    text: "Lockers, changing areas and female staff on hand during peak hours.",
  },
];

export function SafetySection() {
  return (
    <section id="safety" className="space-y-10">
      <SectionHeader
        eyebrow="Environment"
        title="Feel safe, comfortable and looked after"
        description="Real gym. Real people. Clean, organised and designed so women and beginners feel at ease."
      />
      <div className="grid gap-4 md:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border bg-card/80 p-4 flex flex-col gap-2"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <item.icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}



