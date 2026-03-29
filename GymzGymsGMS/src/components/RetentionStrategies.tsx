/* @ts-nocheck */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    AlertCircle,
    Send,
    Calendar,
    TrendingDown,
    RefreshCw,
    Sparkles,
    Bot,
    CheckCircle,
    Search,
    UserPlus
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { buildGrowthContext, generateDraft } from "@/services/growthAgent";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, subDays } from "date-fns";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const RENEWAL_TEMPLATES = [
    { id: "progress", label: "Progress Focused", text: "Hey {{name}}, you've been putting in the work and it shows. Membership expires in {{days}} days—don't let all that progress slip. Quick renewal link below 👇" },
    { id: "streak", label: "Streak Keeper", text: "{{name}}, {{days}} days until your membership ends. You've built solid momentum here. Renew now so we can keep building on what you started." },
    { id: "direct", label: "Direct Ask", text: "Hey {{name}}, heads up—membership expires in {{days}} days. Want to keep your spot? Takes 20 seconds to renew." }
];

const WINBACK_TEMPLATES = [
    { id: "noticed", label: "We Noticed", text: "Hey {{name}}, noticed you've been away. No pressure, just wanted to check in.{{discount}} Ready to get back on track?" },
    { id: "coach", label: "Coach Check-in", text: "{{name}}, it's been a while. The hardest part is showing up—everything else is easier after that.{{discount}} Let me know if you're coming back." },
    { id: "simple", label: "Simple & Direct", text: "Hey {{name}}, miss seeing you at the gym.{{discount}} Whenever you're ready, we're here." }
];

interface RetentionStrategiesProps {
    retention: number;
}

export const RetentionStrategies = ({ retention }: RetentionStrategiesProps) => {
    const { user } = useAuth();
    const [expiringMembers, setExpiringMembers] = useState([]);
    const [expiredMembers, setExpiredMembers] = useState([]);
    const [inactiveMembers, setInactiveMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sendingReminders, setSendingReminders] = useState(false);
    const [sendingToInactive, setSendingToInactive] = useState(false);
    const [selectedDiscount, setSelectedDiscount] = useState("none");
    const [selectedExpiring, setSelectedExpiring] = useState<string[]>([]);
    const [selectedExpired, setSelectedExpired] = useState<string[]>([]);
    const [selectedRenewalTemplateId, setSelectedRenewalTemplateId] = useState("progress");
    const [selectedWinbackTemplateId, setSelectedWinbackTemplateId] = useState("noticed");
    const [aiEnabled, setAiEnabled] = useState(false);
    const [generatingAi, setGeneratingAi] = useState(false);
    const [renewalDraftMessage, setRenewalDraftMessage] = useState(RENEWAL_TEMPLATES[0]?.text ?? "");
    const [winbackDraftMessage, setWinbackDraftMessage] = useState(WINBACK_TEMPLATES[0]?.text ?? "");
    const [outreachModal, setOutreachModal] = useState({
        open: false,
        type: "", // 'renewal' or 'winback'
        message: "",
        isAiGenerated: false
    });
    const [reviewModal, setReviewModal] = useState<{
        open: boolean;
        type: "renewal" | "winback";
        search: string;
    }>({ open: false, type: "renewal", search: "" });
    const [memberPickerModal, setMemberPickerModal] = useState<{
        open: boolean;
        type: "renewal" | "winback";
        allMembers: any[];
        search: string;
        sortBy: "name" | "expiry" | "status";
        pickerSelectedIds: string[];
    }>({ open: false, type: "renewal", allMembers: [], search: "", sortBy: "name", pickerSelectedIds: [] });
    const navigate = useNavigate();

    // Targets we're sending to (can come from filtered list OR from "choose from all" picker)
    const [renewalTargets, setRenewalTargets] = useState<any[]>([]);
    const [winbackTargets, setWinbackTargets] = useState<any[]>([]);
    const [renewalSelectionSource, setRenewalSelectionSource] = useState<"segment" | "custom">("segment");
    const [winbackSelectionSource, setWinbackSelectionSource] = useState<"segment" | "custom">("segment");

    useEffect(() => {
        fetchRetentionData();
    }, [user?.gymId]);

    async function fetchRetentionData() {
        if (!user?.gymId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const today = new Date();
            const next7Days = addDays(today, 7);
            const past7Days = subDays(today, 7);
            // IMPORTANT: `renewal_due_date` is a DATE column; filters must use YYYY-MM-DD strings.
            const todayStr = format(today, "yyyy-MM-dd");
            const next7DaysStr = format(next7Days, "yyyy-MM-dd");
            const past7DaysStr = format(past7Days, "yyyy-MM-dd");

            // Get members expiring in next 7 days
            const { data: expiring } = await supabase
                .from("users")
                .select("id, name, email, renewal_due_date, membership_type")
                .eq("role", "member")
                .eq("membership_status", "Active")
                .eq("gym_id", user.gymId)
                .gte("renewal_due_date", todayStr)
                .lte("renewal_due_date", next7DaysStr)
                .order("renewal_due_date", { ascending: true });

            // Get members expired in last 7 days
            const { data: expired } = await supabase
                .from("users")
                .select("id, name, email, renewal_due_date, membership_type")
                .eq("role", "member")
                .eq("membership_status", "Inactive")
                .eq("gym_id", user.gymId)
                .gte("renewal_due_date", past7DaysStr)
                .lt("renewal_due_date", todayStr)
                .order("renewal_due_date", { ascending: false });

            //Get inactive members (not Active)
            const { data: inactive } = await supabase
                .from("users")
                .select("id, name, email, membership_status")
                .eq("role", "member")
                .eq("gym_id", user.gymId)
                .neq("membership_status", "Active")
                .limit(20);

            setExpiringMembers(expiring || []);
            setExpiredMembers(expired || []);
            setInactiveMembers(inactive || []);
            setRenewalTargets(expiring || []);
            setWinbackTargets(expired || []);
            setRenewalSelectionSource("segment");
            setWinbackSelectionSource("segment");

            // Default select all for convenience
            setSelectedExpiring((expiring || []).map(m => m.id));
            setSelectedExpired((expired || []).map(m => m.id));
            // Set initial drafts to match currently selected template
            setRenewalDraftMessage(
                RENEWAL_TEMPLATES.find((t) => t.id === selectedRenewalTemplateId)?.text ??
                RENEWAL_TEMPLATES[0]?.text ??
                ""
            );
            setWinbackDraftMessage(
                WINBACK_TEMPLATES.find((t) => t.id === selectedWinbackTemplateId)?.text ??
                WINBACK_TEMPLATES[0]?.text ??
                ""
            );
        } catch (error) {
            console.error("Error fetching retention data:", error);
        } finally {
            setLoading(false);
        }
    }

    const getSelectedTargets = (type: "renewal" | "winback") => {
        if (type === "renewal") {
            const selectedSet = new Set(selectedExpiring);
            return renewalTargets.filter((m) => selectedSet.has(m.id));
        }
        const selectedSet = new Set(selectedExpired);
        return winbackTargets.filter((m) => selectedSet.has(m.id));
    };

    const getDraftText = (type: "renewal" | "winback") => (type === "renewal" ? renewalDraftMessage : winbackDraftMessage);

    const firstNameFromMember = (member: any) => {
        const raw = (member?.name || "").trim();
        if (!raw) return "friend";
        return raw.split(" ")[0] || "friend";
    };

    const selectedUsersMentionList = (type: "renewal" | "winback") => {
        const selected = getSelectedTargets(type);
        const names = selected
            .map((m: any) => firstNameFromMember(m))
            .filter(Boolean);
        const unique = Array.from(new Set(names));
        if (unique.length === 0) return "@selectedUsers";
        return unique.map((n) => `@${n}`).join(" ");
    };

    const personalizeMessage = (rawMessage: string, type: "renewal" | "winback", member: any) => {
        const firstName = firstNameFromMember(member);

        let daysUntilExpiry = 7;
        if (type === "renewal") {
            daysUntilExpiry = member?.renewal_due_date
                ? Math.ceil(
                    (new Date(member.renewal_due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                )
                : 7;
        }

        let discountMsg = "";
        if (type === "winback") {
            if (selectedDiscount === "10") discountMsg = " I've set up 10% off if you rejoin today.";
            if (selectedDiscount === "20") discountMsg = " Rejoin today and I'll give you 20% off.";
            if (selectedDiscount === "freeweek") discountMsg = " Come in for a free week on me.";
        }

        // 1) Replace @selectedUsers token (same for all recipients)
        const selectedMentions = selectedUsersMentionList(type);
        let msg = (rawMessage || "").replace(/@selectedUsers\b/gi, selectedMentions);

        // 2) Replace {{}} placeholders (backwards compatible)
        msg = msg
            .replace(/{{name}}/g, firstName)
            .replace(/{{days}}/g, daysUntilExpiry.toString())
            .replace(/{{discount}}/g, discountMsg);

        // 3) Replace any other @something mention with @<this recipient first name>
        // (Keeps @selectedUsers already expanded above)
        msg = msg.replace(/@([a-zA-Z][\w-]*)/g, (full, tag) => {
            if (String(tag).toLowerCase() === "selectedusers") return full;
            return `@${firstName}`;
        });

        return msg;
    };

    const openReviewModal = (type: "renewal" | "winback") => {
        const selectedCount = type === "renewal" ? selectedExpiring.length : selectedExpired.length;
        if (selectedCount === 0) return;
        setReviewModal({ open: true, type, search: "" });
    };

    async function confirmSendRenewal() {
        setSendingReminders(true);
        try {
            let successCount = 0;
            const targets = renewalTargets.filter(m => selectedExpiring.includes(m.id));

            for (const member of targets) {
                const finalMessage = personalizeMessage(outreachModal.message, "renewal", member);

                const { error } = await supabase
                    .from("notifications")
                    .insert({
                        user_id: member.id,
                        gym_id: user?.gymId ?? undefined,
                        sender_id: user?.id ?? undefined,
                        sender_type: "admin",
                        sender_name: user?.name || user?.email || "Admin",
                        title: user?.name || "Admin",
                        message: finalMessage,
                        type: "renewal_reminder",
                        read: false
                    });

                if (!error) {
                    successCount++;
                    // Record in pending_outreach for tracking (non-blocking; don't fail send if this errors)
                    const { error: poErr } = await supabase.from("pending_outreach").insert({
                        user_id: member.id,
                        message: finalMessage,
                        type: "renewal",
                        status: "sent",
                        sent_at: new Date().toISOString(),
                        metadata: {
                            is_ai: outreachModal.isAiGenerated,
                            template_id: selectedRenewalTemplateId
                        }
                    });
                    if (poErr) console.warn("pending_outreach tracking failed:", poErr.message);
                }
                await new Promise(resolve => setTimeout(resolve, 80));
            }

            toast.success(`Sent ${successCount} renewal reminders!`);
            setOutreachModal({ ...outreachModal, open: false });
            fetchRetentionData();
        } catch (error) {
            toast.error("Failed to send reminders: " + error.message);
        } finally {
            setSendingReminders(false);
        }
    }

    async function confirmSendWinback() {
        setSendingToInactive(true);
        try {
            let successCount = 0;
            const targets = winbackTargets.filter(m => selectedExpired.includes(m.id));

            for (const member of targets) {
                const finalMessage = personalizeMessage(outreachModal.message, "winback", member);

                const { error } = await supabase
                    .from("notifications")
                    .insert({
                        user_id: member.id,
                        gym_id: user?.gymId ?? undefined,
                        sender_id: user?.id ?? undefined,
                        sender_type: "admin",
                        sender_name: user?.name || user?.email || "Admin",
                        title: user?.name || "Admin",
                        message: finalMessage,
                        type: "win_back",
                        read: false
                    });

                if (!error) {
                    successCount++;
                    // Record in pending_outreach for tracking (non-blocking; don't fail send if this errors)
                    const { error: poErr } = await supabase.from("pending_outreach").insert({
                        user_id: member.id,
                        message: finalMessage,
                        type: "win_back",
                        status: "sent",
                        sent_at: new Date().toISOString(),
                        metadata: {
                            is_ai: outreachModal.isAiGenerated,
                            discount: selectedDiscount,
                            template_id: selectedWinbackTemplateId
                        }
                    });
                    if (poErr) console.warn("pending_outreach tracking failed:", poErr.message);
                }
                await new Promise(resolve => setTimeout(resolve, 80));
            }

            toast.success(`Sent ${successCount} win-back messages!`);
            setOutreachModal({ ...outreachModal, open: false });
        } catch (error) {
            toast.error("Failed to send messages: " + error.message);
        } finally {
            setSendingToInactive(false);
        }
    }

    const openOutreachModal = async (type: string, templateId?: string) => {
        let defaultMsg = "";
        let isAi = false;

        if (aiEnabled && !templateId) {
            setGeneratingAi(true);
            try {
                // Get context for the first selected user to show as a preview
                const firstId = type === 'renewal' ? selectedExpiring[0] : selectedExpired[0];
                if (firstId) {
                    const context = await buildGrowthContext(firstId);
                    if (context) {
                        defaultMsg = await generateDraft(context, type as 'renewal' | 'win_back');
                        isAi = true;
                    }
                }
            } catch (err) {
                console.error("AI Draft failed:", err);
            } finally {
                setGeneratingAi(false);
            }
        }

        if (!defaultMsg) {
            if (type === 'renewal') {
                const tid = templateId || selectedRenewalTemplateId;
                const next = RENEWAL_TEMPLATES.find(t => t.id === tid)?.text || RENEWAL_TEMPLATES[0].text;
                defaultMsg = templateId ? next : (renewalDraftMessage || next);
                if (templateId) {
                    setSelectedRenewalTemplateId(templateId);
                    setRenewalDraftMessage(next);
                }
            } else {
                const tid = templateId || selectedWinbackTemplateId;
                const next = WINBACK_TEMPLATES.find(t => t.id === tid)?.text || WINBACK_TEMPLATES[0].text;
                defaultMsg = templateId ? next : (winbackDraftMessage || next);
                if (templateId) {
                    setSelectedWinbackTemplateId(templateId);
                    setWinbackDraftMessage(next);
                }
            }
        }

        if (defaultMsg && isAi) {
            if (type === "renewal") setRenewalDraftMessage(defaultMsg);
            if (type === "winback") setWinbackDraftMessage(defaultMsg);
        }

        setOutreachModal({
            open: true,
            type,
            message: defaultMsg,
            isAiGenerated: isAi
        });
    };

    if (loading) {
        return (
            <Card className="glass-card">
                <CardContent className="p-6 flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    if (!user?.gymId) {
        return (
            <Card className="glass-card border-primary/20">
                <CardContent className="p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 opacity-50" />
                    <p className="text-sm font-medium">Gym not linked</p>
                    <p className="text-xs text-center">Link your gym in settings to use retention tools.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="glass-card border-primary/20">
            <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <AlertCircle className="h-5 w-5 text-primary" />
                            Retention Improvement
                        </CardTitle>
                        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
                            <Bot className="h-3.5 w-3.5" /> Gymz Growth Agent Active
                        </p>
                    </div>
                    <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                        <div className="flex items-center gap-2 bg-stone-900/50 px-3 py-1.5 rounded-full border border-stone-800 shadow-sm">
                            <Sparkles className={`h-3 w-3 ${aiEnabled ? 'text-primary fill-primary' : 'text-stone-500'}`} />
                            <Label htmlFor="ai-mode" className="text-[10px] font-bold uppercase tracking-wider text-stone-300 cursor-pointer">AI Mode</Label>
                            <Switch
                                id="ai-mode"
                                checked={aiEnabled}
                                onCheckedChange={setAiEnabled}
                                className="scale-75 data-[state=checked]:bg-primary"
                            />
                        </div>
                        <Badge variant="outline" className="border-primary/50 bg-primary/5 text-primary h-7 px-3 text-xs font-medium whitespace-nowrap">
                            {retention}% Retention
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
                {/* Insights Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Expiring Soon */}
                    <div className="p-5 bg-card/40 rounded-xl border border-primary/10 flex flex-col h-full shadow-sm hover:border-primary/20 transition-colors relative">
                        <div className="flex items-center justify-between mb-4">
                            <div
                                className="flex items-center gap-2.5 cursor-pointer hover:underline group"
                                onClick={() => navigate("/members?sort=expiry&status=Active")}
                            >
                                <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-foreground/20 shadow-md shrink-0">
                                    <Calendar className="h-3 w-3 text-white" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-primary">Expiring Soon (7 Days)</h4>
                                    <Badge
                                        variant="secondary"
                                        className="text-[10px] px-2 h-5 bg-muted/40 text-muted-foreground border border-border/50"
                                    >
                                        {renewalSelectionSource === "custom" ? "Custom list" : "Suggested segment"}
                                    </Badge>
                                </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer select-none hover:opacity-90">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Select All</span>
                                <Checkbox
                                    checked={selectedExpiring.length === renewalTargets.length && renewalTargets.length > 0}
                                    onCheckedChange={(checked) => {
                                        const isChecked = checked === true;
                                        setSelectedExpiring(isChecked ? renewalTargets.map(m => m.id) : []);
                                    }}
                                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                            </label>
                        </div>

                        <div className="flex-1 min-h-[140px]">
                            {renewalTargets.length > 0 ? (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {renewalTargets.slice(0, 15).map((member) => (
                                        <div key={member.id} className="text-sm flex justify-between items-center group p-2 hover:bg-primary/5 rounded-lg transition-colors border border-transparent hover:border-primary/10">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <Checkbox
                                                    checked={selectedExpiring.includes(member.id)}
                                                    onCheckedChange={(checked) => {
                                                        const isChecked = checked === true;
                                                        setSelectedExpiring(prev =>
                                                            isChecked ? [...prev, member.id] : prev.filter(id => id !== member.id)
                                                        );
                                                    }}
                                                    className="w-4 h-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                />
                                                <span
                                                    className="truncate font-medium cursor-pointer text-foreground/80 hover:text-primary transition-colors"
                                                    onClick={() => navigate(`/members?id=${member.id}`)}
                                                >
                                                    {member.name || member.email}
                                                </span>
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-stone-100 dark:bg-stone-800 text-muted-foreground hover:bg-stone-200 dark:hover:bg-stone-700 shrink-0">
                                                {member.renewal_due_date ? format(new Date(member.renewal_due_date), 'MMM d') : '—'}
                                            </Badge>
                                        </div>
                                    ))}
                                    {renewalTargets.length > 15 && (
                                        <p
                                            className="text-[10px] text-center text-muted-foreground cursor-pointer hover:text-primary mt-3 font-medium transition-colors"
                                            onClick={() => navigate("/members?sort=expiry&status=Active")}
                                        >
                                            View all {renewalTargets.length} members
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 gap-2">
                                    <CheckCircle className="h-8 w-8 opacity-20" />
                                    <p className="text-xs font-medium">All clear! No members expiring soon.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-primary/10">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/5"
                                onClick={async () => {
                                    const { data: userData } = await supabase
                                        .from("users")
                                        .select("id, name, email, renewal_due_date, membership_type, membership_status, status")
                                        .eq("role", "member")
                                        .eq("gym_id", user.gymId)
                                        .order("name");
                                    const { data: membershipData } = await supabase
                                        .from("membership")
                                        .select("user_id, membership_status")
                                        .eq("gym_id", user.gymId);
                                    const statusByUser = new Map<string, string>();
                                    (membershipData || []).forEach((m: any) => {
                                        const s = (m.membership_status || "").trim().toLowerCase();
                                        if (s) {
                                            const label = s === "active" ? "Active" : s === "pending" ? "Pending" : s === "rejected" || s === "cancelled" ? "Inactive" : s.charAt(0).toUpperCase() + s.slice(1);
                                            statusByUser.set(m.user_id, label);
                                        }
                                    });
                                    const all = (userData || []).map((m: any) => {
                                        const fromUser = (m.membership_status || "").trim();
                                        const fromMembership = statusByUser.get(m.id);
                                        const fromStatus = (m.status || "").trim();
                                        const resolved = fromUser || fromMembership || (fromStatus ? (fromStatus.toLowerCase() === "active" ? "Active" : fromStatus) : null);
                                        return { ...m, membership_status: resolved };
                                    });
                                    const ids = new Set(all.map((m: any) => m.id));
                                    setMemberPickerModal({
                                        open: true,
                                        type: "renewal",
                                        allMembers: all,
                                        search: "",
                                        sortBy: "name",
                                        pickerSelectedIds: selectedExpiring.filter(id => ids.has(id))
                                    });
                                    setRenewalSelectionSource("custom");
                                }}
                            >
                                <UserPlus className="h-3.5 w-3.5 mr-2" />
                                Choose from all members
                            </Button>
                            <Select
                                value={selectedRenewalTemplateId}
                                onValueChange={(val) => {
                                    setSelectedRenewalTemplateId(val);
                                    const next =
                                        RENEWAL_TEMPLATES.find((t) => t.id === val)?.text ??
                                        RENEWAL_TEMPLATES[0]?.text ??
                                        "";
                                    setRenewalDraftMessage(next);
                                }}
                            >
                                <SelectTrigger className="w-full h-9 text-xs bg-background/50 border-input/50 focus:ring-primary/20">
                                    <SelectValue placeholder="Choose Message Template..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {RENEWAL_TEMPLATES.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                        Message (editable)
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        Use @name, @selectedUsers, {"{{days}}"}
                                    </span>
                                </div>
                                <Textarea
                                    value={renewalDraftMessage}
                                    onChange={(e) => setRenewalDraftMessage(e.target.value)}
                                    className="mt-2 min-h-[90px] bg-background/50 border-border/50 text-foreground text-xs leading-relaxed"
                                />
                            </div>

                            <Button
                                onClick={() => openReviewModal("renewal")}
                                disabled={sendingReminders || selectedExpiring.length === 0 || generatingAi}
                                size="sm"
                                className="w-full bg-primary hover:bg-primary/90 text-white border-none h-9 text-xs font-semibold shadow-md shadow-primary/10"
                            >
                                {generatingAi ? (
                                    <Sparkles className="h-3.5 w-3.5 mr-2 animate-pulse" />
                                ) : sendingReminders ? (
                                    <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                                ) : (
                                    <Send className="h-3.5 w-3.5 mr-2" />
                                )}
                                {generatingAi ? "AI Drafting..." : `Review & Send (${selectedExpiring.length})`}
                            </Button>
                        </div>
                    </div>

                    {/* Recently Expired */}
                    <div className="p-5 bg-card/40 rounded-xl border border-primary/10 flex flex-col h-full shadow-sm hover:border-primary/20 transition-colors relative">
                        <div className="flex items-center justify-between mb-4">
                            <div
                                className="flex items-center gap-2.5 cursor-pointer hover:underline group"
                                onClick={() => navigate("/members?status=Inactive")}
                            >
                                <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-foreground/20 shadow-md shrink-0">
                                    <TrendingDown className="h-3 w-3 text-white" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-primary">Recently Expired</h4>
                                    <Badge
                                        variant="secondary"
                                        className="text-[10px] px-2 h-5 bg-muted/40 text-muted-foreground border border-border/50"
                                    >
                                        {winbackSelectionSource === "custom" ? "Custom list" : "Suggested segment"}
                                    </Badge>
                                </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer select-none hover:opacity-90">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Select All</span>
                                <Checkbox
                                    checked={selectedExpired.length === winbackTargets.length && winbackTargets.length > 0}
                                    onCheckedChange={(checked) => {
                                        const isChecked = checked === true;
                                        setSelectedExpired(isChecked ? winbackTargets.map(m => m.id) : []);
                                    }}
                                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                            </label>
                        </div>

                        <div className="flex-1 min-h-[140px]">
                            {winbackTargets.length > 0 ? (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {winbackTargets.slice(0, 15).map((member) => (
                                        <div key={member.id} className="text-sm flex justify-between items-center group p-2 hover:bg-primary/5 rounded-lg transition-colors border border-transparent hover:border-primary/10">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <Checkbox
                                                    checked={selectedExpired.includes(member.id)}
                                                    onCheckedChange={(checked) => {
                                                        const isChecked = checked === true;
                                                        setSelectedExpired(prev =>
                                                            isChecked ? [...prev, member.id] : prev.filter(id => id !== member.id)
                                                        );
                                                    }}
                                                    className="w-4 h-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                />
                                                <span
                                                    className="truncate font-medium cursor-pointer text-foreground/80 hover:text-primary transition-colors"
                                                    onClick={() => navigate(`/members?id=${member.id}`)}
                                                >
                                                    {member.name || member.email}
                                                </span>
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-stone-100 dark:bg-stone-800 text-muted-foreground hover:bg-stone-200 dark:hover:bg-stone-700 shrink-0">
                                                {member.renewal_due_date ? format(new Date(member.renewal_due_date), 'MMM d') : '—'}
                                            </Badge>
                                        </div>
                                    ))}
                                    {winbackTargets.length > 15 && (
                                        <p
                                            className="text-[10px] text-center text-muted-foreground cursor-pointer hover:text-primary mt-3 font-medium transition-colors"
                                            onClick={() => navigate("/members?status=Inactive")}
                                        >
                                            View all {winbackTargets.length} members
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 gap-2">
                                    <Users className="h-8 w-8 opacity-20" />
                                    <p className="text-xs font-medium">No recent expirations found.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-primary/10">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/5"
                                onClick={async () => {
                                    const { data: userData } = await supabase
                                        .from("users")
                                        .select("id, name, email, renewal_due_date, membership_type, membership_status, status")
                                        .eq("role", "member")
                                        .eq("gym_id", user.gymId)
                                        .order("name");
                                    const { data: membershipData } = await supabase
                                        .from("membership")
                                        .select("user_id, membership_status")
                                        .eq("gym_id", user.gymId);
                                    const statusByUser = new Map<string, string>();
                                    (membershipData || []).forEach((m: any) => {
                                        const s = (m.membership_status || "").trim().toLowerCase();
                                        if (s) {
                                            const label = s === "active" ? "Active" : s === "pending" ? "Pending" : s === "rejected" || s === "cancelled" ? "Inactive" : s.charAt(0).toUpperCase() + s.slice(1);
                                            statusByUser.set(m.user_id, label);
                                        }
                                    });
                                    const all = (userData || []).map((m: any) => {
                                        const fromUser = (m.membership_status || "").trim();
                                        const fromMembership = statusByUser.get(m.id);
                                        const fromStatus = (m.status || "").trim();
                                        const resolved = fromUser || fromMembership || (fromStatus ? (fromStatus.toLowerCase() === "active" ? "Active" : fromStatus) : null);
                                        return { ...m, membership_status: resolved };
                                    });
                                    const ids = new Set(all.map((m: any) => m.id));
                                    setMemberPickerModal({
                                        open: true,
                                        type: "winback",
                                        allMembers: all,
                                        search: "",
                                        sortBy: "name",
                                        pickerSelectedIds: selectedExpired.filter(id => ids.has(id))
                                    });
                                    setWinbackSelectionSource("custom");
                                }}
                            >
                                <UserPlus className="h-3.5 w-3.5 mr-2" />
                                Choose from all members
                            </Button>
                            <div className="flex gap-3">
                                <Select
                                    value={selectedWinbackTemplateId}
                                    onValueChange={(val) => {
                                        setSelectedWinbackTemplateId(val);
                                        const next =
                                            WINBACK_TEMPLATES.find((t) => t.id === val)?.text ??
                                            WINBACK_TEMPLATES[0]?.text ??
                                            "";
                                        setWinbackDraftMessage(next);
                                    }}
                                >
                                    <SelectTrigger className="flex-1 h-9 text-xs bg-background/50 border-input/50 focus:ring-primary/20">
                                        <SelectValue placeholder="Win-back Template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {WINBACK_TEMPLATES.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedDiscount} onValueChange={setSelectedDiscount}>
                                    <SelectTrigger className="w-[100px] h-9 text-xs bg-background/50 border-input/50 focus:ring-primary/20">
                                        <SelectValue placeholder="Offer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Offer</SelectItem>
                                        <SelectItem value="10">10% Off</SelectItem>
                                        <SelectItem value="20">20% Off</SelectItem>
                                        <SelectItem value="freeweek">Free Wk</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                        Message (editable)
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        Use @name, @selectedUsers, {"{{discount}}"}
                                    </span>
                                </div>
                                <Textarea
                                    value={winbackDraftMessage}
                                    onChange={(e) => setWinbackDraftMessage(e.target.value)}
                                    className="mt-2 min-h-[90px] bg-background/50 border-border/50 text-foreground text-xs leading-relaxed"
                                />
                            </div>

                            <Button
                                onClick={() => openReviewModal("winback")}
                                disabled={sendingToInactive || selectedExpired.length === 0 || generatingAi}
                                size="sm"
                                variant="outline"
                                className="w-full h-9 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary dark:text-primary dark:hover:text-primary dark:hover:bg-primary/10 text-xs font-semibold shadow-sm"
                            >
                                {generatingAi ? (
                                    <Sparkles className="h-3.5 w-3.5 mr-2 animate-pulse text-primary" />
                                ) : sendingToInactive ? (
                                    <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                                ) : (
                                    <Users className="h-3.5 w-3.5 mr-2" />
                                )}
                                {generatingAi ? "AI Drafting..." : `Review & Send (${selectedExpired.length})`}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Helpful Tip */}
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-3">
                    <div className="p-1.5 bg-primary/10 rounded-full mt-0.5">
                        <span className="text-base">💡</span>
                    </div>
                    <div>
                        <h5 className="text-xs font-bold text-foreground mb-1">Retention Tip</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Sending personal renewal reminders 7 days before expiry increases renewal rates by up to <span className="text-primary font-bold">30%</span>.
                            Combine this with a Win-back offer for best results.
                        </p>
                    </div>
                </div>
            </CardContent>

            {/* Review Recipients Dialog */}
            <Dialog
                open={reviewModal.open}
                onOpenChange={(open) => setReviewModal((prev) => ({ ...prev, open }))}
            >
                <DialogContent className="sm:max-w-xl bg-background text-foreground border-border max-h-[85vh] flex flex-col shadow-xl p-6">
                    <DialogHeader className="space-y-1.5 pb-4 px-2 border-b border-border">
                        <DialogTitle className="text-lg font-bold text-foreground py-1">
                            {reviewModal.type === "renewal" ? "Review renewal recipients" : "Review win-back recipients"}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground py-1">
                            Confirm who will receive this message. You can remove anyone before continuing.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-4 px-2">
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search selected members..."
                                    value={reviewModal.search}
                                    onChange={(e) => setReviewModal((prev) => ({ ...prev, search: e.target.value }))}
                                    className="pl-9 h-10 text-sm bg-muted/30 text-foreground border-input focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="h-7 px-3 text-xs font-medium">
                                    {getSelectedTargets(reviewModal.type).length} selected
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="h-7 px-3 text-xs font-medium whitespace-nowrap"
                                >
                                    {reviewModal.type === "renewal"
                                        ? (renewalSelectionSource === "custom" ? "Custom list" : "Suggested segment")
                                        : (winbackSelectionSource === "custom" ? "Custom list" : "Suggested segment")}
                                </Badge>
                            </div>
                        </div>

                        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                    Template preview
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {reviewModal.type === "renewal" ? `Reminders` : `Win-back`} message
                                </span>
                            </div>
                            <p className="mt-2 text-xs text-foreground/80 leading-relaxed line-clamp-3">
                                {getDraftText(reviewModal.type)}
                            </p>
                        </div>

                        <div className="border border-border rounded-xl overflow-hidden bg-muted/20 max-h-[320px] overflow-y-auto custom-scrollbar">
                            {(() => {
                                const q = reviewModal.search.trim().toLowerCase();
                                const selected = getSelectedTargets(reviewModal.type);
                                const list = selected.filter((m: any) => {
                                    if (!q) return true;
                                    const name = (m.name || "").toLowerCase();
                                    const email = (m.email || "").toLowerCase();
                                    return name.includes(q) || email.includes(q);
                                });

                                if (list.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
                                            <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
                                            <p className="text-sm font-medium text-foreground py-2 px-3">
                                                {q ? "No selected members match your search" : "No members selected"}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1 py-1 px-3">
                                                {q ? "Try a different search term" : "Select at least one member to continue"}
                                            </p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="divide-y divide-border/50">
                                        {list.map((member: any) => {
                                            const isSelected =
                                                reviewModal.type === "renewal"
                                                    ? selectedExpiring.includes(member.id)
                                                    : selectedExpired.includes(member.id);
                                            return (
                                                <div
                                                    key={member.id}
                                                    className={`flex items-center justify-between gap-4 px-4 py-2 transition-colors ${isSelected ? "bg-primary/5" : ""} hover:bg-muted/50`}
                                                >
                                                    <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={(checked) => {
                                                                const isChecked = checked === true;
                                                                if (reviewModal.type === "renewal") {
                                                                    setSelectedExpiring((prev) =>
                                                                        isChecked ? prev : prev.filter((id) => id !== member.id)
                                                                    );
                                                                } else {
                                                                    setSelectedExpired((prev) =>
                                                                        isChecked ? prev : prev.filter((id) => id !== member.id)
                                                                    );
                                                                }
                                                            }}
                                                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
                                                        />
                                                        <span className="truncate text-sm font-medium text-foreground">
                                                            {member.name || member.email}
                                                        </span>
                                                    </label>
                                                    <span className="shrink-0 whitespace-nowrap text-right">
                                                        {member.renewal_due_date ? (
                                                            <Badge variant="secondary" className="text-[11px] font-medium whitespace-nowrap">
                                                                {format(new Date(member.renewal_due_date), "MMM d")}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 px-2 border-t border-border">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setReviewModal((prev) => ({ ...prev, open: false }))}
                            className="w-full sm:w-auto"
                        >
                            Back
                        </Button>
                        <Button
                            type="button"
                            onClick={async () => {
                                const selectedCount = getSelectedTargets(reviewModal.type).length;
                                if (selectedCount === 0) {
                                    toast.error("Select at least one member to continue.");
                                    return;
                                }
                                // Use the on-card editable draft as the message that will be edited/confirmed next.
                                setOutreachModal((prev) => ({
                                    ...prev,
                                    type: reviewModal.type,
                                    message: getDraftText(reviewModal.type),
                                    isAiGenerated: false
                                }));
                                setReviewModal((prev) => ({ ...prev, open: false }));
                                setOutreachModal((prev) => ({ ...prev, open: true }));
                            }}
                            className="w-full sm:w-auto bg-primary hover:bg-primary/90 font-semibold"
                        >
                            Continue to message
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Outreach Edit Dialog */}
            <Dialog open={outreachModal.open} onOpenChange={(open) => setOutreachModal({ ...outreachModal, open })}>
                <DialogContent className="sm:max-w-md bg-stone-900 border-stone-800">
                    <DialogHeader>
                        <DialogTitle className="text-stone-100">
                            {outreachModal.type === 'renewal' ? 'Edit Renewal Reminder' : 'Edit Win-back'}
                        </DialogTitle>
                        <DialogDescription className="text-stone-400 flex items-center gap-2">
                            {outreachModal.isAiGenerated ? (
                                <span className="flex items-center gap-1.5 text-primary/80 bg-primary/10 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter">
                                    <Sparkles className="h-3 w-3" /> AI Drafted
                                </span>
                            ) : "Customize your outreach. "}
                            Use @name, @selectedUsers, {"{{days}}"}, {"{{discount}}"}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center space-x-2 py-4">
                        <Textarea
                            value={outreachModal.message}
                            onChange={(e) => setOutreachModal({ ...outreachModal, message: e.target.value })}
                            className="min-h-[120px] bg-stone-950 border-stone-800 text-stone-200"
                        />
                    </div>

                    <DialogFooter className="sm:justify-end">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setOutreachModal({ ...outreachModal, open: false })}
                            className="bg-stone-800 hover:bg-stone-700 text-stone-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={outreachModal.type === 'renewal' ? confirmSendRenewal : confirmSendWinback}
                            disabled={sendingReminders || sendingToInactive}
                            className="bg-primary hover:bg-primary/90 text-white"
                        >
                            {(sendingReminders || sendingToInactive) && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                            Send to {outreachModal.type === 'renewal' ? selectedExpiring.length : selectedExpired.length} Members
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Member Picker Dialog - Choose from all members */}
            <Dialog
                open={memberPickerModal.open}
                onOpenChange={(open) => !open && setMemberPickerModal(prev => ({ ...prev, open: false }))}
            >
                <DialogContent className="sm:max-w-xl bg-background text-foreground border-border max-h-[85vh] flex flex-col shadow-xl p-6">
                    <DialogHeader className="space-y-1.5 pb-4 px-2 border-b border-border">
                        <DialogTitle className="text-lg font-bold text-foreground py-1">
                            {memberPickerModal.type === "renewal" ? "Choose members for renewal reminders" : "Choose members for win-back"}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground py-1">
                            Search, sort, and select members to send reminders to.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-4 px-2">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or email..."
                                    value={memberPickerModal.search}
                                    onChange={(e) => setMemberPickerModal(prev => ({ ...prev, search: e.target.value }))}
                                    className="pl-9 h-10 text-sm bg-muted/30 text-foreground border-input focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                            </div>
                            <Select
                                value={memberPickerModal.sortBy}
                                onValueChange={(val: "name" | "expiry" | "status") => setMemberPickerModal(prev => ({ ...prev, sortBy: val }))}
                            >
                                <SelectTrigger className="w-full sm:w-[140px] h-10 text-sm bg-muted/30 text-foreground border-input">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent className="z-[110]" position="popper">
                                    <SelectItem value="name">Name</SelectItem>
                                    <SelectItem value="expiry">Expiry Date</SelectItem>
                                    <SelectItem value="status">Status</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                                <Checkbox
                                    checked={(() => {
                                        const q = memberPickerModal.search.toLowerCase();
                                        const filtered = memberPickerModal.allMembers.filter(m =>
                                            !q ? true : (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)
                                        );
                                        return filtered.length > 0 && filtered.every((m: any) => memberPickerModal.pickerSelectedIds.includes(m.id));
                                    })()}
                                    onCheckedChange={(checked) => {
                                        const q = memberPickerModal.search.toLowerCase();
                                        const filtered = memberPickerModal.allMembers.filter(m =>
                                            !q ? true : (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)
                                        );
                                        const filteredIds = new Set(filtered.map((m: any) => m.id));
                                        const isChecked = checked === true;
                                        setMemberPickerModal(prev => ({
                                            ...prev,
                                            pickerSelectedIds: isChecked
                                                ? [...new Set([...prev.pickerSelectedIds, ...filtered.map((m: any) => m.id)])]
                                                : prev.pickerSelectedIds.filter(id => !filteredIds.has(id))
                                        }));
                                    }}
                                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors py-1 px-1">Select All (filtered)</span>
                            </label>
                            <span className="text-xs text-muted-foreground py-1 px-2">
                                {memberPickerModal.pickerSelectedIds.length} of {memberPickerModal.allMembers.length} selected
                            </span>
                        </div>

                        <div className="border border-border rounded-xl overflow-hidden bg-muted/20 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {(() => {
                                const q = memberPickerModal.search.toLowerCase();
                                let list = memberPickerModal.allMembers.filter(m =>
                                    !q ? true : (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)
                                );
                                if (memberPickerModal.sortBy === "name") {
                                    list = [...list].sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""));
                                } else if (memberPickerModal.sortBy === "expiry") {
                                    list = [...list].sort((a, b) => {
                                        const da = a.renewal_due_date ? new Date(a.renewal_due_date).getTime() : 0;
                                        const db = b.renewal_due_date ? new Date(b.renewal_due_date).getTime() : 0;
                                        return da - db;
                                    });
                                } else if (memberPickerModal.sortBy === "status") {
                                    const statusOrder: Record<string, number> = { Active: 0, active: 0, Pending: 1, pending: 1, Inactive: 2, inactive: 2, Rejected: 2, Cancelled: 2 };
                                    list = [...list].sort((a, b) => {
                                        const sa = (a.membership_status || "").trim() || "—";
                                        const sb = (b.membership_status || "").trim() || "—";
                                        const ia = statusOrder[sa] ?? 3;
                                        const ib = statusOrder[sb] ?? 3;
                                        if (ia !== ib) return ia - ib;
                                        return (a.name || a.email || "").localeCompare(b.name || b.email || "");
                                    });
                                }
                                return list.length > 0 ? (
                                    <div>
                                        <div className="sticky top-0 z-10 flex flex-nowrap items-center justify-between gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b border-border backdrop-blur-sm">
                                            <span>Member</span>
                                            <span className="whitespace-nowrap shrink-0">Status</span>
                                            <span className="whitespace-nowrap shrink-0">Expiry Date</span>
                                        </div>
                                        <div className="divide-y divide-border/50">
                                            {list.map((member: any) => {
                                                const isSelected = memberPickerModal.pickerSelectedIds.includes(member.id);
                                                return (
                                                    <div
                                                        key={member.id}
                                                        className={`flex flex-nowrap items-center justify-between gap-4 px-4 py-2 transition-colors ${isSelected ? "bg-primary/5" : ""} hover:bg-muted/50`}
                                                    >
                                                        <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={(checked) => {
                                                                    const isChecked = checked === true;
                                                                    setMemberPickerModal(prev => ({
                                                                        ...prev,
                                                                        pickerSelectedIds: isChecked
                                                                            ? [...prev.pickerSelectedIds, member.id]
                                                                            : prev.pickerSelectedIds.filter(id => id !== member.id)
                                                                    }));
                                                                }}
                                                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
                                                            />
                                                            <span className="truncate text-sm font-medium text-foreground">{member.name || member.email}</span>
                                                        </label>
                                                        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground w-20 text-center">
                                                            {(member.membership_status || "").trim() || "—"}
                                                        </span>
                                                        <span className="shrink-0 whitespace-nowrap text-right">
                                                            {member.renewal_due_date ? (
                                                                <Badge variant="secondary" className="text-[11px] font-medium whitespace-nowrap">
                                                                    {format(new Date(member.renewal_due_date), "MMM d")}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">—</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
                                        <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
                                        <p className="text-sm font-medium text-foreground py-2 px-3">
                                            {memberPickerModal.search ? "No members match your search" : "No members found"}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 py-1 px-3">
                                            {memberPickerModal.search ? "Try a different search term" : "Add members to your gym to get started"}
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 px-2 border-t border-border">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setMemberPickerModal(prev => ({ ...prev, open: false }))}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                const selected = memberPickerModal.allMembers.filter((m: any) =>
                                    memberPickerModal.pickerSelectedIds.includes(m.id)
                                );
                                if (memberPickerModal.type === "renewal") {
                                    setRenewalTargets(selected);
                                    setSelectedExpiring(selected.map((m: any) => m.id));
                                } else {
                                    setWinbackTargets(selected);
                                    setSelectedExpired(selected.map((m: any) => m.id));
                                }
                                setMemberPickerModal(prev => ({ ...prev, open: false }));
                                toast.success(`Selected ${selected.length} member${selected.length !== 1 ? "s" : ""}`);
                            }}
                            className="w-full sm:w-auto bg-primary hover:bg-primary/90 font-semibold"
                        >
                            Use {memberPickerModal.pickerSelectedIds.length} selected
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card >
    );
};
