import { Check } from "lucide-react";

const reasons = [
  "Owners: one clear operating view",
  "Coaches: less admin, more coaching",
  "Members: clear plans and progress",
  "Teams: consistent service across branches",
  "Business: stronger retention",
];

export function WhyJoinSection() {
  return (
    <section id="results" className="relative bg-gradient-to-br from-white via-primary/20 to-white py-20 px-6 overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 opacity-5">
        <img 
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&h=1080&fit=crop&q=80"
          alt="Gymz gym background"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="relative max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-black mb-12 text-center">
          Built for your whole team
        </h2>

        <div className="space-y-6">
          {reasons.map((reason, idx) => (
            <div key={idx} className="flex items-start gap-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))] flex items-center justify-center flex-shrink-0 shadow-lg">
                <Check className="h-5 w-5 text-white" />
              </div>
              <p className="text-lg text-foreground pt-1">{reason}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
