import { useEffect, useState } from "react";
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
    Plus,
    Globe,
    Shield,
    Activity,
    Edit,
    Building2,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
    Clock,
    Check,
    X,
    MoreVertical
} from "lucide-react";

interface Gym {
    id: string;
    name: string;
    location: string | null;
    status: string;
    subscription_plan: string;
    created_at: string;
    gym_unique_id: string | null;
}

interface GymApplication {
    id: string;
    gym_name: string;
    owner_name: string;
    email: string;
    phone: string | null;
    location: string | null;
    password?: string | null;
    status: 'pending' | 'approved' | 'rejected';
    feature_flags: any;
    created_at: string;
}

export default function PlatformAdmin() {
    const { user } = useAuth();
    const [gyms, setGyms] = useState<Gym[]>([]);
    const [applications, setApplications] = useState<GymApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGymDialogOpen, setIsGymDialogOpen] = useState(false);
    const [editingGym, setEditingGym] = useState<Partial<Gym> | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user?.role === "platform_admin") {
            fetchData();
        }
    }, [user?.role]);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchGyms(), fetchApplications()]);
        setLoading(false);
    };

    const fetchApplications = async () => {
        try {
            const { data, error } = await supabase
                .from("gym_applications")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setApplications(data || []);
        } catch (err: any) {
            console.error("Failed to fetch applications:", err);
        }
    };

    const fetchGyms = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("gyms")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setGyms(data || []);
        } catch (err: any) {
            toast.error("Failed to fetch gyms: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGym = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingGym?.id) {
                const { error } = await supabase.from("gyms").update(editingGym).eq("id", editingGym.id);
                if (error) throw error;
                toast.success("Gym updated");
            } else {
                const { error } = await supabase.from("gyms").insert([editingGym]);
                if (error) throw error;
                toast.success("New gym added to registry");
            }
            setIsGymDialogOpen(false);
            fetchData();
        } catch (err: any) {
            toast.error("Error saving gym: " + err.message);
        } finally {
            setSaving(false);
        }
    };



    if (user?.role !== "platform_admin") {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <Shield className="h-16 w-16 text-red-500/20" />
                <h2 className="text-2xl font-bold">Access Denied</h2>
                <p className="text-muted-foreground max-w-md">
                    This area is restricted to platform administrators only. Please contact system support if you believe this is an error.
                </p>
                <Button onClick={() => window.history.back()}>Go Back</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Platform Administration</h1>
                    <p className="text-muted-foreground">Global oversight of gym tenants, system health, and configurations.</p>
                </div>
                <Button onClick={() => { setEditingGym({ status: 'active', subscription_plan: 'pro' }); setIsGymDialogOpen(true); }} className="gap-2">
                    <Plus className="h-4 w-4" /> Add New Gym
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
                <Card className="bg-sidebar-accent/40 border-sidebar-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Gyms</CardTitle>
                        <Globe className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{gyms.length}</div>
                        <p className="text-xs text-muted-foreground">Registered tenants</p>
                    </CardContent>
                </Card>
                <Card className="bg-sidebar-accent/40 border-sidebar-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending Apps</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-500">{applications.filter(a => a.status === 'pending').length}</div>
                        <p className="text-xs text-muted-foreground">Awaiting review</p>
                    </CardContent>
                </Card>
                <Card className="bg-sidebar-accent/40 border-sidebar-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">System Health</CardTitle>
                        <Activity className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">Normal</div>
                        <p className="text-xs text-muted-foreground">All services operational</p>
                    </CardContent>
                </Card>
                <Card className="bg-sidebar-accent/40 border-sidebar-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{gyms.filter(g => g.status === 'active').length}</div>
                        <p className="text-xs text-muted-foreground">Paid & active gyms</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="registry" className="w-full">
                <TabsList className="bg-sidebar-accent/30 border-sidebar-border/50 p-1 mb-6">
                    <TabsTrigger value="registry" className="gap-2 data-[state=active]:bg-[#2A4B2A] data-[state=active]:text-white">
                        <Building2 className="h-4 w-4" /> Gym Registry
                    </TabsTrigger>
                    <TabsTrigger value="applications" className="gap-2 data-[state=active]:bg-[#2A4B2A] data-[state=active]:text-white">
                        <Clock className="h-4 w-4" /> Review Queue
                        {applications.filter(a => a.status === 'pending').length > 0 && (
                            <Badge className="bg-yellow-500 text-black ml-1 h-5 w-5 p-0 justify-center">
                                {applications.filter(a => a.status === 'pending').length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="registry">
                    <Card className="border-sidebar-border/50 bg-sidebar-accent/20 backdrop-blur-sm shadow-modern overflow-hidden">
                        <CardHeader className="border-b border-sidebar-border/50 flex flex-row items-center justify-between">
                            <CardTitle>Gym Registry</CardTitle>
                            <Button onClick={() => { setEditingGym({ status: 'active', subscription_plan: 'pro' }); setIsGymDialogOpen(true); }} size="sm" className="gap-2">
                                <Plus className="h-4 w-4" /> Add Gym
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="py-20 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-sidebar-accent/50">
                                        <TableRow className="border-sidebar-border/50">
                                            <TableHead>Gym Name</TableHead>
                                            <TableHead>Unique ID</TableHead>
                                            <TableHead>Plan</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {gyms.map((g) => (
                                            <TableRow key={g.id} className="border-sidebar-border/50 hover:bg-sidebar-accent/30 transition-colors">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                                        <div>
                                                            <p className="text-foreground">{g.name}</p>
                                                            <p className="text-[10px] text-muted-foreground">{g.location || "No address"}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {g.gym_unique_id || "GZ-XXXXX"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">{g.subscription_plan}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={g.status === 'active' ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}>
                                                        {g.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => { setEditingGym(g); setIsGymDialogOpen(true); }}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="applications">
                    <Card className="border-sidebar-border/50 bg-sidebar-accent/20 backdrop-blur-sm shadow-modern overflow-hidden">
                        <CardHeader className="border-b border-sidebar-border/50">
                            <CardTitle>Application Review Queue</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="py-20 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-sidebar-accent/50">
                                        <TableRow className="border-sidebar-border/50">
                                            <TableHead>Gym / Owner</TableHead>
                                            <TableHead>Contact Info</TableHead>
                                            <TableHead>Applied On</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Decision</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {applications.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="py-20 text-center text-muted-foreground">
                                                    No gym applications found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            applications.map((app) => (
                                                <TableRow key={app.id} className="border-sidebar-border/50 hover:bg-sidebar-accent/30 transition-colors">
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium text-foreground">{app.gym_name}</p>
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <User className="h-3 w-3" /> {app.owner_name}
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <p className="text-xs text-foreground">{app.email}</p>
                                                        <p className="text-[10px] text-muted-foreground">{app.phone || "No phone"}</p>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {new Date(app.created_at).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={
                                                            app.status === 'approved' ? "bg-green-500/10 text-green-500" :
                                                                app.status === 'rejected' ? "bg-red-500/10 text-red-500" :
                                                                    "bg-yellow-500/10 text-yellow-500"
                                                        }>
                                                            {app.status.toUpperCase()}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {app.status === 'pending' && (
                                                            <Badge variant="outline" className="text-yellow-500 border-yellow-500/20">
                                                                Pending Review in OAC
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isGymDialogOpen} onOpenChange={setIsGymDialogOpen}>
                <DialogContent className="bg-sidebar-background border-sidebar-border/50">
                    <DialogHeader><DialogTitle>{editingGym?.id ? "Edit Gym Profile" : "Register New Gym"}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSaveGym} className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Gym Name</Label>
                            <Input required value={editingGym?.name || ""} onChange={(e) => setEditingGym({ ...editingGym, name: e.target.value })} className="bg-sidebar-accent/50" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Location</Label>
                            <Input value={editingGym?.location || ""} onChange={(e) => setEditingGym({ ...editingGym, location: e.target.value })} className="bg-sidebar-accent/50" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Plan</Label>
                                <select className="flex h-10 w-full rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-sm" value={editingGym?.subscription_plan || "pro"} onChange={(e) => setEditingGym({ ...editingGym, subscription_plan: e.target.value })}>
                                    <option value="basic">Basic</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Status</Label>
                                <select className="flex h-10 w-full rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-sm" value={editingGym?.status || "active"} onChange={(e) => setEditingGym({ ...editingGym, status: e.target.value })}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Gym Details"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

        </div>
    );
}
