import { useState } from "react";
import { Loader2, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { SectionHeader } from "./SectionHeader";
import { submitWebsiteInquiry } from "../services/inquiries";

export function GymOwnerWaitlistSection() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    full_name: "",
    email: "",
    phone: "",
    gym_name: "",
    location: "",
    members: "",
    message: "",
  });

  const updateField = (field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormState({
      full_name: "",
      email: "",
      phone: "",
      gym_name: "",
      location: "",
      members: "",
      message: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await submitWebsiteInquiry({
        full_name: formState.full_name,
        email: formState.email,
        phone: formState.phone,
        gym_name: formState.gym_name.trim() || undefined,
        gym_location: formState.location.trim() || undefined,
        approx_members: formState.members.trim() || undefined,
        interest:
          "Gym owner waitlist — 10% early signup (limited slots)",
        message: formState.message.trim() || undefined,
        source: "gym_owner_waitlist",
      });

      toast({
        title: "You are on the waitlist",
        description: "Thanks — we will confirm your early-access 10% benefit and next steps.",
      });
      resetForm();
    } catch (error: any) {
      toast({
        title: "Waitlist signup failed",
        description: error?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="waitlist" className="py-16 px-6 bg-gradient-to-br from-background via-primary/8 to-background">
      <div className="max-w-7xl mx-auto space-y-8">
        <SectionHeader
          eyebrow="Gym Owner Waitlist"
          title="Join the Gymz waitlist"
          description="Early signups get 10% off. Limited slots — secure your place and onboarding priority."
          align="center"
        />
        <div className="mx-auto max-w-4xl rounded-xl border border-secondary/35 bg-secondary/15 px-4 py-3 text-center shadow-sm">
          <p className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-foreground md:text-base">
            <Tag className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>Early access:</span>
            <span className="text-primary">10% off</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Limited slots for founding gyms</span>
          </p>
        </div>
        <div className="mx-auto max-w-4xl rounded-2xl border bg-card/80 p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Your full name"
                value={formState.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                required
              />
              <Input
                placeholder="Work email"
                type="email"
                value={formState.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Phone number"
                value={formState.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
              <Input
                placeholder="Gym name"
                value={formState.gym_name}
                onChange={(e) => updateField("gym_name", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="City / country"
                value={formState.location}
                onChange={(e) => updateField("location", e.target.value)}
              />
              <Input
                placeholder="Approx. active members"
                value={formState.members}
                onChange={(e) => updateField("members", e.target.value)}
              />
            </div>
            <Textarea
              placeholder="Rollout timeline (optional)"
              rows={3}
              value={formState.message}
              onChange={(e) => updateField("message", e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Waitlist"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
