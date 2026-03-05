import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, CreditCard, Banknote, Smartphone } from "lucide-react";

interface Step7Props {
    gym: any;
    gymId: string;
    onSaved: () => void;
}

const PAYMENT_METHODS = [
    { key: "cash", label: "Cash", icon: Banknote, color: "text-green-500" },
    { key: "mobile_money", label: "Mobile Money", icon: Smartphone, color: "text-yellow-500" },
    { key: "card", label: "Card / POS", icon: CreditCard, color: "text-blue-500" },
    { key: "bank_transfer", label: "Bank Transfer", icon: CreditCard, color: "text-purple-500" },
];

export default function Step7Payment({ gym, gymId, onSaved }: Step7Props) {
    const existingMethods = gym?.gymPaymentMethods || [];

    const [methods, setMethods] = useState<any[]>(
        existingMethods.length > 0 ? existingMethods : []
    );
    const [saving, setSaving] = useState(false);

    const toggleMethod = (methodKey: string) => {
        const exists = methods.find(m => m.method === methodKey);
        if (exists) {
            setMethods(prev => prev.filter(m => m.method !== methodKey));
        } else {
            setMethods(prev => [...prev, { method: methodKey, providerName: "", accountNumber: "", instructions: "", isPrimary: methods.length === 0, isActive: true }]);
        }
    };

    const updateMethod = (methodKey: string, field: string, value: any) => {
        setMethods(prev => prev.map(m => m.method === methodKey ? { ...m, [field]: value } : m));
    };

    const setPrimary = (methodKey: string) => {
        setMethods(prev => prev.map(m => ({ ...m, isPrimary: m.method === methodKey })));
    };

    const handleSave = async () => {
        if (methods.length === 0) { toast.error("Add at least one payment method"); return; }
        setSaving(true);
        try {
            await supabase.from("gym_payment_methods").delete().eq("gym_id", gymId);
            const toInsert = methods.map(m => DataMapper.toDb({
                gymId: gymId,
                method: m.method,
                providerName: m.providerName || null,
                accountNumber: m.accountNumber || null,
                instructions: m.instructions || null,
                isPrimary: m.isPrimary,
                isActive: true,
            }));
            const { error } = await supabase.from("gym_payment_methods").insert(toInsert);
            if (error) throw error;
            await supabase.rpc("refresh_gym_completeness_score", { p_gym_id: gymId });
            toast.success("Payment methods saved!");
            onSaved();
        } catch (err: any) {
            toast.error("Failed to save payment methods: " + err.message);
        }
        setSaving(false);
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <p className="text-muted-foreground text-sm">Select the payment methods your gym accepts from members.</p>

            {/* Method toggles */}
            <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map(({ key, label, icon: Icon, color }) => {
                    const isSelected = methods.some(m => m.method === key);
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => toggleMethod(key)}
                            className={`p-4 rounded-2xl border text-left transition-all ${isSelected ? 'border-primary bg-primary/10 shadow-sm shadow-primary/5' : 'border-border/40 bg-card/40 hover:border-primary/30 hover:bg-card/60'}`}
                        >
                            <Icon className={`h-6 w-6 mb-2 ${isSelected ? 'text-primary' : color}`} />
                            <div className="text-sm font-bold">{label}</div>
                        </button>
                    );
                })}
            </div>

            {/* Details for selected methods */}
            {methods.map(m => {
                const meta = PAYMENT_METHODS.find(p => p.key === m.method);
                return (
                    <div key={m.method} className="p-6 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm space-y-4 hover:border-primary/30 transition-all shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-sm">{meta?.label} Details</span>
                            {!m.isPrimary && (
                                <Button type="button" size="sm" variant="ghost" onClick={() => setPrimary(m.method)} className="text-yellow-500 hover:bg-yellow-500/10 text-xs">
                                    Set as Primary
                                </Button>
                            )}
                            {m.isPrimary && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">PRIMARY</span>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {m.method === "mobile_money" && (
                                <div className="grid gap-2">
                                    <Label>Provider (e.g. Airtel Money)</Label>
                                    <Input value={m.providerName} onChange={e => updateMethod(m.method, "providerName", e.target.value)} className="rounded-xl" placeholder="Airtel Money / MTN MoMo" />
                                </div>
                            )}
                            {(m.method === "mobile_money" || m.method === "bank_transfer") && (
                                <div className="grid gap-2">
                                    <Label>Account / Till Number</Label>
                                    <Input value={m.accountNumber} onChange={e => updateMethod(m.method, "accountNumber", e.target.value)} className="rounded-xl" placeholder="77712345" />
                                </div>
                            )}
                            <div className="grid gap-2 md:col-span-2">
                                <Label>Payment Instructions (shown to member)</Label>
                                <Input value={m.instructions} onChange={e => updateMethod(m.method, "instructions", e.target.value)} className="rounded-xl" placeholder='e.g. "Pay at reception, get receipt"' />
                            </div>
                        </div>
                    </div>
                );
            })}

            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20">
                {saving ? "Saving..." : "Save Payment Methods"}
            </Button>
        </div>
    );
}
