import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, MapPin } from "lucide-react";
import { useState } from "react";

export function VirtualTourSection() {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);

  // Cinematic Gym Tour Placeholder ID
  const videoId = "JzJ9xJ5D8r0";

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
    <section className="bg-gradient-to-br from-white via-primary/20 to-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-black mb-6">
              See What You Get
            </h2>
            <p className="text-base text-muted-foreground mb-8 leading-relaxed">
              See the gym, equipment, and facilities.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))] px-6 py-4 text-base font-semibold shadow-lg"
                onClick={() => setIsPlaying(true)}
              >
                <Play className="mr-2 h-4 w-4" />
                Take Virtual Tour
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-gray-300 hover:border-[hsl(var(--primary))] px-6 py-4 text-base font-semibold"
                onClick={() => handleNavClick("#location")}
              >
                <MapPin className="mr-2 h-4 w-4" />
                Find Our Location
              </Button>
            </div>
          </div>

          <div className="relative">
            <div
              className="aspect-video border border-gray-300 rounded-2xl overflow-hidden group cursor-pointer shadow-xl relative"
              onClick={() => setIsPlaying(true)}
            >
              {isPlaying ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                  title="Gym Facility Tour"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                ></iframe>
              ) : (
                <>
                  <img
                    src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1280&h=720&fit=crop&q=80"
                    alt="Gymz gym facility tour"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="w-20 h-20 rounded-full bg-white backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl">
                      <Play className="h-8 w-8 text-[hsl(var(--primary))] ml-1" fill="currentColor" />
                    </div>
                  </div>
                  <div className="absolute bottom-6 left-6 right-6 z-10">
                    <p className="text-white font-semibold mb-1">Facility Tour</p>
                    <p className="text-white/80 text-sm">See our gym floor, studios, and amenities</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
