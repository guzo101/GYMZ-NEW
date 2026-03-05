import { useNavigate } from "react-router-dom";
import { ArrowRight, User, Target, Heart } from "lucide-react";

const specialists = [
  {
    icon: User,
    category: "Personal Training",
    title: "1-on-1 Coaching",
    description: "Get a program designed for your goals, your body, your schedule. Expert trainers who teach you to move better and get results faster.",
    link: "Meet the Team",
    href: "#trainers",
  },
  {
    icon: Target,
    category: "Group Training",
    title: "Small Group Sessions",
    description: "Train with others who share your goals. Get the motivation of a group with the attention of personal training.",
    link: "View Classes",
    href: "#groups",
  },
  {
    icon: Heart,
    category: "Health & Wellness",
    title: "Nutrition & Recovery",
    description: "Expert guidance on nutrition, recovery, and the mental side of training. Everything you need for complete results.",
    link: "Learn More",
    href: "#health",
  },
];

export function WellnessSpecialistsSection() {
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
    <section className="bg-gradient-to-br from-gray-50 via-primary/30 to-secondary/20 py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black mb-4">
            Expert Guidance Included
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {specialists.map((specialist, idx) => {
            const Icon = specialist.icon;
            const images = [
              "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&q=80",
              "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=400&fit=crop&q=80",
              "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=400&fit=crop&q=80",
            ];
            return (
              <div
                key={idx}
                className="bg-white border-l-4 border-[hsl(var(--primary))] rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group"
              >
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={images[idx]}
                    alt={specialist.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/50 to-transparent" />
                </div>
                <div className="p-8">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))] flex items-center justify-center mb-6 -mt-12 relative z-10 shadow-lg">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-sm text-[hsl(var(--primary))] uppercase tracking-wider font-semibold mb-2">
                    {specialist.category}
                  </p>
                  <h3 className="text-2xl font-bold mb-4">{specialist.title}</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {specialist.description}
                  </p>
                  <button
                    onClick={() => {
                      if (specialist.href.startsWith("#")) {
                        handleNavClick(specialist.href);
                      } else {
                        navigate("/contact?type=booking");
                      }
                    }}
                    className="text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors inline-flex items-center gap-2 font-semibold cursor-pointer"
                  >
                    {specialist.link} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
