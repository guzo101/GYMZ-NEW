import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Step1Identity from "./wizard/steps/Step1Identity";
import Step2Branches from "./wizard/steps/Step2Branches";
import Step3Hours from "./wizard/steps/Step3Hours";
import Step4Pricing from "./wizard/steps/Step4Pricing";
import Step5Facilities from "./wizard/steps/Step5Facilities";
import Step6Media from "./wizard/steps/Step6Media";
import Step7Payment from "./wizard/steps/Step7Payment";
import Step8Documents from "./wizard/steps/Step8Documents";
import Step9Review from "./wizard/steps/Step9Review";

const STEPS = [
    { label: "Identity & Contacts", shortLabel: "Identity" },
    { label: "Branches & Location", shortLabel: "Branches" },
    { label: "Operating Hours", shortLabel: "Hours" },
    { label: "Memberships & Pricing", shortLabel: "Pricing" },
    { label: "Facilities & Equipment", shortLabel: "Facilities" },
    { label: "Media Gallery", shortLabel: "Media" },
    { label: "Payment Methods", shortLabel: "Payments" },
    { label: "Verification Docs", shortLabel: "Documents" },
    { label: "Review & Submit", shortLabel: "Review" },
];

export default function GymOnboardingWizard() {
    const { gymId } = useParams<{ gymId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [gym, setGym] = useState<any>(null);
    const [activeStep, setActiveStep] = useState(1);

    useEffect(() => {
        if (gymId) fetchGymContext();
    }, [gymId]);

    const fetchGymContext = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("gyms")
            .select(`
        *,
        gym_onboarding_status (*),
        gym_branches (*),
        gym_contacts (*),
        gym_hours (*),
        gym_membership_plans (*),
        gym_facilities_equipment (*, gym_equipment_media (*)),
        gym_media_assets (*),
        gym_payment_methods (*),
        gym_verification_documents (*)
      `)
            .eq("id", gymId!)
            .single();

        if (error) {
            toast.error("Failed to load gym data");
            navigate("/");
        } else {
            setGym(DataMapper.fromDb(data));
        }
        setLoading(false);
    };

    const handleStepSaved = () => {
        fetchGymContext();
    };

    const computeLocalScore = (g: any): number => {
        if (!g) return 0;
        let s = 0;
        if (g.name && g.city) s += 10;
        if ((g.gymContacts?.length || 0) > 0) s += 10;
        if ((g.gymBranches?.length || 0) > 0) s += 10;
        if ((g.gymFacilitiesEquipment?.length || 0) > 0) s += 10;
        if ((g.gymMembershipPlans?.filter((p: any) => p.isActive)?.length || 0) > 0) s += 15;
        if ((g.gymHours?.length || 0) >= 5) s += 10;
        if ((g.gymMediaAssets?.length || 0) >= 3) s += 10;
        if ((g.gymPaymentMethods?.filter((p: any) => p.isActive)?.length || 0) > 0) s += 10;
        if ((g.gymVerificationDocuments?.length || 0) > 0) s += 15;
        return Math.min(s, 100);
    };

    const dbScore = gym?.gymOnboardingStatus?.[0]?.completenessScore ?? 0;
    const localScore = computeLocalScore(gym);
    const score = Math.max(dbScore, localScore);
    const status = gym?.gymOnboardingStatus?.[0]?.status ?? "draft";

    if (loading) {
        return (
            <div className="min-h-screen bg-mesh-glow flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-muted-foreground">Loading wizard...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-mesh-glow text-white flex flex-col">
            {/* Header */}
            <header className="border-b border-border/40 bg-card/50 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-18 flex items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground hover:bg-muted/10 shrink-0 rounded-full h-10 w-10">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="min-w-0">
                            <h1 className="font-bold text-lg tracking-tight truncate text-foreground">{gym?.name}</h1>
                            <p className="text-xs font-medium text-muted-foreground hidden sm:flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded-md bg-muted/40 border border-border/20">Step {activeStep} of {STEPS.length}</span>
                                <span className="opacity-50">•</span>
                                <span>{STEPS[activeStep - 1].label}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                        <div className="hidden md:flex items-center gap-3">
                            <div className="w-32 h-2.5 rounded-full bg-muted/40 border border-border/20 overflow-hidden">
                                <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${score}%` }} />
                            </div>
                            <span className={`text-sm font-black tracking-tighter ${score >= 80 ? 'text-primary' : score >= 60 ? 'text-yellow-500' : 'text-destructive'}`}>{score}%</span>
                        </div>
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest border transition-all ${status === 'active' ? 'bg-primary/10 text-primary border-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.05)]' :
                            status === 'pending_verification' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.05)]' :
                                'bg-muted/10 text-muted-foreground border-border/20'
                            }`}>{status.replace("_", " ")}</span>
                    </div>
                </div>
                {/* Step progress bar */}
                <div className="w-full h-1 bg-border/20">
                    <div className="h-1 bg-primary transition-all duration-500 ease-out" style={{ width: `${(activeStep / STEPS.length) * 100}%` }} />
                </div>
            </header>

            <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 flex gap-6 lg:gap-10">
                {/* Sidebar Nav */}
                <nav className="w-52 shrink-0 hidden lg:block">
                    <div className="space-y-1 sticky top-24">
                        {STEPS.map((step, i) => {
                            const num = i + 1;
                            const isCurrent = activeStep === num;
                            const isDone = activeStep > num;
                            return (
                                <button
                                    key={num}
                                    onClick={() => setActiveStep(num)}
                                    className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-3 border ${isCurrent ? 'bg-primary/10 text-primary border-primary/40 shadow-sm' :
                                        isDone ? 'text-primary/70 border-primary/20 hover:bg-muted/10' :
                                            'text-muted-foreground border-transparent hover:bg-muted/5 hover:text-foreground'
                                        }`}
                                >
                                    <span className={`flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black tracking-tighter border-2 transition-all ${isCurrent ? 'border-primary bg-primary text-background' :
                                        isDone ? 'border-primary/40 bg-primary/10 text-primary' :
                                            'border-muted/40 bg-muted/10'
                                        }`}>{isDone ? "✓" : num}</span>
                                    {step.shortLabel}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                {/* Content Area */}
                <div className="flex-1 min-w-0 flex flex-col">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold tracking-tight">{STEPS[activeStep - 1].label}</h2>
                        <p className="text-muted-foreground text-sm mt-1">Step {activeStep} of {STEPS.length}</p>
                    </div>

                    {/* Step content */}
                    <div className="flex-1">
                        {activeStep === 1 && <Step1Identity gym={gym} gymId={gymId!} onSaved={handleStepSaved} />}
                        {activeStep === 2 && <Step2Branches gym={gym} gymId={gymId!} onSaved={handleStepSaved} />}
                        {activeStep === 3 && <Step3Hours gym={gym} gymId={gymId!} onSaved={handleStepSaved} />}
                        {activeStep === 4 && <Step4Pricing gym={gym} gymId={gymId!} onSaved={handleStepSaved} />}
                        {activeStep === 5 && <Step5Facilities gym={gym} gymId={gymId!} onSaved={handleStepSaved} />}
                        {activeStep === 6 && <Step6Media gym={gym} gymId={gymId!} onSaved={handleStepSaved} />}
                        {activeStep === 7 && <Step7Payment gym={gym} gymId={gymId!} onSaved={handleStepSaved} />}
                        {activeStep === 8 && <Step8Documents gym={gym} gymId={gymId!} onSaved={handleStepSaved} />}
                        {activeStep === 9 && <Step9Review gym={gym} gymId={gymId!} onSubmitComplete={() => navigate("/")} />}
                    </div>

                    {/* Footer Navigation */}
                    <div className="flex justify-between items-center mt-10 pt-6 border-t border-white/5">
                        <Button
                            variant="outline"
                            onClick={() => setActiveStep(s => Math.max(1, s - 1))}
                            disabled={activeStep === 1}
                            className="border-border/40 bg-background/50 text-foreground hover:bg-muted/10 rounded-2xl px-8 h-12 font-bold transition-all"
                        >
                            ← Previous
                        </Button>
                        {activeStep < STEPS.length && (
                            <Button
                                onClick={() => setActiveStep(s => s + 1)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl px-10 h-12 font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Next Step →
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
