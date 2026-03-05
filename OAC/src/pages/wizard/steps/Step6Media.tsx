import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2, Image, CheckCircle2, Loader2 } from "lucide-react";

interface Step6Props {
    gym: any;
    gymId: string;
    onSaved: () => void;
}

const MEDIA_TYPES = [
    { key: "logo", label: "Logo" },
    { key: "entrance", label: "Entrance" },
    { key: "main_floor", label: "Main Floor" },
    { key: "cardio", label: "Cardio Area" },
    { key: "free_weights", label: "Free Weights" },
    { key: "machines", label: "Machines" },
    { key: "class_room", label: "Class Room" },
    { key: "changing_rooms", label: "Changing Rooms" },
    { key: "exterior", label: "Exterior" },
    { key: "other", label: "Other" },
];

export default function Step6Media({ gym, gymId, onSaved }: Step6Props) {
    const [existing, setExisting] = useState<any[]>(gym?.gymMediaAssets || []);
    const [uploading, setUploading] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState("main_floor");
    const fileRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (file: File) => {
        if (!file) return;
        const ext = file.name.split(".").pop();
        const path = `gym-media/${gymId}/${Date.now()}-${selectedType}.${ext}`;
        setUploading(selectedType);
        try {
            const { error: uploadError } = await supabase.storage.from("oac-media").upload(path, file, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from("oac-media").getPublicUrl(path);

            const { data: inserted, error: dbError } = await supabase.from("gym_media_assets").insert(DataMapper.toDb({
                gymId: gymId,
                assetType: selectedType,
                storagePath: path,
                publicUrl: urlData.publicUrl,
                fileName: file.name,
                fileSizeBytes: file.size,
                mimeType: file.type,
                displayOrder: existing.length,
            })).select().single();

            if (dbError) throw dbError;
            setExisting(prev => [...prev, DataMapper.fromDb(inserted)]);
            await supabase.rpc("refresh_gym_completeness_score", { p_gym_id: gymId });
            toast.success("Photo uploaded!");
            onSaved();
        } catch (err: any) {
            toast.error("Upload failed: " + err.message);
        }
        setUploading(null);
    };

    const handleDelete = async (asset: any) => {
        try {
            await supabase.storage.from("oac-media").remove([asset.storagePath]);
            await supabase.from("gym_media_assets").delete().eq("id", asset.id);
            setExisting(prev => prev.filter(a => a.id !== asset.id));
            await supabase.rpc("refresh_gym_completeness_score", { p_gym_id: gymId });
            toast.success("Photo removed");
            onSaved();
        } catch (err: any) {
            toast.error("Could not delete: " + err.message);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <p className="text-muted-foreground text-sm">Upload photos to showcase this gym. At least 3 photos are required for approval.</p>

            {/* Upload control */}
            <div className="p-8 rounded-2xl border-2 border-dashed border-primary/20 bg-background/40 hover:bg-background/60 hover:border-primary/40 transition-all space-y-4 text-center">
                <div className="grid gap-2">
                    <label className="text-sm font-medium">Photo Category</label>
                    <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="h-10 px-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-all shadow-sm w-full max-w-xs mx-auto">
                        {MEDIA_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ""; }} />
                <Button type="button" onClick={() => fileRef.current?.click()} disabled={!!uploading} className="bg-primary hover:bg-primary/90 rounded-xl gap-2">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Uploading..." : "Upload Photo"}
                </Button>
            </div>

            {/* Existing photos grid */}
            {existing.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">{existing.length} photo{existing.length !== 1 ? "s" : ""} uploaded</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {existing.map((asset) => (
                            <div key={asset.id} className="relative group rounded-xl overflow-hidden border border-border/40 aspect-video bg-muted/20">
                                {asset.publicUrl ? (
                                    <img src={asset.publicUrl} alt={asset.assetType} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Image className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <span className="text-xs font-bold uppercase text-white">{asset.assetType.replace("_", " ")}</span>
                                    <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(asset)} className="h-7 text-xs gap-1">
                                        <Trash2 className="h-3 w-3" /> Remove
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
