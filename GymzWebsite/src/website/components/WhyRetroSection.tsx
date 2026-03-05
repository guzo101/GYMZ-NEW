import { SectionHeader } from "./SectionHeader";

export function WhyRetroSection() {
  return (
    <section id="why" className="space-y-8">
      <SectionHeader
        eyebrow="Why Our Gym"
        title="Get in shape with a gym that feels like family"
        description="Gymz brings people together to get stronger, healthier and fitter as a community."
      />
      <p className="text-sm md:text-base text-muted-foreground max-w-3xl">
        We focus on the small details that make a big difference in your fitness journey — from how you&apos;re welcomed at
        the front desk to the support you feel in every session. This is a health gym that actually cares if you succeed.
      </p>
    </section>
  );
}



