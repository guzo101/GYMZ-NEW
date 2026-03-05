import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Search,
    Users,
    Mail,
    MoreVertical,
    Tag,
    ArrowUpCircle,
    Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DataMapper } from "@/utils/dataMapper";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface CRMUser {
    id: string;
    name: string;
    email: string;
    crmTag: string | null;
    accessMode: string;
    createdAt: string;
    membershipStatus: string;
}

export default function OutdoorCRM() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<CRMUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUser, setSelectedUser] = useState<CRMUser | null>(null);
    const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
    const [newTag, setNewTag] = useState("");

    useEffect(() => {
        if (currentUser?.gymId) {
            fetchCRMUsers();
        }
    }, [currentUser?.gymId]);

    const fetchCRMUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("users")
                .select("id, name, email, crm_tag, access_mode, created_at, membership_status")
                .eq("gym_id", currentUser?.gymId || (currentUser as any)?.gym_id)
                .eq("access_mode", "event_access")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setUsers(DataMapper.fromDb<CRMUser[]>(data || []));
        } catch (err: any) {
            toast.error("Failed to fetch CRM users: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateTag = async () => {
        if (!selectedUser) return;
        try {
            const { error } = await supabase
                .from("users")
                .update({ crm_tag: newTag })
                .eq("id", selectedUser.id);

            if (error) throw error;
            toast.success("CRM Tag updated");
            setIsTagDialogOpen(false);
            fetchCRMUsers();
        } catch (err: any) {
            toast.error("Failed to update tag: " + err.message);
        }
    };

    const filteredUsers = users.filter((u) =>
        (u.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.crmTag || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <Users className="h-8 w-8 text-secondary animate-pulse" />
                        Outdoor <span className="text-primary">CRM</span>
                    </h1>
                    <p className="text-muted-foreground/80 font-medium italic mt-1.5">Identify and engage event-only users to drive gym memberships.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2 border-sidebar-border/50">
                        <Mail className="h-4 w-4" />
                        Bulk Outreach
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
                <Card className="bg-sidebar-accent/40 border-sidebar-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-primary uppercase tracking-widest">Leads</CardTitle>
                        <Users className="h-4 w-4 text-secondary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-white">{users.length}</div>
                        <p className="text-xs text-muted-foreground">Event Access only</p>
                    </CardContent>
                </Card>
                <Card className="bg-sidebar-accent/40 border-sidebar-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Cold Leads</CardTitle>
                        <Tag className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{users.filter(u => u.crmTag === 'cold').length}</div>
                        <p className="text-xs text-muted-foreground">No recent activity</p>
                    </CardContent>
                </Card>
                <Card className="bg-sidebar-accent/40 border-sidebar-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Hot Leads</CardTitle>
                        <ArrowUpCircle className="h-4 w-4 text-red-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{users.filter(u => u.crmTag === 'hot').length}</div>
                        <p className="text-xs text-muted-foreground">Ready for upgrade</p>
                    </CardContent>
                </Card>
                <Card className="bg-sidebar-accent/40 border-sidebar-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle>
                        <Badge className="bg-green-500/10 text-green-500">Goal</Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">---</div>
                        <p className="text-xs text-muted-foreground">Upgrade conversion</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-sidebar-border/50 bg-sidebar-accent/20 backdrop-blur-sm shadow-modern overflow-hidden">
                <CardHeader className="border-b border-sidebar-border/50 pb-4 bg-sidebar-accent/5">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                            <Tag className="h-5 w-5 text-secondary" />
                            Lead <span className="text-primary">Registry</span>
                        </CardTitle>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search leads or tags..."
                                className="pl-9 bg-sidebar-accent/50 border-sidebar-border/50"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-20 flex justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="py-20 text-center">
                            <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-foreground">No leads found</h3>
                            <p className="text-muted-foreground">You don't have any users on the "Event Access" tier yet.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-sidebar-accent/50 text-muted-foreground">
                                <TableRow className="border-sidebar-border/50 hover:bg-transparent">
                                    <TableHead>User</TableHead>
                                    <TableHead>Join Date</TableHead>
                                    <TableHead>CRM Tag</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((u) => (
                                    <TableRow key={u.id} className="border-sidebar-border/50 hover:bg-sidebar-accent/30 transition-colors group">
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span className="text-foreground">{u.name || "Unnamed User"}</span>
                                                <span className="text-xs text-muted-foreground">{u.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {format(new Date(u.createdAt), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            {u.crmTag ? (
                                                <Badge variant="outline" className={`capitalize ${u.crmTag === 'hot' ? 'border-red-500/50 text-red-500' :
                                                    u.crmTag === 'cold' ? 'border-blue-500/50 text-blue-500' : ''
                                                    }`}>
                                                    {u.crmTag}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">No tag</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="bg-primary/10 text-primary border-primary/20">
                                                {u.membershipStatus}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-sidebar-accent border-sidebar-border/50">
                                                    <DropdownMenuItem
                                                        className="gap-2 cursor-pointer"
                                                        onClick={() => {
                                                            setSelectedUser(u);
                                                            setNewTag(u.crmTag || "");
                                                            setIsTagDialogOpen(true);
                                                        }}
                                                    >
                                                        <Tag className="h-4 w-4" /> Manage Tag
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2 cursor-pointer">
                                                        <Mail className="h-4 w-4" /> Send Invite
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

            <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-sidebar-background border-sidebar-border/50">
                    <DialogHeader>
                        <DialogTitle>Update CRM Tag</DialogTitle>
                        <DialogDescription>
                            Assign a category to this lead for targeted outreach.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="tag">Tag Value</Label>
                            <Input
                                id="tag"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value.toLowerCase())}
                                placeholder="e.g. hot, cold, following-up"
                                className="bg-sidebar-accent/50 border-sidebar-border"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsTagDialogOpen(false)}>Cancel</Button>
                        <Button onClick={updateTag}>Save changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
