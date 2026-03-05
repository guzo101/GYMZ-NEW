import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { submitWebsiteInquiry } from "../services/inquiries";

export function ContactSection() {
  const { toast } = useToast();
  const [formState, setFormState] = useState({
    full_name: "",
    email: "",
    phone: "",
    interest: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitWebsiteInquiry(formState);
      toast({
        title: "Thanks for reaching out!",
        description: "The front desk has the message and will respond shortly.",
      });
      setFormState({
        full_name: "",
        email: "",
        phone: "",
        interest: "",
        message: "",
      });
    } catch (error: any) {
      toast({
        title: "Message not sent",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="space-y-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card/80 p-6 shadow-lg">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Full name"
              value={formState.full_name}
              onChange={(e) => handleChange("full_name", e.target.value)}
              required
            />
            <Input
              placeholder="Email"
              type="email"
              value={formState.email}
              onChange={(e) => handleChange("email", e.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Phone"
              value={formState.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
            <Input
              placeholder="What are you interested in?"
              value={formState.interest}
              onChange={(e) => handleChange("interest", e.target.value)}
            />
          </div>
          <Textarea
            placeholder="Tell us about your goals, team size, or preferred start date..."
            rows={4}
            value={formState.message}
            onChange={(e) => handleChange("message", e.target.value)}
          />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to the front desk"}
          </Button>
        </form>
      </div>
    </section>
  );
}

