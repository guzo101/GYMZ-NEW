import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Star } from "lucide-react";

interface Step2Props {
    gym: any;
    gymId: string;
    onSaved: () => void;
}

const emptyBranch = {
    branchName: "", address: "", city: "", phone: "",
    googleMapsUrl: "", directionsText: "", lat: "", lng: "", isPrimary: false,
};

export default function Step2Branches({ gym, gymId, onSaved }: Step2Props) {
    const [branches, setBranches] = useState<any[]>(
        gym?.gymBranches?.length > 0 ? gym.gymBranches : [{ ...emptyBranch, isPrimary: true }]
    );
    const [saving, setSaving] = useState(false);

    const addBranch = () => setBranches(prev => [...prev, { ...emptyBranch }]);
    const removeBranch = (idx: number) => setBranches(prev => prev.filter((_, i) => i !== idx));
    const updateBranch = (idx: number, field: string, value: any) => {
        setBranches(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
    };
    const setPrimary = (idx: number) => {
        setBranches(prev => prev.map((b, i) => ({ ...b, isPrimary: i === idx })));
    };

    const handleSave = async () => {
        if (branches.some(b => !b.branchName.trim() || !b.address.trim() || !b.city.trim())) {
            toast.error("All branches need a name, address, and city"); return;
        }
        if (!branches.some(b => b.isPrimary)) {
            toast.error("Set at least one branch as primary"); return;
        }
        setSaving(true);
        try {
            // Delete all existing branches for a clean upsert
            await supabase.from("gym_branches").delete().eq("gym_id", gymId);

            const toInsert = branches.map(b => DataMapper.toDb({
                gymId: gymId,
                branchName: b.branchName,
                address: b.address,
                city: b.city,
                phone: b.phone || null,
                googleMapsUrl: b.googleMapsUrl || null,
                directionsText: b.directionsText || null,
                lat: b.lat ? parseFloat(b.lat) : null,
                lng: b.lng ? parseFloat(b.lng) : null,
                isPrimary: b.isPrimary,
                isActive: true,
            }));

            const { error } = await supabase.from("gym_branches").insert(toInsert);
            if (error) throw error;

            // Update gym city from primary branch
            const primary = branches.find(b => b.isPrimary);
            if (primary) {
                await supabase.from("gyms").update({ city: primary.city }).eq("id", gymId);
            }

            await supabase.rpc("refresh_gym_completeness_score", { p_gym_id: gymId });
            toast.success("Branches saved!");
            onSaved();
        } catch (err: any) {
            toast.error("Failed to save branches: " + err.message);
        }
        setSaving(false);
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">Add all gym locations. Mark the main one as primary.</p>
                <Button type="button" variant="outline" onClick={addBranch} className="border-primary/30 text-primary hover:bg-primary/10 rounded-xl gap-2">
                    <Plus className="h-4 w-4" /> Add Branch
                </Button>
            </div>

            {branches.map((branch, idx) => (
                <div key={idx} className={`p-6 rounded-2xl border space-y-4 transition-all ${branch.isPrimary ? 'border-primary bg-primary/5 shadow-lg shadow-primary/5' : 'border-border/40 bg-card/40 backdrop-blur-sm'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="font-bold text-sm">Branch {idx + 1}</span>
                            {branch.isPrimary && <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">PRIMARY</span>}
                        </div>
                        <div className="flex gap-2">
                            {!branch.isPrimary && (
                                <Button type="button" size="sm" variant="ghost" onClick={() => setPrimary(idx)} className="text-yellow-500 hover:bg-yellow-500/10 gap-1 text-xs">
                                    <Star className="h-3 w-3" /> Set Primary
                                </Button>
                            )}
                            {branches.length > 1 && (
                                <Button type="button" size="sm" variant="ghost" onClick={() => removeBranch(idx)} className="text-red-500 hover:bg-red-500/10">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Branch Name *</Label>
                            <Input value={branch.branchName} onChange={e => updateBranch(idx, "branchName", e.target.value)} className="rounded-xl" placeholder="Main Branch / Woodlands Branch" />
                        </div>
                        <div className="grid gap-2">
                            <Label>City *</Label>
                            <Input value={branch.city} onChange={e => updateBranch(idx, "city", e.target.value)} className="rounded-xl" placeholder="Lusaka" />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                            <Label>Full Address *</Label>
                            <Input value={branch.address} onChange={e => updateBranch(idx, "address", e.target.value)} className="rounded-xl" placeholder="Plot 123, Addis Ababa Drive, Lusaka" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Phone</Label>
                            <Input value={branch.phone} onChange={e => updateBranch(idx, "phone", e.target.value)} className="rounded-xl" placeholder="+260 97..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>Google Maps URL</Label>
                            <Input value={branch.googleMapsUrl} onChange={e => updateBranch(idx, "googleMapsUrl", e.target.value)} className="rounded-xl" placeholder="https://maps.google.com/..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>Latitude (optional)</Label>
                            <Input value={branch.lat} onChange={e => updateBranch(idx, "lat", e.target.value)} className="rounded-xl" placeholder="-15.4166" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Longitude (optional)</Label>
                            <Input value={branch.lng} onChange={e => updateBranch(idx, "lng", e.target.value)} className="rounded-xl" placeholder="28.2833" />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                            <Label>Directions / Landmarks</Label>
                            <Input value={branch.directionsText} onChange={e => updateBranch(idx, "directionsText", e.target.value)} className="rounded-xl" placeholder="Opposite Shoprite, next to the Airtel office" />
                        </div>
                    </div>
                </div>
            ))}

            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20">
                {saving ? "Saving..." : "Save Branches"}
            </Button>
        </div>
    );
}
