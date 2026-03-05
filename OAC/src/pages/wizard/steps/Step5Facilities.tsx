import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Camera, X, Loader2, Image as ImageIcon } from "lucide-react";

interface Step5Props {
    gym: any;
    gymId: string;
    onSaved: () => void;
}

const FACILITY_CATEGORIES: Record<string, string[]> = {
    cardio: ["Treadmills", "Ellipticals", "Spin Bikes", "Rowing Machines", "Stair Climbers", "Jump Ropes"],
    strength: ["Barbells & Plates", "Dumbbells (Full Set)", "Cable Machines", "Smith Machine", "Power Rack / Squat Rack", "Bench Press Stations"],
    machines: ["Leg Press", "Leg Extension / Curl", "Chest Press Machine", "Shoulder Press Machine", "Lat Pulldown", "Seated Row"],
    functional: ["Kettlebells", "Resistance Bands", "Battle Ropes", "TRX / Suspension", "Plyometric Boxes", "Medicine Balls"],
    amenity: ["Changing Rooms", "Showers", "Lockers", "Sauna / Steam Room", "Swimming Pool", "Juice Bar / Nutrition"],
    extras: ["Personal Training", "Group Classes", "Nutrition Coaching", "Body Composition Scan", "Parking", "WiFi"],
};

export default function Step5Facilities({ gym, gymId, onSaved }: Step5Props) {
    // Track selected as a Map of itemName -> { id, category, media: [] }
    const [selected, setSelected] = useState<Map<string, any>>(() => {
        const map = new Map<string, any>();
        (gym?.gymFacilitiesEquipment || []).forEach((f: any) => {
            map.set(f.itemName, {
                id: f.id,
                category: f.category === "amenities" ? "amenity" : f.category,
                media: f.gymEquipmentMedia || []
            });
        });
        return map;
    });

    const [customItems, setCustomItems] = useState<Record<string, string>>({
        cardio: "", strength: "", machines: "", functional: "", amenity: "", extras: ""
    });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingUploadItem = useRef<string | null>(null);

    const toggle = (item: string, category: string) => {
        setSelected(prev => {
            const next = new Map(prev);
            if (next.has(item)) {
                // If it has media, warn or just prevent deletion if risky? 
                // For now, allow deletion, which will cascade delete media in DB.
                next.delete(item);
            } else {
                next.set(item, { id: null, category, media: [] });
            }
            return next;
        });
    };

    const addCustom = (category: string) => {
        const val = customItems[category].trim();
        if (val) {
            setSelected(prev => new Map(prev).set(val, { id: null, category, media: [] }));
            setCustomItems(p => ({ ...p, [category]: "" }));
        }
    };

    const handleSave = async (silent = false) => {
        if (!silent) setSaving(true);
        try {
            // 1. Get current items in DB to find deletions
            const { data: currentDb } = await supabase.from("gym_facilities_equipment").select("id, item_name").eq("gym_id", gymId);
            const dbItemNames = new Set(currentDb?.map((i: any) => i.item_name) || []);
            const selectedItemNames = new Set(selected.keys());

            // 2. Delete items no longer selected
            const toDelete = currentDb?.filter((i: any) => !selectedItemNames.has(i.item_name)).map((i: any) => i.id) || [];
            if (toDelete.length > 0) {
                await supabase.from("gym_facilities_equipment").delete().in("id", toDelete);
            }

            // 3. Upsert selected items
            const toUpsert = Array.from(selected.entries()).map(([itemName, data]) => DataMapper.toDb({
                gymId: gymId,
                category: data.category,
                itemName: itemName,
                isAvailable: true
            }));

            if (toUpsert.length > 0) {
                const { data: upserted, error } = await supabase.from("gym_facilities_equipment").upsert(toUpsert, {
                    onConflict: 'gym_id, item_name'
                }).select();

                if (error) throw error;

                // Update local state with new IDs
                setSelected(prev => {
                    const next = new Map(prev);
                    upserted.forEach((u: any) => {
                        const mapped = DataMapper.fromDb(u);
                        const existing = next.get(mapped.itemName);
                        if (existing) next.set(mapped.itemName, { ...existing, id: mapped.id });
                    });
                    return next;
                });
            }

            await supabase.rpc("refresh_gym_completeness_score", { p_gym_id: gymId });
            if (!silent) {
                toast.success("Facilities saved!");
                onSaved();
            }
            return true;
        } catch (err: any) {
            if (!silent) toast.error("Failed to save: " + err.message);
            return false;
        } finally {
            if (!silent) setSaving(false);
        }
    };

    const triggerUpload = async (itemName: string) => {
        const item = selected.get(itemName);
        if (!item.id) {
            // Must save first to get an ID
            const success = await handleSave(true);
            if (!success) return;
        }
        pendingUploadItem.current = itemName;
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const itemName = pendingUploadItem.current;
        if (!file || !itemName) return;

        const item = selected.get(itemName);
        setUploading(itemName);

        try {
            const ext = file.name.split(".").pop();
            const path = `equipment/${gymId}/${item.id}/${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage.from("equipment-media").upload(path, file);
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from("equipment-media").getPublicUrl(path);

            const { data: mediaRecord, error: dbError } = await supabase.from("gym_equipment_media").insert(DataMapper.toDb({
                equipmentId: item.id,
                storagePath: path,
                publicUrl: urlData.publicUrl
            })).select().single();

            if (dbError) throw dbError;

            // Update local state
            setSelected(prev => {
                const next = new Map(prev);
                const current = next.get(itemName);
                if (current) {
                    next.set(itemName, {
                        ...current,
                        media: [...(current.media || []), DataMapper.fromDb(mediaRecord)]
                    });
                }
                return next;
            });
            toast.success(`Photo added to ${itemName}`);
        } catch (err: any) {
            toast.error("Upload failed: " + err.message);
        } finally {
            setUploading(null);
            pendingUploadItem.current = null;
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const removeMedia = async (itemName: string, mediaId: string, storagePath: string) => {
        try {
            await supabase.storage.from("equipment-media").remove([storagePath]);
            await supabase.from("gym_equipment_media").delete().eq("id", mediaId);

            setSelected(prev => {
                const next = new Map(prev);
                const current = next.get(itemName);
                if (current) {
                    next.set(itemName, {
                        ...current,
                        media: current.media.filter((m: any) => m.id !== mediaId)
                    });
                }
                return next;
            });
            toast.success("Photo removed");
        } catch (err: any) {
            toast.error("Delete failed: " + err.message);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <p className="text-muted-foreground text-sm">Select equipment and amenities. You can now add photos to individual items!</p>

            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

            {Object.entries(FACILITY_CATEGORIES).map(([category, items]) => {
                const categoryItems = Array.from(selected.entries())
                    .filter(([_, data]) => data.category === category)
                    .map(([name]) => name);

                const allItems = Array.from(new Set([...items, ...categoryItems]));

                return (
                    <div key={category}>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 capitalize">
                            {category === 'amenity' ? 'Amenities' : category}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {allItems.map(item => {
                                const isSelected = selected.has(item);
                                const data = selected.get(item);
                                const hasMedia = data?.media?.length > 0;
                                const isItemUploading = uploading === item;

                                return (
                                    <div key={item} className="relative group">
                                        <button
                                            type="button"
                                            onClick={() => toggle(item, category)}
                                            className={`pl-3 pr-2 py-1.5 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${isSelected ? 'border-primary bg-primary/10 text-primary shadow-sm shadow-primary/5' : 'border-border/40 bg-card/40 text-muted-foreground hover:border-primary/30 hover:bg-card/60'}`}
                                        >
                                            {item}
                                            {isSelected && (
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); triggerUpload(item); }}
                                                    className={`p-1 rounded-lg hover:bg-primary/20 transition-colors ${hasMedia ? 'text-green-500' : 'text-primary/60'}`}
                                                >
                                                    {isItemUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : hasMedia ? <ImageIcon className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                                                </div>
                                            )}
                                        </button>

                                        {/* Media Preview Overlay (only on hover when selected) */}
                                        {isSelected && hasMedia && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                <div className="bg-card border border-border/40 p-1.5 rounded-xl shadow-2xl flex gap-1 animate-in zoom-in-95 duration-200 pointer-events-auto">
                                                    {data.media.map((m: any) => (
                                                        <div key={m.id} className="relative w-12 h-12 rounded-lg overflow-hidden border border-border/20 group/media">
                                                            <img src={m.publicUrl} className="w-full h-full object-cover" />
                                                            <button
                                                                onClick={() => removeMedia(item, m.id, m.storagePath)}
                                                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity"
                                                            >
                                                                <X className="h-3 w-3 text-white" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div className="flex gap-1">
                                <Input
                                    value={customItems[category]}
                                    onChange={e => setCustomItems(p => ({ ...p, [category]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(category); } }}
                                    placeholder="+ Custom"
                                    className="h-8 w-28 text-xs rounded-xl"
                                />
                                <Button type="button" size="sm" variant="ghost" onClick={() => addCustom(category)} className="h-8 text-xs text-primary hover:bg-primary/10 px-2">Add</Button>
                            </div>
                        </div>
                    </div>
                );
            })}

            <div className="pt-2 flex items-center gap-4">
                <Button onClick={() => handleSave()} disabled={saving} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20">
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : `Save ${selected.size} Facilities`}
                </Button>
            </div>
        </div>
    );
}
