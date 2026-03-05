import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar } from "lucide-react";

const classes = [
  {
    name: "Strength Training",
    title: "Strength",
    description: "Build real strength",
  },
  {
    name: "HIIT",
    title: "HIIT",
    description: "High intensity training",
  },
  {
    name: "Yoga & Mobility",
    title: "Yoga",
    description: "Flexibility and recovery",
  },
  {
    name: "Boxing",
    title: "Boxing",
    description: "Cardio and technique",
  },
];

export function ClassesSection() {
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
    <section id="programs" className="bg-gradient-to-br from-white via-primary/20 to-white py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Classes
            </h2>
          </div>
          <Button
            variant="outline"
            className="border-2 border-gray-300 hover:border-[hsl(var(--primary))]"
            onClick={() => handleNavClick("#timetable")}
          >
            <Calendar className="mr-2 h-4 w-4" />
            View Schedule
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {classes.map((classItem, idx) => {
            const classImages = [
              "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=400&fit=crop&q=80",
              "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&q=80",
              "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=400&fit=crop&q=80",
              "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop&q=80",
            ];
            return (
              <div
                key={idx}
                className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 group cursor-pointer"
              >
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={classImages[idx]}
                    alt={classItem.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">{classItem.title}</h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    {classItem.description}
                  </p>
                  <button
                    onClick={() => navigate("/contact?type=booking")}
                    className="text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors inline-flex items-center gap-2 text-sm font-semibold group-hover:gap-3 cursor-pointer"
                  >
                    View Details <ArrowRight className="h-4 w-4" />
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
