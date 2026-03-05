import { SectionHeader } from "./SectionHeader";
import { facilityHighlights } from "../data/content";
import { Dumbbell, Sparkles, Monitor, Sun } from "lucide-react";

const iconMap = {
  Dumbbell,
  Sparkles,
  Monitor,
  Sun,
};

export function FacilityHighlights() {
  return (
    <section id="facilities" className="space-y-10">
      <SectionHeader
        eyebrow="Facility"
        title="Everything you need to train properly"
        description="No clutter, no broken gear. Just the tools you need to lift, sweat and recover."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {facilityHighlights.map((facility) => {
          const Icon = iconMap[facility.icon as keyof typeof iconMap] ?? Dumbbell;
          return (
            <div
              key={facility.name}
              className="p-6 rounded-2xl border bg-card/70 backdrop-blur flex gap-4"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{facility.name}</h3>
                <p className="text-sm text-muted-foreground">{facility.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

