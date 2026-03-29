import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function VirginStyleHero() {
  const navigate = useNavigate();

  const handleNavClick = (href: string) => {
    if (href.startsWith("#")) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      navigate(href);
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary-hero-via))] to-[hsl(var(--primary-hero-to))]">
      <div className="relative max-w-7xl mx-auto px-6 py-12 md:py-16 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-secondary text-sm font-semibold mb-6">
              <Check className="h-4 w-4" />
              <span>Built for gym owners</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-[1.02] text-secondary">
              Run a more
              <br />
              profitable gym.
            </h1>

            <p className="text-lg md:text-2xl text-white/90 mb-8 max-w-xl leading-snug font-medium">
              More members join. More members stay. More monthly revenue for your gym.
            </p>

            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white/40 bg-white text-primary hover:bg-white/90 hover:text-primary px-6 py-4 text-base font-semibold"
              onClick={() => handleNavClick("#waitlist")}
            >
              Join Waitlist
            </Button>
            <p className="mt-5 max-w-md text-sm text-white/80">
              Waitlist early signups: <span className="font-semibold text-secondary">10% off</span> · Limited slots
            </p>
          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-white/15 bg-black/20 p-3 shadow-2xl">
              <video
                src="/img/hero video.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-[260px] md:h-[380px] object-cover rounded-[1.5rem]"
              />
            </div>
            <div className="absolute -bottom-4 left-4 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-xl">
              Live product preview
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
