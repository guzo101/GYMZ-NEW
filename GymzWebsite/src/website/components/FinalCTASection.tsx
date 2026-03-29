import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCTASection() {
  const navigate = useNavigate();
  const scrollToProof = () => {
    const element = document.querySelector("#proof");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate("/");
  };

  const scrollToWaitlist = () => {
    const element = document.querySelector("#waitlist");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="relative bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))] py-20 px-6 overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img 
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&h=1080&fit=crop&q=80"
          alt="Fitness motivation"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))]/90 to-[hsl(var(--primary))]/90" />
      </div>
      <div className="relative max-w-4xl mx-auto text-center z-10">
        <div className="mx-auto mb-6 max-w-2xl rounded-xl border border-white/40 bg-white/10 px-4 py-3 text-sm text-white/90">
          Add approved team photo here.
        </div>
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6 text-white">
          Ready to grow monthly revenue with Gymz?
        </h2>
        <p className="text-xl text-white/90 mb-12">
          See what you get as an owner and for your members, then join the waitlist.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-white text-[hsl(var(--primary))] hover:bg-gray-100 px-8 py-6 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all group"
            onClick={scrollToProof}
          >
            See what you get
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg font-semibold"
            onClick={scrollToWaitlist}
          >
            Join Waitlist
          </Button>
        </div>
      </div>
    </section>
  );
}
