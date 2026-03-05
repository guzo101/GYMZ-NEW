/* @ts-nocheck */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { fetchGymPlans, PLATFORM_BENEFITS, type GymPlan } from "@/services/gymPricing";

interface SubscriptionModalProps {
  open: boolean;
  onClose?: () => void;
}

export function SubscriptionModal({ open, onClose }: SubscriptionModalProps) {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<GymPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const fetched = await fetchGymPlans(user?.gymId || null, user?.accessMode || null);
      setPlans(fetched);
      setLoading(false);
    };
    load();
  }, [user?.gymId, user?.accessMode]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    // Small delay to ensure state updates, then navigate
    setTimeout(() => {
      navigate(`/member/payments?plan=${planId}`);
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-5xl h-[90vh] p-0 flex flex-col" 
        onInteractOutside={(e) => e.preventDefault()} 
        onEscapeKeyDown={(e) => e.preventDefault()}
        style={{ maxHeight: '90vh' }}
      >
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold text-center">Choose Your Subscription Plan</DialogTitle>
          <DialogDescription className="text-center mt-2">
            Select a plan to unlock full access to your profile and all gym features
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6" style={{ minHeight: 0 }}>
          {loading && <div className="py-6 text-center text-muted-foreground">Loading pricing...</div>}
          {!loading && plans.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">Pricing not available for this gym. Checkout is blocked.</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative cursor-pointer transition-all hover:shadow-lg ${
                selectedPlan === plan.id
                  ? "ring-2 ring-primary shadow-lg"
                  : ""
              }`}
              onClick={() => handleSelectPlan(plan.id)}
            >
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{plan.planName}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.currency} {plan.price.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">/{plan.durationLabel}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Gym onboarding configured tier</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {[...PLATFORM_BENEFITS, ...plan.gymInclusions].map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${
                    selectedPlan === plan.id
                      ? "bg-primary text-white"
                      : "bg-secondary"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPlan(plan.id);
                  }}
                >
                  {selectedPlan === plan.id ? "Selected" : "Select Plan"}
                </Button>
              </CardContent>
            </Card>
          ))}
          </div>

          <div className="p-4 bg-muted rounded-lg mb-6">
            <p className="text-sm text-center text-muted-foreground">
              Only gym onboarding plans are shown here. If pricing is unavailable, checkout remains blocked.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

