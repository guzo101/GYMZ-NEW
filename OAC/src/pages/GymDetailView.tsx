import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Building2, MapPin, Mail, Phone, Tag, Dumbbell, FileText, Clock, CreditCard, UserRoundPlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function GymDetailView() {
    const { gymId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [gym, setGym] = useState<any>(null);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteName, setInviteName] = useState("");
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        if (gymId) fetchGymDetails();
    }, [gymId]);

    const fetchGymDetails = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("gyms")
            .select(`
                *,
                gym_onboarding_status (*),
                gym_branches (*),
                gym_contacts (*),
                gym_hours (*),
                gym_membership_plans (*),
                gym_facilities_equipment (*, gym_equipment_media (*)),
                gym_media_assets (*),
                gym_payment_methods (*),
                gym_verification_documents (*)
            `)
            .eq("id", gymId!)
            .single();

        if (error) {
            console.error("Error fetching gym details:", error);
        } else {
            setGym(DataMapper.fromDb(data));
        }
        setLoading(false);
    };

    if (loading) return (
        <div className="min-h-screen bg-mesh-glow flex items-center justify-center text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-muted-foreground">Loading gym profile...</span>
            </div>
        </div>
    );
    if (!gym) return <div className="min-h-screen bg-mesh-glow flex items-center justify-center text-white">Gym not found</div>;

    const statusObj = gym.gymOnboardingStatus?.[0];
    const isPending = statusObj?.status === "pending_verification";
    const isActive = statusObj?.status === "active";

    const computeLocalScore = (g: any): number => {
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

    const score = Math.max(statusObj?.completenessScore || 0, computeLocalScore(gym));

    // Group facilities by category
    const facilitiesByCategory = (gym.gymFacilitiesEquipment || []).reduce((acc: any, f: any) => {
        if (!acc[f.category]) acc[f.category] = [];
        acc[f.category].push(f);
        return acc;
    }, {});

    const DAY_LABELS: Record<string, string> = {
        weekday_mon: "Mon", weekday_tue: "Tue", weekday_wed: "Wed",
        weekday_thu: "Thu", weekday_fri: "Fri", saturday: "Sat", sunday: "Sun"
    };

    const openDoc = async (doc: any) => {
        const { data } = await supabase.storage.from("oac-documents").createSignedUrl(doc.storagePath, 60);
        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    };

    const handleInviteAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!gym || !inviteEmail?.trim() || !inviteName?.trim()) {
            toast.error("Email and name are required.");
            return;
        }
        setInviting(true);
        try {
            const { data, error } = await supabase.rpc("oac_invite_gym_admin", {
                p_gym_id: gym.id,
                p_email: inviteEmail.trim().toLowerCase(),
                p_name: inviteName.trim(),
            });
            if (error) throw error;
            const result = data as { message?: string; existing_user?: boolean };
            let finalMessage = result?.message || "Invitation sent.";

            if (!result?.existing_user) {
                const { data: fnData, error: fnError } = await supabase.functions.invoke("send-gym-admin-invite", {
                    body: {
                        email: inviteEmail.trim().toLowerCase(),
                        name: inviteName.trim(),
                        gym_id: gym.id,
                        gym_name: gym.name,
                    },
                });
                if (fnError) {
                    console.error("[OAC] Invite email send failed:", fnError);
                    throw new Error(fnData?.error || fnError.message || "Invite email could not be sent. Check Supabase Auth email/SMTP settings.");
                }
                if (fnData?.message) finalMessage = fnData.message;
            }

            toast.success(finalMessage);
            setIsInviteOpen(false);
            setInviteEmail("");
            setInviteName("");
        } catch (err: any) {
            toast.error(err?.message || "Failed to invite admin.");
        } finally {
            setInviting(false);
        }
    };

    const openInviteDialog = () => {
        const primary = gym?.gymContacts?.find((c: any) => c.contactType === "primary") || gym?.gymContacts?.[0];
        setInviteEmail(primary?.email || "");
        setInviteName(primary?.name || "");
        setIsInviteOpen(true);
    };

    return (
        <div className="min-h-screen bg-mesh-glow text-white">
            {/* Header Banner */}
            <div className="bg-black/20 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-start gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0 text-muted-foreground hover:text-white mt-1">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                                    {gym.name}
                                    {isActive && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                                </h1>
                                <div className="flex items-center gap-4 mt-2 text-muted-foreground text-sm flex-wrap">
                                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {gym.city || "City not set"}</span>
                                    <span className="flex items-center gap-1"><Building2 className="h-4 w-4" /> {gym.gymBranches?.length || 0} Branches</span>
                                    <Badge variant="outline" className="border-white/20 bg-black/40 text-muted-foreground uppercase text-[10px] tracking-wider">
                                        {statusObj?.status || "Draft"}
                                    </Badge>
                                </div>
                            </div>
                            <div className="text-right space-y-2">
                                <div className="text-sm">Completeness: <span className={`font-bold ${score >= 80 ? 'text-green-500' : 'text-yellow-500'}`}>{score}%</span></div>
                                <div className="flex gap-2 flex-wrap">
                                    <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-xl gap-2" onClick={openInviteDialog}>
                                        <UserRoundPlus className="h-4 w-4" /> Invite Admin
                                    </Button>
                                    {isPending && (
                                        <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-xl" onClick={() => navigate(`/verify/${gym.id}`)}>
                                            Review Application
                                        </Button>
                                    )}
                                    {!isActive && (
                                        <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/20 rounded-xl" onClick={() => navigate(`/onboarding/${gym.id}`)}>
                                            Edit in Wizard
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="glass-card border-white/5 p-1 mb-8 flex-wrap h-auto gap-1">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="branches">Branches</TabsTrigger>
                        <TabsTrigger value="pricing">Pricing Plans</TabsTrigger>
                        <TabsTrigger value="facilities">Facilities</TabsTrigger>
                        <TabsTrigger value="hours">Hours</TabsTrigger>
                        <TabsTrigger value="documents">Documents</TabsTrigger>
                    </TabsList>

                    {/* Overview */}
                    <TabsContent value="overview" className="mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <Card className="glass-card border-white/5 shadow-xl">
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Gym Identity</CardTitle></CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Legal Name</span><span className="font-medium">{gym.name}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Brand Name</span><span>{gym.brandName || "—"}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>{gym.currency || "ZMW"}</span></div>
                                    {gym.shortDescription && <p className="text-muted-foreground pt-2 border-t border-white/5 text-xs">{gym.shortDescription}</p>}
                                </CardContent>
                            </Card>

                            <Card className="glass-card border-white/5 shadow-xl">
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Primary Contact</CardTitle></CardHeader>
                                <CardContent className="space-y-2">
                                    {gym.gymContacts?.filter((c: any) => c.contactType === "primary").map((c: any, i: number) => (
                                        <div key={i} className="text-sm space-y-1">
                                            <div className="font-bold text-white">{c.name}</div>
                                            <div className="text-muted-foreground text-xs">{c.role}</div>
                                            {c.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3 w-3" /> {c.phone}</div>}
                                            {c.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3 w-3" /> {c.email}</div>}
                                        </div>
                                    ))}
                                    {(!gym.gymContacts || gym.gymContacts.filter((c: any) => c.contactType === "primary").length === 0) && (
                                        <div className="text-muted-foreground italic text-sm">No primary contact set</div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="glass-card border-white/5 shadow-xl">
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Platform Settings</CardTitle></CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Check-in Method</span><span className="uppercase text-xs font-mono">{gym.checkInMethod || "QR"}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Events Enabled</span><span className={gym.eventsEnabled ? "text-green-500" : "text-muted-foreground"}>{gym.eventsEnabled ? "Yes" : "No"}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Sponsors Enabled</span><span className={gym.sponsorsEnabled ? "text-green-500" : "text-muted-foreground"}>{gym.sponsorsEnabled ? "Yes" : "No"}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Media Count</span><span>{gym.gymMediaAssets?.length || 0} photos</span></div>
                                </CardContent>
                            </Card>

                            {/* Links card */}
                            {(gym.websiteUrl || gym.instagramUrl || gym.facebookUrl) && (
                                <Card className="glass-card border-white/5 shadow-xl md:col-span-2 lg:col-span-3">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Online Presence</CardTitle></CardHeader>
                                    <CardContent className="flex flex-wrap gap-3">
                                        {gym.websiteUrl && <a href={gym.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline">{gym.websiteUrl}</a>}
                                        {gym.instagramUrl && <a href={`https://instagram.com/${gym.instagramUrl.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-pink-400 hover:underline">Instagram: {gym.instagramUrl}</a>}
                                        {gym.facebookUrl && <a href={gym.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-300 hover:underline">Facebook: {gym.facebookUrl}</a>}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    {/* Branches */}
                    <TabsContent value="branches" className="mt-0">
                        <Card className="glass-card border-white/5 shadow-2xl">
                            <CardHeader><CardTitle>Branches & Locations</CardTitle></CardHeader>
                            <CardContent>
                                {gym.gymBranches?.length > 0 ? (
                                    <div className="grid gap-4">
                                        {gym.gymBranches.map((b: any) => (
                                            <div key={b.id} className="p-5 rounded-2xl bg-white/5 border border-white/10">
                                                <div className="font-bold flex items-center gap-2 text-lg">
                                                    <MapPin className="h-4 w-4 text-primary" />
                                                    {b.branchName}
                                                    {b.isPrimary && <Badge variant="secondary" className="text-[10px] uppercase">Primary</Badge>}
                                                </div>
                                                <div className="text-sm text-muted-foreground mt-1">{b.address}, {b.city}</div>
                                                {b.phone && <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1"><Phone className="h-3 w-3" /> {b.phone}</div>}
                                                {b.googleMapsUrl && <a href={b.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline mt-2 inline-block">View on Map →</a>}
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="py-12 text-center text-muted-foreground">No branches configured yet.</div>}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Pricing Plans */}
                    <TabsContent value="pricing" className="mt-0">
                        <div className="space-y-4">
                            <Card className="glass-card border-white/5 shadow-2xl">
                                <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-primary" /> Membership Plans</CardTitle></CardHeader>
                                <CardContent>
                                    {gym.gymMembershipPlans?.filter((p: any) => p.isActive)?.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {gym.gymMembershipPlans.filter((p: any) => p.isActive).map((plan: any) => (
                                                <div key={plan.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/30 transition-colors">
                                                    <div className="text-xs text-primary font-bold uppercase tracking-widest mb-1">{plan.planType.replace("_", " ")}</div>
                                                    <div className="font-bold text-xl">{plan.planName}</div>
                                                    <div className="text-3xl font-black mt-2">{plan.currency || gym.currency || "ZMW"} <span className="text-primary">{Number(plan.price).toLocaleString()}</span></div>
                                                    {plan.durationDays && <div className="text-xs text-muted-foreground mt-1">Duration: {plan.durationDays} days</div>}
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {plan.includesClasses && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">Includes Classes</span>}
                                                        {plan.includesTrainer && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Includes Trainer</span>}
                                                        {plan.accessHoursNote && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">{plan.accessHoursNote}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <div className="py-12 text-center text-muted-foreground">No membership plans configured yet.</div>}
                                </CardContent>
                            </Card>

                            {/* Payment Methods */}
                            {gym.gymPaymentMethods?.length > 0 && (
                                <Card className="glass-card border-white/5 shadow-xl">
                                    <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Payment Methods</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {gym.gymPaymentMethods.map((m: any) => (
                                                <div key={m.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
                                                    <CreditCard className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                                    <div>
                                                        <div className="font-bold capitalize">{m.method.replace("_", " ")} {m.isPrimary && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">Primary</span>}</div>
                                                        {m.providerName && <div className="text-sm text-muted-foreground">{m.providerName}</div>}
                                                        {m.accountNumber && <div className="text-sm text-muted-foreground font-mono">{m.accountNumber}</div>}
                                                        {m.instructions && <div className="text-xs text-muted-foreground mt-1 italic">{m.instructions}</div>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    {/* Facilities */}
                    <TabsContent value="facilities" className="mt-0">
                        <Card className="glass-card border-white/5 shadow-2xl">
                            <CardHeader><CardTitle className="flex items-center gap-2"><Dumbbell className="h-5 w-5 text-primary" /> Facilities & Equipment</CardTitle></CardHeader>
                            <CardContent>
                                {Object.keys(facilitiesByCategory).length > 0 ? (
                                    <div className="space-y-6">
                                        {Object.entries(facilitiesByCategory).map(([category, items]: [string, any]) => (
                                            <div key={category}>
                                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 capitalize">{category}</h3>
                                                <div className="flex flex-wrap gap-3">
                                                    {items.map((f: any) => (
                                                        <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-primary font-medium text-sm">
                                                            {f.gymEquipmentMedia?.[0] && (
                                                                <img
                                                                    src={f.gymEquipmentMedia[0].publicUrl}
                                                                    className="h-5 w-5 rounded-md object-cover border border-primary/20"
                                                                    alt={f.itemName}
                                                                />
                                                            )}
                                                            <span>{f.itemName}</span>
                                                            {f.itemCount > 1 && <span className="text-[10px] opacity-70 ml-1">x{f.itemCount}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="py-12 text-center text-muted-foreground">No facilities listed yet.</div>}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Hours */}
                    <TabsContent value="hours" className="mt-0">
                        <Card className="glass-card border-white/5 shadow-2xl">
                            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Operating Hours</CardTitle></CardHeader>
                            <CardContent>
                                {gym.gymHours?.length > 0 ? (
                                    <div className="divide-y divide-white/5">
                                        {gym.gymHours.map((h: any) => (
                                            <div key={h.id} className={`flex items-center justify-between py-3 ${h.isClosed ? 'opacity-50' : ''}`}>
                                                <span className="font-medium w-24">{DAY_LABELS[h.dayType] || h.dayType}</span>
                                                <span className={`text-sm ${h.isClosed ? 'text-red-400' : 'text-muted-foreground'}`}>
                                                    {h.isClosed ? "Closed" : `${h.openTime?.slice(0, 5) || "?"} – ${h.closeTime?.slice(0, 5) || "?"}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="py-12 text-center text-muted-foreground">No operating hours set yet.</div>}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Documents */}
                    <TabsContent value="documents" className="mt-0">
                        <Card className="glass-card border-white/5 shadow-2xl">
                            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Verification Documents</CardTitle></CardHeader>
                            <CardContent>
                                {gym.gymVerificationDocuments?.length > 0 ? (
                                    <div className="grid gap-3">
                                        {gym.gymVerificationDocuments.map((doc: any) => (
                                            <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 group">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                                                        <FileText className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm">{doc.documentType.replace(/_/g, " ").toUpperCase()}</div>
                                                        <div className="text-xs text-muted-foreground">{doc.fileName}</div>
                                                        <div className={`text-xs mt-0.5 font-medium ${doc.verificationStatus === "approved" ? "text-green-500" : doc.verificationStatus === "rejected" ? "text-red-400" : "text-yellow-500"}`}>
                                                            {doc.verificationStatus.toUpperCase()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="ghost" onClick={() => openDoc(doc)} className="text-blue-400 hover:bg-blue-400/10 rounded-lg">
                                                    View
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="py-12 text-center text-muted-foreground">No verification documents uploaded yet.</div>}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Invite Gym Admin Modal */}
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogContent className="sm:max-w-[425px] bg-sidebar-accent/95 border-sidebar-border/50 text-white backdrop-blur-xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Invite Gym Admin</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Invite the gym admin to access their GMS dashboard. They sign up with their own password—no credentials to share.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleInviteAdmin} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Gym</Label>
                            <Input value={gym?.name || ""} disabled className="bg-black/40 border-white/10 opacity-80" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="inviteEmail">Admin Email <span className="text-red-500">*</span></Label>
                            <Input id="inviteEmail" type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="bg-black/40 border-white/10 focus-visible:ring-primary" placeholder="admin@gym.com" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="inviteName">Admin Name <span className="text-red-500">*</span></Label>
                            <Input id="inviteName" required value={inviteName} onChange={e => setInviteName(e.target.value)} className="bg-black/40 border-white/10 focus-visible:ring-primary" placeholder="John Doe" />
                        </div>
                        <p className="text-[10px] text-zinc-400">
                            If they already have an account, they will be linked immediately. Otherwise they must sign up at the app to set their password and access the GMS.
                        </p>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsInviteOpen(false)} className="text-muted-foreground hover:text-white">Cancel</Button>
                            <Button type="submit" disabled={inviting} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                                {inviting ? "Inviting..." : "Invite Admin"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
