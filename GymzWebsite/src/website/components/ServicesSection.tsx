import { SectionHeader } from "./SectionHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const services = [
  {
    title: "Physiotherapy",
    description:
      "From injury recovery to better mobility, our physio team blends traditional and modern methods to keep you moving.",
  },
  {
    title: "Spa / Massage",
    description:
      "Relax and reset with curated massage treatments designed to release tension and revive tired muscles.",
  },
  {
    title: "Fat Freezing",
    description:
      "A non‑surgical option that targets stubborn fat with controlled cooling as part of a broader wellness plan.",
  },
  {
    title: "Personal Training",
    description:
      "Work 1:1 with a trainer for tailored workouts, better technique and steady progress toward your goals.",
  },
];

export function ServicesSection() {
  return (
    <section id="services" className="space-y-10">
      <SectionHeader
        eyebrow="Services"
        title="More than just a gym floor"
        description="From recovery to performance, we’ve built services around what real members need day to day."
      />
      <div className="grid gap-6 md:grid-cols-4">
        {services.map((service) => (
          <Card key={service.title} className="h-full border-border/60">
            <CardHeader>
              <CardTitle className="text-base md:text-lg">{service.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm">{service.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}



