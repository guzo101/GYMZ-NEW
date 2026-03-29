import { Zap, Users, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Grow revenue faster",
    description: "Catch missed renewals and overdue accounts early.",
    stat: "Revenue focus",
    statLabel: "every day",
  },
  {
    icon: Users,
    title: "Serve members better",
    description: "Give your team one live view for faster follow-up.",
    stat: "Better service",
    statLabel: "less admin",
  },
  {
    icon: TrendingUp,
    title: "Scale with confidence",
    description: "Keep service quality consistent as you grow.",
    stat: "Cleaner operations",
    statLabel: "across locations",
  },
];

export function KeyFeaturesSection() {
  return (
    <section id="about" className="bg-gradient-to-br from-white via-primary/20 to-white py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black mb-4">Why owners choose Gymz</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            More revenue, better client service, and scalable operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 group"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={[
                      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=400&fit=crop&q=80",
                      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&q=80",
                      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop&q=80",
                    ][idx]}
                    alt={feature.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/50 to-transparent" />
                </div>
                <div className="p-8">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))] flex items-center justify-center mb-6 shadow-lg -mt-12 relative z-10">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="pt-6 border-t border-gray-200">
                    <div className="text-3xl font-black text-[hsl(var(--primary))] mb-1">
                      {feature.stat}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {feature.statLabel}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
