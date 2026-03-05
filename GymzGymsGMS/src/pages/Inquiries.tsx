import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Mail,
    Phone,
    User,
    Calendar,
    Search,
    RefreshCw,
    CheckCircle2,
    Clock,
    XCircle,
    MoreVertical,
    MessageSquare,
    ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Inquiries() {
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("all");

    useEffect(() => {
        fetchInquiries();
    }, []);

    async function fetchInquiries() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("website_inquiries")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setInquiries(data || []);
        } catch (error: any) {
            console.error("Error fetching inquiries:", error);
            toast.error("Failed to load inquiries");
        } finally {
            setLoading(false);
        }
    }

    const updateInquiryStatus = async (id: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from("website_inquiries")
                .update({ status: newStatus })
                .eq("id", id);

            if (error) throw error;
            toast.success(`Inquiry marked as ${newStatus}`);
            fetchInquiries();
        } catch (error: any) {
            toast.error("Failed to update status");
        }
    };

    const filteredInquiries = inquiries.filter(item => {
        const matchesSearch =
            item.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.message?.toLowerCase().includes(searchTerm.toLowerCase());

        if (activeTab === "all") return matchesSearch;
        return matchesSearch && item.status === activeTab;
    });

    const getStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'new': return <Badge className="bg-primary/10 text-primary border-primary/20">New</Badge>;
            case 'read': return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Read</Badge>;
            case 'replied': return <Badge className="bg-primary/10 text-primary border-primary/20">Replied</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-stone-100 flex items-center gap-2">
                        <Mail className="h-8 w-8 text-primary" /> Support Inquiries
                    </h1>
                    <p className="text-stone-400 mt-1">Manage support requests from the App and Website.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => fetchInquiries()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
                    <Input
                        placeholder="Search by name, email or message..."
                        className="pl-10 bg-stone-900 border-stone-800"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                    <TabsList className="bg-stone-900 border border-stone-800">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="new">New</TabsTrigger>
                        <TabsTrigger value="read">Read</TabsTrigger>
                        <TabsTrigger value="replied">Replied</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <Card className="glass-card border-stone-800/40">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-stone-800 text-[10px] uppercase tracking-wider text-stone-500 bg-stone-900/40">
                                    <th className="px-6 py-4 font-semibold">Sender</th>
                                    <th className="px-6 py-4 font-semibold">Source / Type</th>
                                    <th className="px-6 py-4 font-semibold">Message</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                    <th className="px-6 py-4 font-semibold">Date</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
                                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 opacity-20" />
                                            Loading inquiries...
                                        </td>
                                    </tr>
                                ) : filteredInquiries.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
                                            No inquiries found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInquiries.map((item) => (
                                        <tr key={item.id} className="hover:bg-stone-800/20 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-stone-200">{item.full_name || 'Anonymous'}</span>
                                                    <span className="text-[10px] text-stone-500 flex items-center gap-1">
                                                        <Mail className="h-3 w-3" /> {item.email}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="outline" className={`text-[10px] h-5 w-fit ${item.source === 'app_support' ? 'border-primary/50 text-primary bg-primary/5' : 'border-stone-500/50 text-stone-400 bg-stone-500/5'
                                                        }`}>
                                                        {item.source === 'app_support' ? 'App Support' : 'Website'}
                                                    </Badge>
                                                    <span className="text-[10px] text-stone-500 italic">
                                                        {item.interest || 'General'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-xs text-stone-300 max-w-sm line-clamp-2 leading-relaxed">
                                                    {item.message}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(item.status)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] text-stone-500">
                                                    {format(new Date(item.created_at), "MMM d, HH:mm")}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-300">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-stone-900 border-stone-800">
                                                        <DropdownMenuItem
                                                            className="text-stone-300 gap-2 cursor-pointer"
                                                            onClick={() => updateInquiryStatus(item.id, 'read')}
                                                        >
                                                            <Clock className="h-4 w-4" /> Mark as Read
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-stone-300 gap-2 cursor-pointer"
                                                            onClick={() => updateInquiryStatus(item.id, 'replied')}
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" /> Mark as Replied
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-stone-300 gap-2 cursor-pointer focus:bg-stone-800"
                                                            onClick={() => window.location.href = `mailto:${item.email}?subject=Re: Gymz Support Inquiry`}
                                                        >
                                                            <ExternalLink className="h-4 w-4" /> Reply via Email
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-red-500 gap-2 cursor-pointer focus:text-red-400 focus:bg-red-500/10"
                                                            onSelect={async () => {
                                                                if (confirm("Are you sure you want to delete this inquiry?")) {
                                                                    const { error } = await supabase.from('website_inquiries').delete().eq('id', item.id);
                                                                    if (error) toast.error("Delete failed");
                                                                    else {
                                                                        toast.success("Inquiry deleted");
                                                                        fetchInquiries();
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <XCircle className="h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
