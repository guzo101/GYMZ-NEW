import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ShieldAlert, RefreshCw, Search, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { DataMapper } from "@/utils/dataMapper";

export default function LimitedAccessLogs() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // Fetch logs joined with users
            // Note: Supabase JS join syntax depends on foreign keys.
            // Assuming limited_access_logs.user_id references auth.users which is joined to public.users via id usually.
            // But standard way is to fetch logs and then fetch users or use RPC.
            // Or use .select("*, users:user_id(name, email, membership_status)") if FK exists to public.users.
            // The migration had: REFERENCES auth.users(id).
            // public.users usually references auth.users(id) too.
            // Let's try fetching logs first, then users for those IDs.

            const { data: logData, error: logError } = await supabase
                .from("limited_access_logs")
                .select("*")
                .order("accessed_at", { ascending: false });

            if (logError) throw logError;

            if (!logData || logData.length === 0) {
                setLogs([]);
                setLoading(false);
                return;
            }

            // Fetch user details for these logs
            const userIds = [...new Set(logData.map((l: any) => l.user_id))];
            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("id, name, email, avatar_url")
                .in("id", userIds);

            if (userError) throw userError;

            const userMap = new Map();
            userData?.forEach((u: any) => userMap.set(u.id, u));

            const combinedData = logData.map((log: any) => ({
                ...DataMapper.fromDb(log),
                user: DataMapper.fromDb(userMap.get(log.user_id)) || { name: 'Unknown User', email: '' }
            }));

            setLogs(combinedData);
        } catch (err) {
            console.error("Error fetching logs:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [user]);

    const filteredLogs = logs.filter(log =>
        log.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Limited Access Logs</h1>
                    <p className="text-muted-foreground">Monitor members accessing the app with expired memberships</p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-xl font-medium">Access History</CardTitle>
                    <div className="flex items-center gap-2">
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search member..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={fetchLogs}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <div className="grid grid-cols-12 gap-4 border-b bg-muted/50 p-4 text-sm font-medium">
                            <div className="col-span-3">Timestamp</div>
                            <div className="col-span-4">Member</div>
                            <div className="col-span-3">Status at Access</div>
                            <div className="col-span-2 text-right">Action</div>
                        </div>

                        {loading ? (
                            <div className="p-8 text-center text-muted-foreground">Loading logs...</div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">No records found</div>
                        ) : (
                            <div className="max-h-[600px] overflow-y-auto">
                                {filteredLogs.map((log) => (
                                    <div key={log.id} className="grid grid-cols-12 gap-4 border-b p-4 text-sm items-center hover:bg-muted/30 transition-colors">
                                        <div className="col-span-3 font-mono text-xs text-muted-foreground">
                                            {format(new Date(log.accessedAt), "MMM d, yyyy h:mm a")}
                                        </div>
                                        <div className="col-span-4 flex flex-col">
                                            <span className="font-medium">{log.user?.name}</span>
                                            <span className="text-xs text-muted-foreground">{log.user?.email}</span>
                                        </div>
                                        <div className="col-span-3">
                                            <Badge variant={log.membershipStatus === 'Active' ? 'default' : 'destructive'} className="capitalize">
                                                {log.membershipStatus || 'Unknown'}
                                            </Badge>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-50">
                                                Limited Access
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="mt-4 text-xs text-muted-foreground text-center">
                        Showing {filteredLogs.length} records
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
