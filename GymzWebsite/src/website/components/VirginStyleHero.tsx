import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowRight, Check, MessageCircle } from "lucide-react";

export function VirginStyleHero() {
  const navigate = useNavigate();
  const [contactOpen, setContactOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    need: "",
    email: "",
    phone: "",
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const res = await fetch("https://hook.eu2.make.com/l0ee0cejpg67ojpczkyispww7aarpch6", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          source: "website-hero",
        }),
      });

      if (!res.ok) throw new Error("Failed to send");

      toast.success("Submitted! Admin will reply soon.");
      setContactOpen(false);
      setFormData({ name: "", need: "", email: "", phone: "" });
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="relative overflow-hidden">
      {/* Hero Background Video */}
      <div className="absolute inset-0">
        <video
          src="/img/hero video.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
      <div className="relative max-w-7xl mx-auto px-6 py-12 md:py-16 z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-sm text-[hsl(var(--primary))] text-sm font-semibold mb-8 shadow-lg">
            <Check className="h-4 w-4" />
            <span>Join 2,847+ members getting real results</span>
          </div>

          {/* Main Headline - tuned for gym owners & simplicity */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-6 leading-[1.1] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            Run your gym in one
            <br />
            <span className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))] bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              simple, powerful system
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base md:text-lg text-white mb-10 max-w-2xl mx-auto leading-relaxed drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] font-medium">
            Keep members, payments, and classes organized without spreadsheets or stress.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-2">
            <div className="flex flex-col items-center gap-1">
              <Button
                size="lg"
                className="bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))] px-6 py-4 text-base font-semibold shadow-xl hover:shadow-2xl transition-all group"
                onClick={() => setContactOpen(true)}
              >
                Talk to Admin
                <MessageCircle className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <span className="text-xs text-white bg-green-600/90 backdrop-blur-sm px-2 py-1 rounded shadow-lg">Admin is online</span>
            </div>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-gray-300 hover:border-[hsl(var(--primary))] px-6 py-4 text-base font-semibold"
              onClick={() => setContactOpen(true)}
            >
              Get Started
            </Button>
          </div>


        </div>
      </div>
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tell us what you need</DialogTitle>
            <DialogDescription>Share a quick note and the admin will reply shortly.</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="need">What do you need?</Label>
              <Textarea
                id="need"
                required
                value={formData.need}
                onChange={(e) => setFormData((p) => ({ ...p, need: e.target.value }))}
                placeholder="Tell us about your goals, timeline, or questions."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+260..."
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setContactOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending} className="bg-[hsl(var(--primary))] text-white">
                {sending ? "Sending..." : "Send to Admin"}
                {!sending && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
