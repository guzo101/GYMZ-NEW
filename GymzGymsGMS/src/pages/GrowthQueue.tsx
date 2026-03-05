import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Send,
    Clock,
    CheckCircle2,
    XCircle,
    Sparkles,
    RefreshCw,
    MoreVertical,
    Edit,
    Trash2,
    Play,
    Bot
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export default function GrowthQueue() {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("drafted");
    const [sendingId, setSendingId] = useState<string | null>(null);

    useEffect(() => {
        fetchQueue();
    }, [activeTab]);

    async function fetchQueue() {
        setLoading(true);
        try {
            let query = supabase
                .from("pending_outreach")
                .select(`
                  *,
                  users:user_id (name, email)
                `);

            if (activeTab === 'recovered') {
                query = query.not("recovered_at", "is", null);
            } else {
                query = query.eq("status", activeTab);
            }

            const { data, error } = await query.order("created_at", { ascending: false });

            if (error) throw error;
            setQueue(data || []);
        } catch (error) {
            console.error("Error fetching queue:", error);
            toast.error("Failed to load outreach queue");
        } finally {
            setLoading(false);
        }
    }

    const handleSend = async (id: string) => {
        setSendingId(id);
        try {
            const item = queue.find(q => q.id === id);
            if (!item) return;

            // 1. Send via notifications table (existing channel)
            const { error: notifyError } = await supabase
                .from("notifications")
                .insert({
                    user_id: item.user_id,
                    message: item.message,
                    type: item.type === 'renewal' ? 'renewal_reminder' : 'win_back',
                    read: false
                });

            if (notifyError) throw notifyError;

            // 2. Update status to sent
            const { error: updateError } = await supabase
                .from("pending_outreach")
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString()
                })
                .eq("id", id);

            if (updateError) throw updateError;

            toast.success("Message sent successfully!");
            fetchQueue();
        } catch (error) {
            toast.error("Failed to send message: " + error.message);
        } finally {
            setSendingId(null);
        }
    };

    const handleCancel = async (id: string) => {
        try {
            const { error } = await supabase
                .from("pending_outreach")
                .update({ status: 'cancelled' })
                .eq("id", id);

            if (error) throw error;
            toast.success("Outreach cancelled");
            fetchQueue();
        } catch (error) {
            toast.error("Failed to cancel message");
        }
    };

    const handlePulseSend = async () => {
        const draftedItems = queue.filter(q => q.status === 'drafted');
        if (draftedItems.length === 0) return;

        setLoading(true);
        let success = 0;
        try {
            for (const item of draftedItems) {
                await handleSend(item.id);
                success++;
                // Artificial delay to prevent notification spam/rate limits
                await new Promise(resolve => setTimeout(resolve, 800));
            }
            toast.success(`Successfully sent ${success} outreach messages!`);
        } catch (err) {
            toast.error("Pulse send interrupted");
        } finally {
            setLoading(false);
            fetchQueue();
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'drafted': return <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5">Drafted</Badge>;
            case 'sent': return <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5">Sent</Badge>;
            case 'recovered': return <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5">Recovered</Badge>;
            case 'cancelled': return <Badge variant="outline" className="border-primary/20 text-muted-foreground bg-primary/5">Cancelled</Badge>;
            case 'obsolete': return <Badge variant="outline" className="border-stone-500 text-stone-500">Obsolete</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-stone-100 flex items-center gap-2">
                        <Bot className="h-8 w-8 text-primary" /> Gymz Growth Queue
                    </h1>
                    <p className="text-stone-400 mt-1">Review and manage AI-generated outreach drafts.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-lg shadow-primary/20"
                        disabled={queue.filter(q => q.status === 'drafted').length === 0 || activeTab !== 'drafted' || loading}
                        onClick={handlePulseSend}
                    >
                        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Pulse Send Queue
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => fetchQueue()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="glass-card border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-stone-400">Total Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{activeTab === 'drafted' ? queue.length : '-'}</div>
                        <p className="text-[10px] text-stone-500 mt-1">Growth opportunities identified</p>
                    </CardContent>
                </Card>
                <Card className="glass-card border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-stone-400">Recovery Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">
                            {queue.filter(q => q.recovered_at).length}
                            <span className="text-xs text-stone-500 ml-1">Members</span>
                        </div>
                        <p className="text-[10px] text-stone-500 mt-1">Churn prevented this month</p>
                    </CardContent>
                </Card>
                <Card className="glass-card border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-stone-400">Autonomy Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-stone-100 flex items-center gap-2">
                            Level 3 <Badge className="bg-primary/20 text-primary border-none text-[8px] h-4">Beta</Badge>
                        </div>
                        <p className="text-[10px] text-stone-500 mt-1">Heartbeat scanning every 24h</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-stone-900 border border-stone-800 p-1">
                    <TabsTrigger value="drafted" className="data-[state=active]:bg-stone-800">
                        <Clock className="h-4 w-4 mr-2" /> Pending
                    </TabsTrigger>
                    <TabsTrigger value="sent" className="data-[state=active]:bg-stone-800">
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Sent
                    </TabsTrigger>
                    <TabsTrigger value="recovered" className="data-[state=active]:bg-stone-800">
                        <Sparkles className="h-4 w-4 mr-2" /> Recovered
                    </TabsTrigger>
                    <TabsTrigger value="cancelled" className="data-[state=active]:bg-stone-800">
                        <XCircle className="h-4 w-4 mr-2" /> Cancelled
                    </TabsTrigger>
                </TabsList>

                <Card className="glass-card mt-4">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-stone-800 text-[10px] uppercase tracking-wider text-stone-500 bg-stone-900/40">
                                        <th className="px-6 py-4 font-semibold">Member</th>
                                        <th className="px-6 py-4 font-semibold">Type</th>
                                        <th className="px-6 py-4 font-semibold">Message Preview</th>
                                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-800">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-stone-500">
                                                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 opacity-20" />
                                                Loading queue...
                                            </td>
                                        </tr>
                                    ) : queue.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-stone-500">
                                                No {activeTab} messages found.
                                            </td>
                                        </tr>
                                    ) : (
                                        queue.map((item) => (
                                            <tr key={item.id} className="hover:bg-stone-800/20 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-stone-200">{item.users?.name || 'Unknown'}</span>
                                                        <span className="text-[10px] text-stone-500">{item.users?.email}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs capitalize font-medium text-stone-300">
                                                            {item.type.replace('_', ' ')}
                                                        </span>
                                                        {item.metadata?.is_ai && (
                                                            <div className="flex flex-col gap-0.5">
                                                                <Badge variant="secondary" className="bg-primary/10 text-primary text-[8px] h-4 w-fit px-1 border-none">
                                                                    <Sparkles className="h-2 w-2 mr-1" /> AI Drafted
                                                                </Badge>
                                                                {item.confidence_score > 0 && (
                                                                    <span className="text-[8px] text-stone-500 ml-1">
                                                                        {(item.confidence_score * 100).toFixed(0)}% Confidence
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {item.is_auto_pilot && (
                                                            <Badge variant="secondary" className="bg-primary/10 text-primary text-[8px] h-4 w-fit px-1 border-none mt-1">
                                                                <Bot className="h-2 w-2 mr-1" /> Auto-Pilot
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-xs text-stone-400 max-w-md line-clamp-2 italic leading-relaxed">
                                                        "{item.message}"
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {activeTab === 'drafted' && (
                                                            <Button
                                                                size="sm"
                                                                className="h-8 px-3 bg-stone-100 text-stone-900 hover:bg-stone-200"
                                                                onClick={() => handleSend(item.id)}
                                                                disabled={sendingId === item.id}
                                                            >
                                                                {sendingId === item.id ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                                                                Send
                                                            </Button>
                                                        )}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-300">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="bg-stone-900 border-stone-800">
                                                                <DropdownMenuItem className="text-stone-300 gap-2 cursor-pointer">
                                                                    <Edit className="h-4 w-4" /> Edit Message
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="text-red-500 gap-2 cursor-pointer focus:text-red-400"
                                                                    onClick={() => handleCancel(item.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" /> Cancel Outreach
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    );
}
