import { SectionHeader } from "./SectionHeader";

export function WatchUsSection() {
  return (
    <section id="watch" className="space-y-8">
      <SectionHeader
        eyebrow="Experience"
        title="The fitness you’ll actually enjoy"
        description="Training at Gymz shouldn't feel like a chore — it should feel like a place you want to be."
      />
      <p className="text-sm md:text-base text-muted-foreground max-w-3xl">
        Beyond the gym floor, you&apos;ll find spa treatments, physiotherapy and a Gymz Family that cheers you on. Clean,
        modern facilities and customised plans from certified trainers make every session feel purposeful, not random.
      </p>
    </section>
  );
}



