import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface Step3Props {
    gym: any;
    gymId: string;
    onSaved: () => void;
}

const DAYS = [
    { key: "weekday_mon", label: "Monday" },
    { key: "weekday_tue", label: "Tuesday" },
    { key: "weekday_wed", label: "Wednesday" },
    { key: "weekday_thu", label: "Thursday" },
    { key: "weekday_fri", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
];

export default function Step3Hours({ gym, gymId, onSaved }: Step3Props) {
    const existingHours: Record<string, any> = {};
    (gym?.gymHours || []).forEach((h: any) => { existingHours[h.dayType] = h; });

    const defaultHours = DAYS.reduce((acc, d) => {
        acc[d.key] = {
            isClosed: existingHours[d.key]?.isClosed ?? (d.key === "sunday"),
            openTime: existingHours[d.key]?.openTime ?? "06:00",
            closeTime: existingHours[d.key]?.closeTime ?? "22:00",
        };
        return acc;
    }, {} as Record<string, any>);

    const [hours, setHours] = useState(defaultHours);
    const [saving, setSaving] = useState(false);

    const updateHour = (day: string, field: string, value: any) => {
        setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await supabase.from("gym_hours").delete().match({ gym_id: gymId, branch_id: null });
            const toInsert = DAYS.map(d => DataMapper.toDb({
                gymId: gymId,
                dayType: d.key,
                isClosed: hours[d.key].isClosed,
                openTime: hours[d.key].isClosed ? null : hours[d.key].openTime,
                closeTime: hours[d.key].isClosed ? null : hours[d.key].closeTime,
            }));
            const { error } = await supabase.from("gym_hours").insert(toInsert);
            if (error) throw error;
            await supabase.rpc("refresh_gym_completeness_score", { p_gym_id: gymId });
            toast.success("Operating hours saved!");
            onSaved();
        } catch (err: any) {
            toast.error("Failed to save hours: " + err.message);
        }
        setSaving(false);
    };

    return (
        <div className="space-y-4 max-w-lg">
            <p className="text-muted-foreground text-sm">Set your operating hours for each day of the week.</p>
            <div className="space-y-2">
                {DAYS.map(d => (
                    <div key={d.key} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${hours[d.key].isClosed ? 'border-border/20 bg-muted/30 opacity-60' : 'border-border/40 bg-card/40 backdrop-blur-sm'}`}>
                        <div className="w-28 shrink-0">
                            <span className="text-sm font-medium">{d.label}</span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={hours[d.key].isClosed}
                                onChange={e => updateHour(d.key, "isClosed", e.target.checked)}
                                className="w-4 h-4 accent-primary"
                            />
                            <span className="text-xs text-muted-foreground">Closed</span>
                        </label>
                        {!hours[d.key].isClosed && (
                            <>
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs text-muted-foreground">Open</Label>
                                    <input
                                        type="time"
                                        value={hours[d.key].openTime}
                                        onChange={e => updateHour(d.key, "openTime", e.target.value)}
                                        className="bg-background border border-input rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary transition-all shadow-sm"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs text-muted-foreground">Close</Label>
                                    <input
                                        type="time"
                                        value={hours[d.key].closeTime}
                                        onChange={e => updateHour(d.key, "closeTime", e.target.value)}
                                        className="bg-background border border-input rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary transition-all shadow-sm"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Operating Hours"}
            </Button>
        </div>
    );
}
