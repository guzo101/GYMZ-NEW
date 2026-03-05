import { Button } from "@/components/ui/button";
import { Smartphone, X } from "lucide-react";
import { useState } from "react";

export function AppDownloadBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))] text-white py-3 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Smartphone className="h-5 w-5" />
          <div>
            <p className="font-semibold text-sm">Get the Gymz app</p>
            <p className="text-xs text-white/90">Book classes, track progress, earn rewards</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 bg-white/5"
            asChild
          >
            <a href="#android" target="_blank" rel="noopener noreferrer">
              Android
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 bg-white/5"
            asChild
          >
            <a href="#ios" target="_blank" rel="noopener noreferrer">
              iPhone
            </a>
          </Button>
          <button
            onClick={() => setIsVisible(false)}
            className="ml-2 p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


