import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Plus,
    Award,
    ExternalLink,
    Edit,
    Trash2,
    ImagePlus,
    MoreVertical,
    Layout,
    Globe,
    MousePointerClick,
    Eye,
    X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface Sponsor {
    id: string;
    name: string;
    logo_url: string | null;
    website_url: string | null;
    is_active: boolean;
    gym_id: string;
}

interface BannerAd {
    id: string;
    sponsor_id: string | null;
    image_url: string;
    link_url: string | null;
    placement_type: "global" | "event_home" | "gym_home" | "calendar";
    audience_type: "all" | "gym_members" | "event_members";
    is_active: boolean;
    impressions_count: number;
    clicks_count: number;
    gym_id: string;
    event_id: string | null;
    start_date: string | null;
    end_date: string | null;
}

const placementLabels: Record<string, string> = {
    global: "Global Dashboards",
    event_home: "Event Home Screen",
    gym_home: "Gym Home Screen",
    calendar: "Event Calendar",
};

export default function Sponsors() {
    const { user } = useAuth();
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [banners, setBanners] = useState<BannerAd[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSponsorDialogOpen, setIsSponsorDialogOpen] = useState(false);
    const [isBannerDialogOpen, setIsBannerDialogOpen] = useState(false);
    const [editingSponsor, setEditingSponsor] = useState<Partial<Sponsor> | null>(null);
    const [editingBanner, setEditingBanner] = useState<Partial<BannerAd> | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [bannerStartDate, setBannerStartDate] = useState("");
    const [bannerEndDate, setBannerEndDate] = useState("");
    const logoInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user?.gymId) fetchData();
    }, [user?.gymId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [sponsorsRes, bannersRes] = await Promise.all([
                supabase.from("sponsors").select("*").eq("gym_id", user?.gymId).order("created_at", { ascending: false }),
                supabase.from("banner_ads").select("*").eq("gym_id", user?.gymId).order("created_at", { ascending: false }),
            ]);
            if (sponsorsRes.error) throw sponsorsRes.error;
            if (bannersRes.error) throw bannersRes.error;
            setSponsors(sponsorsRes.data || []);
            setBanners(bannersRes.data || []);
        } catch (err: any) {
            toast.error("Failed to fetch data: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const uploadImage = async (file: File, folder: string): Promise<string> => {
        const ext = file.name.split(".").pop();
        const path = `${folder}/${user!.gymId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("gym-images").upload(path, file, { upsert: true });
        if (error) throw error;
        return supabase.storage.from("gym-images").getPublicUrl(path).data.publicUrl;
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingLogo(true);
        try {
            const url = await uploadImage(file, "sponsor-logos");
            setEditingSponsor((p) => ({ ...p, logo_url: url }));
            toast.success("Logo uploaded");
        } catch (err: any) {
            toast.error("Upload failed: " + err.message);
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingBanner(true);
        try {
            const url = await uploadImage(file, "banner-ads");
            setEditingBanner((p) => ({ ...p, image_url: url }));
            toast.success("Banner image uploaded");
        } catch (err: any) {
            toast.error("Upload failed: " + err.message);
        } finally {
            setUploadingBanner(false);
        }
    };

    const handleSaveSponsor = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Saving sponsor...", editingSponsor);
        if (!user?.gymId) {
            toast.error("No Gym ID found for user. Please reload.");
            return;
        }
        if (!editingSponsor?.name) {
            toast.error("Sponsor name is required.");
            return;
        }
        setSaving(true);
        try {
            const data = {
                name: editingSponsor.name,
                logo_url: editingSponsor.logo_url,
                website_url: editingSponsor.website_url,
                is_active: editingSponsor.is_active ?? true,
                gym_id: user.gymId
            };

            let result;
            if (editingSponsor.id) {
                result = await supabase.from("sponsors").update(data).eq("id", editingSponsor.id);
            } else {
                result = await supabase.from("sponsors").insert([data]);
            }

            if (result.error) {
                console.error("Supabase error saving sponsor:", result.error);
                throw result.error;
            }

            toast.success(editingSponsor.id ? "Sponsor updated" : "Sponsor added");
            setIsSponsorDialogOpen(false);
            fetchData();
        } catch (err: any) {
            console.error("Error in handleSaveSponsor:", err);
            toast.error(`Error: ${err.message || "Unknown error occurred"}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBanner = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Saving banner...", editingBanner);
        if (!user?.gymId) {
            toast.error("No Gym ID found. Please reload.");
            return;
        }
        if (!editingBanner?.image_url) {
            toast.error("Please upload a banner image.");
            return;
        }
        setSaving(true);
        try {
            const data = {
                sponsor_id: editingBanner.sponsor_id || null,
                image_url: editingBanner.image_url,
                link_url: editingBanner.link_url,
                placement_type: editingBanner.placement_type || "global",
                audience_type: editingBanner.audience_type || "all",
                is_active: editingBanner.is_active ?? true,
                gym_id: user.gymId,
                start_date: bannerStartDate || null,
                end_date: bannerEndDate || null
            };

            let result;
            if (editingBanner.id) {
                result = await supabase.from("banner_ads").update(data).eq("id", editingBanner.id);
            } else {
                result = await supabase.from("banner_ads").insert([data]);
            }

            if (result.error) {
                console.error("Supabase error saving banner:", result.error);
                throw result.error;
            }

            toast.success(editingBanner.id ? "Banner updated" : "Banner created");
            setIsBannerDialogOpen(false);
            fetchData();
        } catch (err: any) {
            console.error("Error in handleSaveBanner:", err);
            toast.error(`Error: ${err.message || "Unknown error occurred"}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSponsor = async (id: string) => {
        if (!confirm("Delete this sponsor? Associated banners will be unlinked.")) return;
        try {
            const { error } = await supabase.from("sponsors").delete().eq("id", id);
            if (error) throw error;
            toast.success("Sponsor deleted");
            fetchData();
        } catch (err: any) {
            toast.error("Delete failed: " + err.message);
        }
    };

    const handleDeleteBanner = async (id: string) => {
        if (!confirm("Delete this ad placement?")) return;
        try {
            const { error } = await supabase.from("banner_ads").delete().eq("id", id);
            if (error) throw error;
            toast.success("Banner deleted");
            fetchData();
        } catch (err: any) {
            toast.error("Delete failed: " + err.message);
        }
    };

    const ctr = (b: BannerAd) => b.impressions_count > 0 ? ((b.clicks_count / b.impressions_count) * 100).toFixed(1) : "0.0";

    const inputCls = "bg-sidebar-background border-sidebar-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary";

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Sponsors &amp; Ads</h1>
                    <p className="text-muted-foreground">Monetize and partner with local businesses via in-app placements.</p>
                </div>
            </div>

            <Tabs defaultValue="sponsors" className="w-full">
                <TabsList className="bg-sidebar-accent/50 border border-sidebar-border/50 p-1">
                    <TabsTrigger value="sponsors" className="gap-2"><Award className="h-4 w-4" /> Sponsors</TabsTrigger>
                    <TabsTrigger value="banners" className="gap-2"><Layout className="h-4 w-4" /> Ad Placements</TabsTrigger>
                </TabsList>

                {/* ─── Sponsors Tab ─── */}
                <TabsContent value="sponsors" className="mt-6 space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => { setEditingSponsor({ is_active: true }); setIsSponsorDialogOpen(true); }} className="gap-2">
                            <Plus className="h-4 w-4" /> Add Sponsor
                        </Button>
                    </div>
                    <Card className="border-sidebar-border/50 bg-sidebar-accent/20 backdrop-blur-sm shadow-modern overflow-hidden">
                        <CardHeader className="border-b border-sidebar-border/50">
                            <CardTitle>Partner Directory</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="py-16 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                            ) : sponsors.length === 0 ? (
                                <div className="py-16 text-center">
                                    <Award className="h-12 w-12 mx-auto mb-3 opacity-10" />
                                    <p className="text-muted-foreground">No sponsors yet. Add your first partner.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-sidebar-accent/50">
                                        <TableRow className="border-sidebar-border/50">
                                            <TableHead>Sponsor</TableHead>
                                            <TableHead>Website</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sponsors.map((s) => (
                                            <TableRow key={s.id} className="border-sidebar-border/50 hover:bg-sidebar-accent/30">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-lg bg-white border border-sidebar-border/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                            {s.logo_url ? <img src={s.logo_url} className="h-full w-full object-contain p-0.5" alt="" /> : <Award className="h-4 w-4 text-primary" />}
                                                        </div>
                                                        <span>{s.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {s.website_url ? (
                                                        <a href={s.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline text-sm">
                                                            <Globe className="h-3.5 w-3.5" /> Visit
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    ) : <span className="text-muted-foreground text-sm">—</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={s.is_active ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
                                                        {s.is_active ? "Active" : "Inactive"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="bg-sidebar-accent border-sidebar-border/50">
                                                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => { setEditingSponsor(s); setIsSponsorDialogOpen(true); }}>
                                                                <Edit className="h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="gap-2 text-red-500 cursor-pointer" onClick={() => handleDeleteSponsor(s.id)}>
                                                                <Trash2 className="h-4 w-4" /> Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── Banner Ads Tab ─── */}
                <TabsContent value="banners" className="mt-6 space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => {
                            setEditingBanner({ is_active: true, placement_type: "global", audience_type: "all" });
                            setBannerStartDate(new Date().toISOString());
                            setBannerEndDate("");
                            setIsBannerDialogOpen(true);
                        }} className="gap-2">
                            <Plus className="h-4 w-4" /> New Ad Placement
                        </Button>
                    </div>

                    {/* Analytics Summary */}
                    <div className="grid gap-4 md:grid-cols-3">
                        {[
                            { label: "Total Impressions", icon: <Eye className="h-4 w-4 text-primary" />, value: banners.reduce((a, b) => a + b.impressions_count, 0).toLocaleString() },
                            { label: "Total Clicks", icon: <MousePointerClick className="h-4 w-4 text-primary" />, value: banners.reduce((a, b) => a + b.clicks_count, 0).toLocaleString() },
                            { label: "Active Placements", icon: <Layout className="h-4 w-4 text-green-500" />, value: banners.filter(b => b.is_active).length },
                        ].map((stat) => (
                            <Card key={stat.label} className="bg-sidebar-accent/40 border-sidebar-border/50">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                                    {stat.icon}
                                </CardHeader>
                                <CardContent><div className="text-2xl font-bold">{stat.value}</div></CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="border-sidebar-border/50 bg-sidebar-accent/20 backdrop-blur-sm shadow-modern overflow-hidden">
                        <CardHeader className="border-b border-sidebar-border/50"><CardTitle>Ad Placements</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {banners.length === 0 ? (
                                <div className="py-16 text-center">
                                    <Layout className="h-12 w-12 mx-auto mb-3 opacity-10" />
                                    <p className="text-muted-foreground">No ad placements yet.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-sidebar-accent/50">
                                        <TableRow className="border-sidebar-border/50">
                                            <TableHead>Preview</TableHead>
                                            <TableHead>Placement</TableHead>
                                            <TableHead>Performance</TableHead>
                                            <TableHead>Active</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {banners.map((b) => (
                                            <TableRow key={b.id} className="border-sidebar-border/50 hover:bg-sidebar-accent/30">
                                                <TableCell>
                                                    <div className="h-12 w-20 bg-sidebar-accent rounded-lg overflow-hidden border border-sidebar-border/30">
                                                        <img src={b.image_url} className="h-full w-full object-cover" alt="Banner" />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="border-sidebar-border bg-sidebar-accent/50 capitalize">
                                                        {placementLabels[b.placement_type] || b.placement_type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1 text-xs text-muted-foreground">
                                                        <div className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> {b.impressions_count.toLocaleString()} impressions</div>
                                                        <div className="flex items-center gap-1.5"><MousePointerClick className="h-3 w-3" /> {b.clicks_count.toLocaleString()} clicks · {ctr(b)}% CTR</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Switch checked={b.is_active} onCheckedChange={async (val) => {
                                                        await supabase.from("banner_ads").update({ is_active: val }).eq("id", b.id);
                                                        fetchData();
                                                    }} />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="bg-sidebar-accent border-sidebar-border/50">
                                                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
                                                                setEditingBanner(b);
                                                                setBannerStartDate(b.start_date || "");
                                                                setBannerEndDate(b.end_date || "");
                                                                setIsBannerDialogOpen(true);
                                                            }}>
                                                                <Edit className="h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="gap-2 text-red-500 cursor-pointer" onClick={() => handleDeleteBanner(b.id)}>
                                                                <Trash2 className="h-4 w-4" /> Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ─────────────────────────────────────────────── */}
            {/* Sponsor Dialog — Premium Dark Redesign         */}
            {/* ─────────────────────────────────────────────── */}
            <Dialog open={isSponsorDialogOpen} onOpenChange={setIsSponsorDialogOpen}>
                <DialogContent className="p-0 overflow-hidden border-0 sm:max-w-[500px]" style={{ background: "hsl(240 5.9% 10%)", boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}>
                    {/* Green accent header bar */}
                    <div className="relative h-1.5 w-full" style={{ background: "linear-gradient(90deg, hsl(120 28% 23%), hsl(120 28% 38%), hsl(47 87% 59%))" }} />

                    <div className="px-6 pt-5 pb-2">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(120 20% 20%)", border: "1px solid hsl(120 15% 30%)" }}>
                                    <Award className="h-4 w-4" style={{ color: "hsl(120 28% 55%)" }} />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg font-semibold text-white">
                                        {editingSponsor?.id ? "Edit Partner" : "Add New Partner"}
                                    </DialogTitle>
                                    <p className="text-xs" style={{ color: "hsl(120 15% 55%)" }}>
                                        Partner details shown to members in the app
                                    </p>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <form onSubmit={handleSaveSponsor} className="px-6 space-y-5 pb-6">
                        {/* Logo Upload */}
                        <div>
                            <label className="block text-xs font-medium mb-2" style={{ color: "hsl(120 15% 55%)" }}>PARTNER LOGO</label>
                            <div onClick={() => logoInputRef.current?.click()}
                                className="relative group cursor-pointer rounded-xl overflow-hidden flex items-center justify-center transition-all duration-200"
                                style={{ height: "100px", background: "hsl(120 20% 13%)", border: "2px dashed hsl(120 15% 28%)" }}>
                                {editingSponsor?.logo_url ? (
                                    <>
                                        <img src={editingSponsor.logo_url} className="h-full w-full object-contain p-4" alt="Logo" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs text-white">Change</div>
                                        <button type="button" onClick={(ev) => { ev.stopPropagation(); setEditingSponsor(p => ({ ...p, logo_url: null })); }}
                                            className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white hover:bg-red-500"><X className="h-3 w-3" /></button>
                                    </>
                                ) : (
                                    <div className="text-center text-muted-foreground">
                                        {uploadingLogo ? <div className="animate-spin rounded-full h-5 w-5 border-2 mx-auto" style={{ borderColor: "hsl(120 28% 38%)", borderTopColor: "transparent" }} /> :
                                            <><ImagePlus className="h-7 w-7 mx-auto mb-1 opacity-40" /><p className="text-[10px]">Upload Partner Logo</p></>}
                                    </div>
                                )}
                            </div>
                            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: "hsl(120 15% 55%)" }}>PARTNER NAME <span style={{ color: "hsl(0 70% 55%)" }}>*</span></label>
                            <input required value={editingSponsor?.name || ""} onChange={(e) => setEditingSponsor({ ...editingSponsor, name: e.target.value })}
                                placeholder="e.g. Local Sports Gear"
                                className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground outline-none transition-all"
                                style={{ background: "hsl(120 20% 13%)", border: "1.5px solid hsl(120 15% 25%)" }} />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: "hsl(120 15% 55%)" }}>WEBSITE URL</label>
                            <div className="relative">
                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "hsl(120 20% 40%)" }} />
                                <input value={editingSponsor?.website_url || ""} onChange={(e) => setEditingSponsor({ ...editingSponsor, website_url: e.target.value })}
                                    placeholder="https://example.com"
                                    className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-muted-foreground outline-none transition-all"
                                    style={{ background: "hsl(120 20% 13%)", border: "1.5px solid hsl(120 15% 25%)" }} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <span className="text-xs font-medium" style={{ color: "hsl(120 15% 55%)" }}>ACTIVE ON PLATFORM</span>
                            <Switch checked={editingSponsor?.is_active ?? true} onCheckedChange={(v) => setEditingSponsor(p => ({ ...p, is_active: v }))} />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setIsSponsorDialogOpen(false)}
                                className="px-5 py-2 rounded-xl text-sm transition-all"
                                style={{ color: "hsl(120 15% 55%)", background: "hsl(120 20% 13%)", border: "1px solid hsl(120 15% 25%)" }}>
                                Cancel
                            </button>
                            <button type="submit" disabled={saving}
                                className="px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                                style={{ background: "linear-gradient(135deg, hsl(120 28% 28%), hsl(120 28% 38%))", boxShadow: "0 4px 15px hsla(120, 28%, 30%, 0.4)" }}>
                                {saving ? "Saving..." : editingSponsor?.id ? "Update Partner" : "Add Partner"}
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Banner Ad Dialog — Premium Dark Redesign ─── */}
            <Dialog open={isBannerDialogOpen} onOpenChange={setIsBannerDialogOpen}>
                <DialogContent className="p-0 overflow-hidden border-0 sm:max-w-[500px]" style={{ background: "hsl(240 5.9% 10%)", boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}>
                    <div className="relative h-1.5 w-full" style={{ background: "linear-gradient(90deg, hsl(120 28% 23%), hsl(47 87% 59%))" }} />

                    <div className="px-6 pt-5 pb-2">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(120 20% 20%)", border: "1px solid hsl(120 15% 30%)" }}>
                                    <Layout className="h-4 w-4" style={{ color: "hsl(47 87% 59%)" }} />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg font-semibold text-white">
                                        {editingBanner?.id ? "Edit Ad Placement" : "New Ad Placement"}
                                    </DialogTitle>
                                    <p className="text-xs" style={{ color: "hsl(120 15% 55%)" }}>Choose target and location for this billboard</p>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <form onSubmit={handleSaveBanner} className="px-6 space-y-5 pb-6">
                        {/* Banner Image Upload */}
                        <div>
                            <label className="block text-xs font-medium mb-2" style={{ color: "hsl(120 15% 55%)" }}>AD CAMPAIGN BANNER <span style={{ color: "hsl(0 70% 55%)" }}>*</span></label>
                            <div onClick={() => bannerInputRef.current?.click()}
                                className="relative group cursor-pointer rounded-xl overflow-hidden flex items-center justify-center transition-all duration-200"
                                style={{ height: "120px", background: "hsl(120 20% 13%)", border: "2px dashed hsl(120 15% 28%)" }}>
                                {editingBanner?.image_url ? (
                                    <>
                                        <img src={editingBanner.image_url} className="absolute inset-0 h-full w-full object-cover" alt="Banner" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-sm text-white">Change Banner</div>
                                        <button type="button" onClick={(ev) => { ev.stopPropagation(); setEditingBanner(p => ({ ...p, image_url: undefined })); }}
                                            className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-red-500"><X className="h-3 w-3" /></button>
                                    </>
                                ) : (
                                    <div className="text-center text-muted-foreground p-4">
                                        {uploadingBanner ? <div className="animate-spin rounded-full h-6 w-6 border-2 mx-auto" style={{ borderColor: "hsl(47 87% 59%)", borderTopColor: "transparent" }} /> :
                                            <><ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-30" style={{ color: "hsl(47 87% 59%)" }} /><p className="text-[10px]">Click to upload creative (4:1 recommended)</p></>}
                                    </div>
                                )}
                            </div>
                            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerImageUpload} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest opacity-70" style={{ color: "hsl(120 15% 55%)" }}>Start Date</label>
                                <DateTimePicker
                                    value={bannerStartDate}
                                    onChange={setBannerStartDate}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest opacity-70" style={{ color: "hsl(120 15% 55%)" }}>End Date (Optional)</label>
                                <DateTimePicker
                                    value={bannerEndDate}
                                    onChange={setBannerEndDate}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: "hsl(120 15% 55%)" }}>PLACEMENT</label>
                                <Select value={editingBanner?.placement_type || "global"} onValueChange={(v) => setEditingBanner({ ...editingBanner, placement_type: v as any })}>
                                    <SelectTrigger className="w-full h-10 px-3 rounded-xl border-1.5 transition-all text-[10px]" style={{ background: "hsl(120 20% 13%)", borderColor: "hsl(120 15% 25%)", color: "white" }}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-sidebar-background border-sidebar-border">
                                        <SelectItem value="global">🌐 Global</SelectItem>
                                        <SelectItem value="event_home">🎟️ Event Home</SelectItem>
                                        <SelectItem value="gym_home">🏋️ Gym Home</SelectItem>
                                        <SelectItem value="calendar">📅 Calendar</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: "hsl(120 15% 55%)" }}>AUDIENCE</label>
                                <Select value={editingBanner?.audience_type || "all"} onValueChange={(v) => setEditingBanner({ ...editingBanner, audience_type: v as any })}>
                                    <SelectTrigger className="w-full h-10 px-3 rounded-xl border-1.5 transition-all text-[10px]" style={{ background: "hsl(120 20% 13%)", borderColor: "hsl(120 15% 25%)", color: "white" }}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-sidebar-background border-sidebar-border">
                                        <SelectItem value="all">👥 All Users</SelectItem>
                                        <SelectItem value="gym_members">💪 Gym Members</SelectItem>
                                        <SelectItem value="event_members">🎟️ Event Users</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: "hsl(120 15% 55%)" }}>PARTNER</label>
                                <Select value={editingBanner?.sponsor_id || "none"} onValueChange={(v) => setEditingBanner({ ...editingBanner, sponsor_id: v === "none" ? null : v })}>
                                    <SelectTrigger className="w-full h-10 px-3 rounded-xl border-1.5 transition-all text-[10px]" style={{ background: "hsl(120 20% 13%)", borderColor: "hsl(120 15% 25%)", color: "white" }}>
                                        <SelectValue placeholder="Select Sponsor" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-sidebar-background border-sidebar-border">
                                        <SelectItem value="none">No Partner</SelectItem>
                                        {sponsors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: "hsl(120 15% 55%)" }}>TARGET REDIRECT URL</label>
                            <input value={editingBanner?.link_url || ""} onChange={(e) => setEditingBanner({ ...editingBanner, link_url: e.target.value })}
                                placeholder="https://..."
                                className="w-full rounded-xl px-4 py-2 text-sm text-white placeholder:text-muted-foreground outline-none transition-all"
                                style={{ background: "hsl(120 20% 13%)", border: "1.5px solid hsl(120 15% 25%)" }} />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <span className="text-xs font-medium" style={{ color: "hsl(120 15% 55%)" }}>CAMPAIGN LIVE STATUS</span>
                            <Switch checked={editingBanner?.is_active ?? true} onCheckedChange={(v) => setEditingBanner(p => ({ ...p, is_active: v }))} />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setIsBannerDialogOpen(false)}
                                className="px-5 py-2 rounded-xl text-sm transition-all"
                                style={{ color: "hsl(120 15% 55%)", background: "hsl(120 20% 13%)", border: "1px solid hsl(120 15% 25%)" }}>
                                Cancel
                            </button>
                            <button type="submit" disabled={saving}
                                className="px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                                style={{ background: "linear-gradient(135deg, hsl(47 87% 50%), hsl(47 87% 59%))", color: "hsl(120 28% 10%)", boxShadow: "0 4px 15px hsla(47, 87%, 50%, 0.3)" }}>
                                {saving ? "Deploying..." : editingBanner?.id ? "Update Campaign" : "✦ Deploy Campaign"}
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

        </div>
    );
}
