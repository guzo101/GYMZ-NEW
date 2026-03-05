import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, Send } from "lucide-react";

interface Step9Props {
    gym: any;
    gymId: string;
    onSubmitComplete: () => void;
}

const CHECKLIST_ITEMS = [
    { label: "Identity & Contacts", check: (g: any) => !!g.name && !!g.gymContacts?.some((c: any) => c.contactType === "primary") },
    { label: "Branches configured", check: (g: any) => (g.gymBranches?.length || 0) > 0 },
    { label: "Operating hours set", check: (g: any) => (g.gymHours?.length || 0) >= 5 },
    { label: "Membership plans defined", check: (g: any) => (g.gymMembershipPlans?.filter((p: any) => p.isActive)?.length || 0) > 0 },
    { label: "Facilities listed", check: (g: any) => (g.gymFacilitiesEquipment?.length || 0) > 0 },
    { label: "Photos uploaded (≥3)", check: (g: any) => (g.gymMediaAssets?.length || 0) >= 3 },
    { label: "Payment methods configured", check: (g: any) => (g.gymPaymentMethods?.length || 0) > 0 },
    { label: "Verification documents uploaded", check: (g: any) => (g.gymVerificationDocuments?.length || 0) > 0 },
];

export default function Step9Review({ gym, gymId, onSubmitComplete }: Step9Props) {
    const [submitting, setSubmitting] = useState(false);

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
    const score = Math.max(dbScore, computeLocalScore(gym));
    const passing = CHECKLIST_ITEMS.filter(item => item.check(gym));
    const failing = CHECKLIST_ITEMS.filter(item => !item.check(gym));
    const canSubmit = failing.length === 0 || score >= 60;

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const { error } = await supabase.from("gym_onboarding_status").update({ status: "pending_verification" }).eq("gym_id", gymId);
            if (error) throw error;
            toast.success("Gym submitted for verification! Our team will review within 24–48 hours.");
            onSubmitComplete();
        } catch (err: any) {
            toast.error("Submission failed: " + err.message);
        }
        setSubmitting(false);
    };

    return (
        <div className="space-y-8 max-w-xl">
            {/* Score banner */}
            <div className={`p-8 rounded-2xl border transition-all glass-card ${score >= 80 ? 'border-primary/50' : score >= 60 ? 'border-yellow-500/50' : 'border-red-500/50'}`}>
                <div className={`text-6xl font-black mb-2 drop-shadow-sm ${score >= 80 ? 'text-primary' : score >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>{score}%</div>
                <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Profile Completeness</div>
                <div className="mt-4 w-full bg-muted/40 rounded-full h-2.5 overflow-hidden border border-border/20">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${score >= 80 ? 'bg-primary' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
                </div>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Completion Checklist</h3>
                {CHECKLIST_ITEMS.map(item => {
                    const ok = item.check(gym);
                    return (
                        <div key={item.label} className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${ok ? 'bg-primary/5 border-primary/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
                            {ok ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> : <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />}
                            <span className={`text-sm font-medium ${ok ? 'text-foreground' : 'text-yellow-200/80'}`}>{item.label}</span>
                            {!ok && <span className="ml-auto text-xs font-bold text-yellow-500 uppercase tracking-wider">Incomplete</span>}
                        </div>
                    );
                })}
            </div>

            {/* Warning if low score but allow early submission */}
            {score < 80 && score >= 60 && (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm">
                    <strong>Heads up:</strong> Your completeness is below 80%. You can submit now but the reviewer may request additional information before approving.
                </div>
            )}
            {score < 60 && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <strong>Not ready:</strong> Please complete more sections before submitting. At minimum, add an ID contact, branches, pricing, documents, and photos.
                </div>
            )}

            <Button onClick={handleSubmit} disabled={submitting || !canSubmit} className="w-full bg-green-600 hover:bg-green-700 rounded-xl h-14 text-lg font-bold gap-3 shadow-xl shadow-green-600/20">
                <Send className="h-5 w-5" />
                {submitting ? "Submitting..." : "Submit for Verification"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">After submission, a Gymz platform admin will review your application and contact you within 24–48 hours.</p>
        </div>
    );
}
