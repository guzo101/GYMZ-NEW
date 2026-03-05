import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface Step8Props {
    gym: any;
    gymId: string;
    onSaved: () => void;
}

const DOC_TYPES = [
    { key: "business_registration", label: "Business Registration Certificate", required: true },
    { key: "lease_agreement", label: "Lease / Property Agreement", required: true },
    { key: "owner_id", label: "Owner National ID / Passport", required: true },
    { key: "utility_bill", label: "Utility Bill (Proof of Address)", required: false },
    { key: "other", label: "Other Supporting Document", required: false },
];

export default function Step8Documents({ gym, gymId, onSaved }: Step8Props) {
    const [existing, setExisting] = useState<any[]>(gym?.gymVerificationDocuments || []);
    const [uploading, setUploading] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState("business_registration");
    const fileRef = useRef<HTMLInputElement>(null);

    const uploadedTypes = new Set(existing.map(d => d.documentType));

    const handleUpload = async (file: File) => {
        if (!file) return;
        const ext = file.name.split(".").pop();
        const path = `gym-docs/${gymId}/${Date.now()}-${selectedType}.${ext}`;
        setUploading(selectedType);

        const { data: { session } } = await supabase.auth.getSession();
        try {
            const { error: uploadError } = await supabase.storage.from("oac-documents").upload(path, file, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: inserted, error: dbError } = await supabase.from("gym_verification_documents").insert(DataMapper.toDb({
                gymId: gymId,
                documentType: selectedType,
                fileName: file.name,
                storagePath: path,
                fileSizeBytes: file.size,
                mimeType: file.type,
                uploadedBy: session?.user.id || null,
                verificationStatus: "pending",
            })).select().single();

            if (dbError) throw dbError;
            setExisting(prev => [...prev, DataMapper.fromDb(inserted)]);
            await supabase.rpc("refresh_gym_completeness_score", { p_gym_id: gymId });
            toast.success("Document uploaded!");
            onSaved();
        } catch (err: any) {
            toast.error("Upload failed: " + err.message);
        }
        setUploading(null);
    };

    const handleDelete = async (doc: any) => {
        try {
            await supabase.storage.from("oac-documents").remove([doc.storagePath]);
            await supabase.from("gym_verification_documents").delete().eq("id", doc.id);
            setExisting(prev => prev.filter(d => d.id !== doc.id));
            await supabase.rpc("refresh_gym_completeness_score", { p_gym_id: gymId });
            toast.success("Document removed");
            onSaved();
        } catch (err: any) {
            toast.error("Could not delete: " + err.message);
        }
    };

    const openDoc = async (doc: any) => {
        const { data } = await supabase.storage.from("oac-documents").createSignedUrl(doc.storagePath, 60);
        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
        else toast.error("Could not generate download link");
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <p className="text-muted-foreground text-sm">Upload official documents for gym verification. Required documents must be provided before the gym can be approved.</p>

            {/* Required checklist */}
            <div className="space-y-2">
                {DOC_TYPES.map(docType => {
                    const uploaded = existing.find(d => d.documentType === docType.key);
                    return (
                        <div key={docType.key} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${uploaded ? 'border-green-500/30 bg-green-500/5' : docType.required ? 'border-yellow-500/20 bg-yellow-500/5 shadow-sm shadow-yellow-500/5' : 'border-border/40 bg-card/40'}`}>
                            <div className="flex items-center gap-3">
                                {uploaded ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> : <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />}
                                <div>
                                    <div className="text-sm font-medium">{docType.label}</div>
                                    {docType.required && !uploaded && <div className="text-xs text-yellow-500">Required for approval</div>}
                                    {uploaded && <div className="text-xs text-muted-foreground">{uploaded.fileName}</div>}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {uploaded && (
                                    <>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => openDoc(uploaded)} className="text-blue-400 hover:bg-blue-400/10 text-xs">View</Button>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => handleDelete(uploaded)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="h-3 w-3" /></Button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Upload control */}
            <div className="p-8 rounded-2xl border-2 border-dashed border-primary/20 bg-background/40 hover:bg-background/60 hover:border-primary/40 transition-all space-y-4 text-center">
                <div className="grid gap-2">
                    <label className="text-sm font-medium">Upload New Document</label>
                    <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="h-10 px-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-all shadow-sm w-full max-w-xs mx-auto">
                        {DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ""; }} />
                <Button type="button" onClick={() => fileRef.current?.click()} disabled={!!uploading} className="bg-primary hover:bg-primary/90 rounded-xl gap-2">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Uploading..." : "Upload Document"}
                </Button>
                <p className="text-xs text-muted-foreground">Accepted: PDF, JPG, PNG. Max 10MB.</p>
            </div>
        </div>
    );
}
