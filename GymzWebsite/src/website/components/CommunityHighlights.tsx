import { SectionHeader } from "./SectionHeader";
import { communityMetrics, testimonials } from "../data/content";
import { Card, CardContent } from "@/components/ui/card";

export function CommunityHighlights() {
  return (
    <section id="community" className="space-y-10">
      <SectionHeader
        eyebrow="Outcomes"
        title="What Gymz is built to deliver"
        description="Value we design for—swap in verified client quotes when you have approvals."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-4">
          {communityMetrics.map((metric) => (
            <Card key={metric.label} className="p-6 border-border/60">
              <CardContent className="space-y-2 p-0">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="text-3xl font-bold">{metric.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{metric.helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.name}
              className="rounded-2xl border bg-card/80 p-4 flex gap-3 items-start"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                {testimonial.name.charAt(0)}
              </div>
              <CardContent className="p-0 space-y-2">
                <p className="text-sm leading-relaxed">
                  “{testimonial.quote.replace(/(^“|”$)/g, "")}”
                </p>
                <div>
                  <p className="text-sm font-semibold">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

