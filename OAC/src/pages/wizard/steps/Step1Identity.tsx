import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Globe, Instagram, Facebook } from "lucide-react";

interface Step1Props {
    gym: any;
    gymId: string;
    onSaved: () => void;
}

export default function Step1Identity({ gym, gymId, onSaved }: Step1Props) {
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: gym?.name || "",
        brandName: gym?.brandName || "",
        legalName: gym?.legalName || "",
        shortDescription: gym?.shortDescription || "",
        websiteUrl: gym?.websiteUrl || "",
        facebookUrl: gym?.facebookUrl || "",
        instagramUrl: gym?.instagramUrl || "",
        tiktokUrl: gym?.tiktokUrl || "",
        currency: gym?.currency || "ZMW",
    });
    const [contact, setContact] = useState({
        name: gym?.gymContacts?.find((c: any) => c.contactType === "primary")?.name || "",
        role: gym?.gymContacts?.find((c: any) => c.contactType === "primary")?.role || "Owner",
        phone: gym?.gymContacts?.find((c: any) => c.contactType === "primary")?.phone || "",
        email: gym?.gymContacts?.find((c: any) => c.contactType === "primary")?.email || "",
        whatsapp: gym?.gymContacts?.find((c: any) => c.contactType === "primary")?.whatsapp || "",
    });

    const handleSave = async () => {
        if (!form.name.trim()) { toast.error("Gym name is required"); return; }
        if (!contact.phone.trim()) { toast.error("Primary contact phone is required"); return; }
        setSaving(true);
        try {
            // Update gyms table
            const { error: gymError } = await supabase.from("gyms").update(DataMapper.toDb({ ...form })).eq("id", gymId);
            if (gymError) throw gymError;

            // Upsert primary contact
            const existingContact = gym?.gymContacts?.find((c: any) => c.contactType === "primary");
            if (existingContact) {
                const { error: contactError } = await supabase.from("gym_contacts").update(DataMapper.toDb({ ...contact })).eq("id", existingContact.id);
                if (contactError) throw contactError;
            } else {
                const { error: contactError } = await supabase.from("gym_contacts").insert(DataMapper.toDb({ ...contact, gymId: gymId, contactType: "primary" }));
                if (contactError) throw contactError;
            }

            await supabase.rpc("refresh_gym_completeness_score", { p_gym_id: gymId });
            toast.success("Identity & contacts saved!");
            onSaved();
        } catch (err: any) {
            toast.error("Save failed: " + err.message);
        }
        setSaving(false);
    };

    return (
        <div className="space-y-8 max-w-2xl">
            {/* Gym Identity */}
            <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Gym Identity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Legal Name <span className="text-red-500">*</span></Label>
                        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" placeholder="Iron Paradise Gym Ltd" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Brand Name (if different)</Label>
                        <Input value={form.brandName} onChange={e => setForm({ ...form, brandName: e.target.value })} className="rounded-xl" placeholder="Iron Paradise" />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                        <Label>Short Description</Label>
                        <Textarea value={form.shortDescription} onChange={e => setForm({ ...form, shortDescription: e.target.value })} className="resize-none rounded-xl" rows={3} placeholder="A premium 24/7 fitness facility with world-class equipment..." />
                    </div>
                    <div className="grid gap-2">
                        <Label>Currency</Label>
                        <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="h-10 px-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:border-primary">
                            <option value="ZMW">ZMW - Zambian Kwacha</option>
                            <option value="USD">USD - US Dollar</option>
                            <option value="KES">KES - Kenyan Shilling</option>
                            <option value="ZAR">ZAR - South African Rand</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Online Presence */}
            <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Online Presence</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label className="flex items-center gap-2"><Globe className="h-3 w-3" /> Website</Label>
                        <Input value={form.websiteUrl} onChange={e => setForm({ ...form, websiteUrl: e.target.value })} className="rounded-xl" placeholder="https://ironparadise.com" />
                    </div>
                    <div className="grid gap-2">
                        <Label className="flex items-center gap-2"><Instagram className="h-3 w-3" /> Instagram</Label>
                        <Input value={form.instagramUrl} onChange={e => setForm({ ...form, instagramUrl: e.target.value })} className="rounded-xl" placeholder="@ironparadisegym" />
                    </div>
                    <div className="grid gap-2">
                        <Label className="flex items-center gap-2"><Facebook className="h-3 w-3" /> Facebook</Label>
                        <Input value={form.facebookUrl} onChange={e => setForm({ ...form, facebookUrl: e.target.value })} className="rounded-xl" placeholder="facebook.com/ironparadise" />
                    </div>
                    <div className="grid gap-2">
                        <Label>TikTok</Label>
                        <Input value={form.tiktokUrl} onChange={e => setForm({ ...form, tiktokUrl: e.target.value })} className="rounded-xl" placeholder="@ironparadisegym" />
                    </div>
                </div>
            </div>

            {/* Primary Contact */}
            <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Primary Contact Person</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Full Name <span className="text-red-500">*</span></Label>
                        <Input value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} className="rounded-xl" placeholder="John Banda" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Role / Title</Label>
                        <Input value={contact.role} onChange={e => setContact({ ...contact, role: e.target.value })} className="rounded-xl" placeholder="Owner / Manager" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Phone Number <span className="text-red-500">*</span></Label>
                        <Input value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} className="rounded-xl" placeholder="+260 97 123 4567" />
                    </div>
                    <div className="grid gap-2">
                        <Label>WhatsApp</Label>
                        <Input value={contact.whatsapp} onChange={e => setContact({ ...contact, whatsapp: e.target.value })} className="rounded-xl" placeholder="+260 97 123 4567" />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                        <Label>Email</Label>
                        <Input type="email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} className="rounded-xl" placeholder="contact@ironparadise.com" />
                    </div>
                </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Identity & Contacts"}
            </Button>
        </div>
    );
}
