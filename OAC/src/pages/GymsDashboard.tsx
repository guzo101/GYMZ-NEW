import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Search, FileText, UserPlus, LogOut, RefreshCw, Plus, ChevronDown, CheckCircle2, PauseCircle, RotateCcw, AlertTriangle, Pencil, UserRoundPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function GymsDashboard() {
    const [gyms, setGyms] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [promotingId, setPromotingId] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    // Manual Creation State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [createForm, setCreateForm] = useState({
        gym_name: "",
        owner_name: "",
        owner_email: "",
        owner_password: "",
        location: "",
        city: ""
    });

    // Invite Gym Admin State (OAC → invite registered gym admins to access GMS)
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteGym, setInviteGym] = useState<any>(null);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteName, setInviteName] = useState("");
    const [inviting, setInviting] = useState(false);

    const navigate = useNavigate();

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        const [gymsRes, appsRes] = await Promise.all([
            supabase.from("gyms").select(`
                id, name, city, status,
                gym_onboarding_status (status, completeness_score),
                gym_contacts (id, email, name, role),
                gym_branches (id),
                gym_hours (id),
                gym_membership_plans (id, is_active),
                gym_facilities_equipment (id),
                gym_media_assets (id),
                gym_payment_methods (id, is_active),
                gym_verification_documents (id)
            `).order("created_at", { ascending: false }),
            supabase.from("gym_applications").select("*").in("status", ["pending"]).order("created_at", { ascending: false }),
        ]);
        if (!gymsRes.error) setGyms(DataMapper.fromDb(gymsRes.data || []));
        if (!appsRes.error) setApplications(DataMapper.fromDb(appsRes.data || []));
        setLoading(false);
    };

    const computeScore = (gym: any): number => {
        let s = 0;
        if (gym.name && gym.city) s += 10;
        if ((gym.gymContacts?.length || 0) > 0) s += 10;
        if ((gym.gymBranches?.length || 0) > 0) s += 10;
        if ((gym.gymFacilitiesEquipment?.length || 0) > 0) s += 10;
        if ((gym.gymMembershipPlans?.filter((p: any) => p.isActive)?.length || 0) > 0) s += 15;
        if ((gym.gymHours?.length || 0) >= 5) s += 10;
        if ((gym.gymMediaAssets?.length || 0) >= 3) s += 10;
        if ((gym.gymPaymentMethods?.filter((p: any) => p.isActive)?.length || 0) > 0) s += 10;
        if ((gym.gymVerificationDocuments?.length || 0) > 0) s += 15;
        return Math.min(s, 100);
    };

    const handleSetStatus = async (gymId: string, newStatus: string) => {
        const label = newStatus.replace(/_/g, " ");
        try {
            // Step 1: Upsert onboarding status
            const { data: onbData, error: upsertError } = await supabase
                .from("gym_onboarding_status")
                .upsert({ gym_id: gymId, status: newStatus }, { onConflict: "gym_id" })
                .select();
            console.log("[OAC] Onboarding upsert:", { onbData, upsertError });
            if (upsertError) throw new Error(`Onboarding status: ${upsertError.message}`);

            // Step 2: Update gyms table (controls app visibility)
            const { data: gymData, error: gymError } = await supabase
                .from("gyms")
                .update({ status: newStatus })
                .eq("id", gymId)
                .select("id, status");
            console.log("[OAC] Gym update:", { gymData, gymError });
            if (gymError) throw new Error(`Gym record: ${gymError.message}`);
            if (!gymData || gymData.length === 0) throw new Error("Gym update returned no rows — likely blocked by RLS");

            toast.success(`Gym status set to "${label}"`);
            await fetchAll();
        } catch (err: any) {
            console.error("[OAC] Status change failed:", err);
            toast.error(`Failed: ${err.message}`);
        }
    };

    const handlePromote = async (app: any) => {
        setPromotingId(app.id);
        try {
            // Updated to use the new SQL-Only provisioning with password
            const { data, error } = await supabase.rpc("provision_new_gym", {
                p_gym_name: app.gymName,
                p_owner_email: app.email,
                p_owner_name: app.ownerName,
                p_owner_password: app.password || "Password@123", // Fallback for old apps
                p_location: app.location || "",
                p_feature_flags: app.featureFlags || { events_enabled: true, sponsors_enabled: true },
            });
            if (error) throw error;

            // Mark application as approved
            await supabase.from("gym_applications").update({ status: "approved" }).eq("id", app.id);

            toast.success(`Gym "${app.gymName}" created! Account for ${app.email} is active.`);
            await fetchAll();
            if (data) navigate(`/onboarding/${data}`);
        } catch (err: any) {
            toast.error("Failed to promote: " + err.message);
        }
        setPromotingId(null);
    };

    const handleReject = async (appId: string) => {
        try {
            const { error } = await supabase
                .from("gym_applications")
                .update({ status: 'rejected' })
                .eq('id', appId);
            if (error) throw error;
            toast.success("Application rejected");
            await fetchAll();
        } catch (err: any) {
            toast.error("Failed to reject: " + err.message);
        }
    };

    const handleManualCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const { data, error } = await supabase.rpc("oac_create_gym_and_invite", {
                p_gym_name: createForm.gym_name,
                p_owner_email: createForm.owner_email,
                p_owner_name: createForm.owner_name,
                p_owner_password: createForm.owner_password,
                p_location: createForm.location,
                p_city: createForm.city
            });

            if (error) throw error;

            toast.success(`Gym "${createForm.gym_name}" provisioned securely! Redirecting to setup wizard...`);
            setIsCreateOpen(false);
            setCreateForm({ gym_name: "", owner_name: "", owner_email: "", owner_password: "", location: "", city: "" });
            if (data) navigate(`/onboarding/${data}`);
        } catch (err: any) {
            toast.error("Manual creation failed: " + err.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleInviteAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteGym || !inviteEmail?.trim() || !inviteName?.trim()) {
            toast.error("Email and name are required.");
            return;
        }
        setInviting(true);
        try {
            const { data, error } = await supabase.rpc("oac_invite_gym_admin", {
                p_gym_id: inviteGym.id,
                p_email: inviteEmail.trim().toLowerCase(),
                p_name: inviteName.trim(),
            });
            if (error) throw error;
            const result = data as { success?: boolean; message?: string; existing_user?: boolean };
            let finalMessage = result?.message || "Invitation sent.";

            if (!result?.existing_user) {
                const { data: fnData, error: fnError } = await supabase.functions.invoke("send-gym-admin-invite", {
                    body: {
                        email: inviteEmail.trim().toLowerCase(),
                        name: inviteName.trim(),
                        gym_id: inviteGym.id,
                        gym_name: inviteGym.name,
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
            setInviteGym(null);
            setInviteEmail("");
            setInviteName("");
        } catch (err: any) {
            toast.error(err?.message || "Failed to invite admin.");
        } finally {
            setInviting(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate("/login");
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "active": return <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-500 text-xs font-bold uppercase">Active</span>;
            case "pending_verification": return <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500 text-xs font-bold uppercase">Pending Review</span>;
            case "rejected": return <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold uppercase">Rejected</span>;
            case "suspended": return <span className="px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold uppercase">Suspended</span>;
            case "changes_requested": return <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold uppercase">Changes Requested</span>;
            case "draft": return <span className="px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs font-bold uppercase">Draft</span>;
            default: return <span className="px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs font-bold uppercase">{status}</span>;
        }
    };

    const filteredGyms = gyms.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        (g.city && g.city.toLowerCase().includes(search.toLowerCase()))
    );

    const totalActive = gyms.filter(g => g.gymOnboardingStatus?.[0]?.status === "active").length;
    const totalPending = gyms.filter(g => g.gymOnboardingStatus?.[0]?.status === "pending_verification").length;
    const totalSuspended = gyms.filter(g => g.gymOnboardingStatus?.[0]?.status === "suspended").length;

    return (
        <div className="min-h-screen bg-mesh-glow text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Owner Admin Console</h1>
                        <p className="text-muted-foreground mt-1">Manage, verify, and monitor all gyms across the Gymz ecosystem.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-2 font-bold shadow-lg shadow-primary/20">
                            <Plus className="h-4 w-4" /> Create New Gym
                        </Button>
                        <Button onClick={fetchAll} variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 rounded-xl gap-2 hidden sm:flex">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => navigate("/audit-logs")} variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 rounded-xl gap-2">
                            <FileText className="h-4 w-4" /> Audit Logs
                        </Button>
                        <Button onClick={handleSignOut} variant="ghost" className="text-muted-foreground hover:text-white gap-2">
                            <LogOut className="h-4 w-4" /> Sign Out
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="glass-card border-white/5 shadow-xl">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Gyms</CardTitle></CardHeader>
                        <CardContent><div className="text-3xl font-bold">{gyms.length}</div></CardContent>
                    </Card>
                    <Card className="glass-card border-white/5 shadow-xl">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle></CardHeader>
                        <CardContent><div className="text-3xl font-bold text-green-500">{totalActive}</div></CardContent>
                    </Card>
                    <Card className="glass-card border-white/5 shadow-xl">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle></CardHeader>
                        <CardContent><div className="text-3xl font-bold text-yellow-500">{totalPending}</div></CardContent>
                    </Card>
                    <Card className="glass-card border-white/5 shadow-xl">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Suspended</CardTitle></CardHeader>
                        <CardContent><div className="text-3xl font-bold text-orange-500">{totalSuspended}</div></CardContent>
                    </Card>
                </div>

                {/* Applications from GOS */}
                {applications.length > 0 && (
                    <Card className="glass-card border-blue-500/20 shadow-2xl">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400"><UserPlus className="h-5 w-5" /></div>
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        New Applications
                                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">{applications.length}</span>
                                    </CardTitle>
                                    <CardDescription>Applications from the Gymz Onboarding System (GOS). Promote to create a gym profile.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {applications.map(app => (
                                    <div key={app.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-blue-500/10 hover:bg-white/10 transition-colors flex-wrap gap-3">
                                        <div>
                                            <div className="font-bold text-white">{app.gymName}</div>
                                            <div className="text-sm text-muted-foreground">{app.ownerName} · {app.email} · {app.location || "Location not set"}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{new Date(app.createdAt).toLocaleDateString()}</div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleReject(app.id)}
                                                className="text-red-400 hover:bg-red-500/10 hover:text-red-500 rounded-xl px-3"
                                            >
                                                Reject
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => handlePromote(app)}
                                                disabled={promotingId === app.id}
                                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2 font-bold"
                                            >
                                                {promotingId === app.id ? "Creating..." : "Approve & Create"}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Gym Registry */}
                <Card className="glass-card border-white/5 shadow-2xl">
                    <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <CardTitle>Gym Registry</CardTitle>
                                <CardDescription>All registered facilities</CardDescription>
                            </div>
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search gyms..."
                                    className="pl-9 bg-black/40 border-white/10 rounded-xl"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                <span>Loading gyms...</span>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-black/20">
                                        <tr>
                                            <th className="px-6 py-4 rounded-tl-lg">Gym Name</th>
                                            <th className="px-6 py-4">City</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Completeness</th>
                                            <th className="px-6 py-4 text-right rounded-tr-lg">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGyms.map(gym => {
                                            const onboardingStatus = gym.gymOnboardingStatus?.[0]?.status || "draft";
                                            const dbScore = gym.gymOnboardingStatus?.[0]?.completenessScore || 0;
                                            const score = Math.max(dbScore, computeScore(gym));
                                            return (
                                                <tr key={gym.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-medium">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-lg bg-primary/10 text-primary hidden sm:flex">
                                                                <Building2 className="h-4 w-4" />
                                                            </div>
                                                            {gym.name}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-muted-foreground">{gym.city || "—"}</td>
                                                    <td className="px-6 py-4">{getStatusBadge(onboardingStatus)}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-24 bg-black/40 rounded-full h-1.5">
                                                                <div className={`h-1.5 rounded-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-primary'}`} style={{ width: `${score}%` }} />
                                                            </div>
                                                            <span className={`text-xs font-bold ${score >= 80 ? 'text-green-500' : score >= 60 ? 'text-yellow-500' : 'text-muted-foreground'}`}>{score}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-white gap-1" title="Invite gym admin to access GMS" onClick={() => { setInviteGym(gym); setInviteEmail(gym.gymContacts?.[0]?.email || ""); setInviteName(gym.gymContacts?.[0]?.name || ""); setIsInviteOpen(true); }}>
                                                                <UserRoundPlus className="h-3.5 w-3.5" /> Invite Admin
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-white" onClick={() => navigate(`/gym/${gym.id}`)}>View</Button>
                                                            {onboardingStatus === "pending_verification" && (
                                                                <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg" onClick={() => navigate(`/verify/${gym.id}`)}>Review</Button>
                                                            )}
                                                            {["draft", "changes_requested"].includes(onboardingStatus) && (
                                                                <Button size="sm" variant="outline" className="border-primary/50 text-primary hover:bg-primary/20 rounded-lg" onClick={() => navigate(`/onboarding/${gym.id}`)}>
                                                                    <Pencil className="h-3 w-3 mr-1" /> Wizard
                                                                </Button>
                                                            )}
                                                            {/* Status management dropdown */}
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button size="sm" variant="outline" className="border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 rounded-lg px-2">
                                                                        <ChevronDown className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-white min-w-[180px]">
                                                                    {onboardingStatus !== "active" && (
                                                                        <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-green-500/10 text-green-400 focus:bg-green-500/10 focus:text-green-400" onClick={() => handleSetStatus(gym.id, "active")}>
                                                                            <CheckCircle2 className="h-4 w-4" /> Activate
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {onboardingStatus !== "suspended" && (
                                                                        <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-orange-500/10 text-orange-400 focus:bg-orange-500/10 focus:text-orange-400" onClick={() => handleSetStatus(gym.id, "suspended")}>
                                                                            <PauseCircle className="h-4 w-4" /> Suspend
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {onboardingStatus !== "changes_requested" && (
                                                                        <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-blue-500/10 text-blue-400 focus:bg-blue-500/10 focus:text-blue-400" onClick={() => handleSetStatus(gym.id, "changes_requested")}>
                                                                            <AlertTriangle className="h-4 w-4" /> Request Changes
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuSeparator className="bg-white/10" />
                                                                    {onboardingStatus !== "draft" && (
                                                                        <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-white/5 text-muted-foreground focus:bg-white/5 focus:text-white" onClick={() => handleSetStatus(gym.id, "draft")}>
                                                                            <RotateCcw className="h-4 w-4" /> Reset to Draft
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredGyms.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                                    {search ? "No gyms match your search." : "No gyms yet. Promote an application to get started."}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Create Gym Modal */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[425px] bg-sidebar-accent/95 border-sidebar-border/50 text-white backdrop-blur-xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Manually Onboard Gym</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Create a new gym shell and invite the owner via email. You will be redirected to the setup wizard to complete the profile.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleManualCreate} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="gymName">Gym Name <span className="text-red-500">*</span></Label>
                            <Input id="gymName" required value={createForm.gym_name} onChange={e => setCreateForm(f => ({ ...f, gym_name: e.target.value }))} className="bg-black/40 border-white/10 focus-visible:ring-primary" placeholder="e.g. Iron Gate Fitness" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ownerEmail">Owner Email <span className="text-red-500">*</span></Label>
                            <Input id="ownerEmail" type="email" required value={createForm.owner_email} onChange={e => setCreateForm(f => ({ ...f, owner_email: e.target.value }))} className="bg-black/40 border-white/10 focus-visible:ring-primary" placeholder="owner@gym.com" />
                            <p className="text-[10px] text-muted-foreground">They will automatically gain access when they sign up with this email.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ownerName">Owner Name <span className="text-red-500">*</span></Label>
                            <Input id="ownerName" required value={createForm.owner_name} onChange={e => setCreateForm(f => ({ ...f, owner_name: e.target.value }))} className="bg-black/40 border-white/10 focus-visible:ring-primary" placeholder="John Doe" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ownerPassword">Admin Password <span className="text-red-500">*</span></Label>
                            <Input id="ownerPassword" type="password" required minLength={8} value={createForm.owner_password} onChange={e => setCreateForm(f => ({ ...f, owner_password: e.target.value }))} className="bg-black/40 border-white/10 focus-visible:ring-primary" placeholder="••••••••" />
                            <p className="text-[10px] text-muted-foreground">The owner will use this password to log in to GMS.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
                                <Input id="city" required value={createForm.city} onChange={e => setCreateForm(f => ({ ...f, city: e.target.value }))} className="bg-black/40 border-white/10 focus-visible:ring-primary" placeholder="New York" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location">Address</Label>
                                <Input id="location" value={createForm.location} onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))} className="bg-black/40 border-white/10 focus-visible:ring-primary" placeholder="123 Main St" />
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-muted-foreground hover:text-white">Cancel</Button>
                            <Button type="submit" disabled={isCreating} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                                {isCreating ? "Provisioning Server..." : "Create & Open Wizard"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Invite Gym Admin Modal — Platform admin invites gym admins to access their GMS dashboard */}
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
                            <Input value={inviteGym?.name || ""} disabled className="bg-black/40 border-white/10 opacity-80" />
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
