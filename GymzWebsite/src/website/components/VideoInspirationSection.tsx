import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, ArrowRight } from "lucide-react";
import { useState } from "react";

const videos = [
  {
    title: "15-Minute High Intensity",
    duration: "15 Mins",
    type: "Perfect for busy schedules",
    thumbnail: "bg-gradient-to-br from-primary to-secondary",
    embedId: "8zDyH0MavsQ",
  },
  {
    title: "Strength Fundamentals",
    duration: "30 Mins",
    type: "Build real strength",
    thumbnail: "bg-gradient-to-br from-primary to-primary",
    embedId: "vI1Yf-MBczI",
  },
  {
    title: "Mobility & Recovery",
    duration: "20 Mins",
    type: "Move better, feel better",
    thumbnail: "bg-gradient-to-br from-primary to-secondary",
    embedId: "L_xrDAqp9vQ",
  },
];

export function VideoInspirationSection() {
  const navigate = useNavigate();
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

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
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Workout Videos
            </h2>
          </div>
          <Button
            variant="ghost"
            className="hidden md:flex"
            onClick={() => handleNavClick("#videos")}
          >
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {videos.map((video, idx) => (
            <div
              key={idx}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden group cursor-pointer hover:shadow-xl transition-all"
            >
              <div
                className={`aspect-video ${video.thumbnail} flex items-center justify-center relative`}
                onClick={() => setPlayingVideo(video.embedId)}
              >
                {playingVideo === video.embedId ? (
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${video.embedId}?autoplay=1`}
                    title={video.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  ></iframe>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                    <div className="relative z-10">
                      <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <Play className="h-6 w-6 text-[hsl(var(--primary))] ml-1" fill="currentColor" />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{video.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {video.duration} • {video.type}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
