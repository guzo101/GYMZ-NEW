import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "./SectionHeader";
import { offerHighlights } from "../data/content";

export function OfferHighlights() {
  return (
    <section id="pricing" className="space-y-10">
      <SectionHeader
        eyebrow="How to deploy"
        title="Pick the setup that matches your gym"
        description="Start with one branch or roll out across multiple sites."
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {offerHighlights.map((offer) => (
          <Card key={offer.title} className="flex flex-col border-border/60">
            <CardHeader>
              <Badge variant="outline" className="mb-4">
                {offer.priceLabel}
              </Badge>
              <CardTitle className="text-xl">{offer.title}</CardTitle>
              <CardDescription>{offer.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 flex-1">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {offer.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {perk}
                  </li>
                ))}
              </ul>
              <Button className="mt-auto" variant="secondary">
                Book Demo
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

