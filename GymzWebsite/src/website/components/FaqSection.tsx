import { SectionHeader } from "./SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const faqs = [
  {
    question: "How long does setup take?",
    answer: "Setup timeline depends on location count, team size, and rollout scope.",
  },
  {
    question: "Do we need to replace all machines?",
    answer: "Not necessarily. Gymz supports retrofit planning for compatible equipment.",
  },
  {
    question: "Can we launch at one location first?",
    answer: "Yes. Many teams start with a pilot site and scale to additional branches.",
  },
  {
    question: "How do you measure ROI?",
    answer: "Most operators track retention, engagement, and operational efficiency trends.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="py-16 px-6 bg-white">
      <div className="max-w-7xl mx-auto space-y-10">
        <SectionHeader
          eyebrow="FAQ"
          title="Common rollout questions"
          description="Quick answers before you launch."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <Card key={faq.question} className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {faq.answer}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
