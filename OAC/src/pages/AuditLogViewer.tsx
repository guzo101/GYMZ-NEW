import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export default function AuditLogViewer() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('admin_audit_logs')
            .select(`
        *,
        gyms ( name )
      `)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error("Error fetching audit logs:", error);
        } else {
            setLogs(DataMapper.fromDb(data || []));
        }
        setLoading(false);
    };

    const filteredLogs = logs.filter(l =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        (l.actorEmail && l.actorEmail.toLowerCase().includes(search.toLowerCase())) ||
        (l.gyms?.name && l.gyms.name.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-mesh-glow text-white p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-muted-foreground hover:text-white">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">System Audit Logs</h1>
                        <p className="text-muted-foreground mt-1">Immutable record of all platform admin actions.</p>
                    </div>
                </div>

                <Card className="glass-card border-white/5 shadow-2xl rounded-2xl">
                    <CardHeader className="pb-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
                                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                        <History className="h-6 w-6" />
                                    </div>
                                    Action History
                                </CardTitle>
                                <CardDescription className="text-zinc-500 mt-1 ml-11">Immutable record of all platform admin actions</CardDescription>
                            </div>
                            <div className="relative w-full md:w-96 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search by action, gym, or email..."
                                    className="pl-12 bg-black/40 border-white/5 focus:border-primary/50 text-white rounded-xl h-12 shadow-inner"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-3">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                <span>Securing transaction logs...</span>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="text-xs text-zinc-500 uppercase tracking-widest bg-white/5 border-y border-white/5">
                                            <th className="px-6 py-5 font-bold first:rounded-tl-xl">Timestamp</th>
                                            <th className="px-6 py-5 font-bold">Action</th>
                                            <th className="px-6 py-5 font-bold">Actor</th>
                                            <th className="px-6 py-5 font-bold">Gym Context</th>
                                            <th className="px-6 py-5 font-bold last:rounded-tr-xl">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-white/5 transition-all group">
                                                <td className="px-6 py-5 whitespace-nowrap text-zinc-400 group-hover:text-white transition-colors">
                                                    {format(new Date(log.createdAt), 'MMM dd, HH:mm:ss')}
                                                </td>
                                                <td className="px-6 py-5 font-mono text-primary font-bold group-hover:scale-[1.02] origin-left transition-transform inline-block mt-5">
                                                    {log.action}
                                                </td>
                                                <td className="px-6 py-5 text-zinc-300">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-white">{log.actorEmail || 'System'}</span>
                                                        <span className="text-[10px] text-zinc-600 font-mono">{log.actorId?.split('-')[0]}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 font-bold text-white">{log.gyms?.name || '-'}</td>
                                                <td className="px-6 py-5">
                                                    <div className="max-w-xs truncate text-zinc-500 italic bg-black/20 px-3 py-1.5 rounded-lg border border-white/5" title={log.reason || 'Manual administrative action'}>
                                                        {log.reason || 'Manual administrative action'}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredLogs.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                                    No audit logs found matching your search parameters.
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
        </div>
    );
}
