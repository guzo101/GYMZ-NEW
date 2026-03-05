import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Tag } from "lucide-react";

interface Step4Props {
    gym: any;
    gymId: string;
    onSaved: () => void;
}

const PLAN_TYPES = ["daily", "weekly", "monthly", "3_months", "6_months", "annual", "custom"];

const emptyPlan = {
    planType: "monthly",
    accessModeScope: "gym_access",
    planName: "",
    price: "",
    durationDays: "",
    includesClasses: false,
    includesTrainer: false,
    accessHoursNote: "",
    customInclusionsText: "",
};

export default function Step4Pricing({ gym, gymId, onSaved }: Step4Props) {
    const [plans, setPlans] = useState<any[]>(
        gym?.gymMembershipPlans?.length > 0
            ? gym.gymMembershipPlans.map((p: any) => ({
                ...p,
                price: String(p.price),
                accessModeScope: p.accessModeScope || "gym_access",
                customInclusionsText: Array.isArray(p.customInclusions) ? p.customInclusions.join("\n") : "",
            }))
            : [{ ...emptyPlan }]
    );
    const [saving, setSaving] = useState(false);

    const addPlan = () => setPlans(prev => [...prev, { ...emptyPlan }]);
    const removePlan = (idx: number) => setPlans(prev => prev.filter((_, i) => i !== idx));
    const updatePlan = (idx: number, field: string, value: any) => {
        setPlans(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
    };

    const handleSave = async () => {
        if (plans.some(p => !p.planName.trim() || !p.price)) {
            toast.error("Each plan needs a name and price"); return;
        }
        setSaving(true);
        try {
            // Delete all and re-insert
            await supabase.from("gym_membership_plans").delete().eq("gym_id", gymId);
            const toInsert = plans.map((p, idx) => DataMapper.toDb({
                gymId: gymId,
                planType: p.planType,
                accessModeScope: p.accessModeScope || "gym_access",
                planName: p.planName,
                price: parseFloat(p.price),
                currency: gym?.currency || "ZMW",
                durationDays: p.durationDays ? parseInt(p.durationDays) : null,
                includesClasses: p.includesClasses,
                includesTrainer: p.includesTrainer,
                accessHoursNote: p.accessHoursNote || null,
                customInclusions: (p.customInclusionsText || "")
                    .split("\n")
                    .map((v: string) => v.trim())
                    .filter(Boolean),
                isActive: true,
                sortOrder: idx,
            }));
            const { error } = await supabase.from("gym_membership_plans").insert(toInsert);
            if (error) throw error;
            await supabase.rpc("refresh_gym_completeness_score", { p_gym_id: gymId });
            toast.success("Membership plans saved!");
            onSaved();
        } catch (err: any) {
            toast.error("Failed to save plans: " + err.message);
        }
        setSaving(false);
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">Define the membership plans available at this gym.</p>
                <Button type="button" variant="outline" onClick={addPlan} className="border-primary/30 text-primary hover:bg-primary/10 rounded-xl gap-2">
                    <Plus className="h-4 w-4" /> Add Plan
                </Button>
            </div>

            {plans.map((plan, idx) => (
                <div key={idx} className="p-6 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm space-y-4 hover:border-primary/30 transition-all shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-primary" />
                            <span className="font-bold text-sm">Plan {idx + 1}</span>
                        </div>
                        {plans.length > 1 && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => removePlan(idx)} className="text-red-500 hover:bg-red-500/10">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Plan Type *</Label>
                            <select value={plan.planType} onChange={e => updatePlan(idx, "planType", e.target.value)} className="h-10 px-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-all shadow-sm">
                                {PLAN_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ").toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Plan Name * <span className="text-muted-foreground text-xs">(shown to members)</span></Label>
                            <Input value={plan.planName} onChange={e => updatePlan(idx, "planName", e.target.value)} className="rounded-xl" placeholder="Premium Monthly" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Access Path Scope *</Label>
                            <select value={plan.accessModeScope || "gym_access"} onChange={e => updatePlan(idx, "accessModeScope", e.target.value)} className="h-10 px-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-all shadow-sm">
                                <option value="gym_access">Gym Access</option>
                                <option value="event_access">Event Access</option>
                                <option value="both">Both Paths</option>
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Price ({gym?.currency || "ZMW"}) *</Label>
                            <Input type="number" value={plan.price} onChange={e => updatePlan(idx, "price", e.target.value)} className="rounded-xl" placeholder="350.00" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Duration (days)</Label>
                            <Input type="number" value={plan.durationDays} onChange={e => updatePlan(idx, "durationDays", e.target.value)} className="rounded-xl" placeholder="30" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Access Hours Note</Label>
                            <Input value={plan.accessHoursNote} onChange={e => updatePlan(idx, "accessHoursNote", e.target.value)} className="rounded-xl" placeholder='e.g. "6am – 10pm"' />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                            <Label>Gym-specific inclusions <span className="text-muted-foreground text-xs">(one per line)</span></Label>
                            <textarea
                                value={plan.customInclusionsText || ""}
                                onChange={e => updatePlan(idx, "customInclusionsText", e.target.value)}
                                className="min-h-[88px] rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                placeholder={"Trainer access\nSpecial classes\nExtra support"}
                            />
                        </div>
                        <div className="flex items-end gap-6 pb-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={plan.includesClasses} onChange={e => updatePlan(idx, "includesClasses", e.target.checked)} className="w-4 h-4 accent-primary" />
                                <span className="text-sm">Includes Classes</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={plan.includesTrainer} onChange={e => updatePlan(idx, "includesTrainer", e.target.checked)} className="w-4 h-4 accent-primary" />
                                <span className="text-sm">Includes Trainer</span>
                            </label>
                        </div>
                    </div>
                </div>
            ))}

            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20">
                {saving ? "Saving..." : "Save Membership Plans"}
            </Button>
        </div>
    );
}
