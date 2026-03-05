import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    ClipboardList,
    Users,
    Search,
    CheckCircle2,
    Clock,
    XCircle,
    MoreVertical,
    Ticket,
    ScanLine,
    Filter,
    RefreshCw,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { StatsCard } from "@/components/StatsCard";
import { QRScanner } from "@/admin/checkin/components/QRScanner";
import { verifyEventRSVP } from "@/admin/checkin/api/eventCheckIn";
import { DataMapper } from "@/utils/dataMapper";

interface GymEvent {
    id: string;
    title: string;
    event_date: string;
    capacity: number | null;
    rsvp_count: number;
}

interface RSVPEntry {
    id: string;
    eventId: string;
    userId: string;
    status: "confirmed" | "waitlisted" | "cancelled";
    checkedIn: boolean;
    checkInTime: string | null;
    createdAt: string;
    userName: string | null;
    userEmail: string | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
    confirmed: {
        label: "Confirmed",
        className: "bg-green-500/10 text-green-400 border-green-500/20",
    },
    waitlisted: {
        label: "Waitlisted",
        className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    },
    cancelled: {
        label: "Cancelled",
        className: "bg-red-500/10 text-red-400 border-red-500/20",
    },
};

export default function EventRSVPManagement() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const [events, setEvents] = useState<GymEvent[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>("");
    const [rsvps, setRSVPs] = useState<RSVPEntry[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [loadingRSVPs, setLoadingRSVPs] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [attendedFilter, setAttendedFilter] = useState<string>("all");
    const [processing, setProcessing] = useState<string | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanStatus, setScanStatus] = useState<{
        status: "approved" | "rejected" | "verifying";
        message: string;
    } | null>(null);

    useEffect(() => {
        if (user?.gymId) fetchEvents();
    }, [user?.gymId]);

    useEffect(() => {
        if (selectedEventId) fetchRSVPs(selectedEventId);
    }, [selectedEventId]);

    const fetchEvents = async () => {
        setLoadingEvents(true);
        try {
            const { data, error } = await supabase
                .from("events")
                .select("id, title, event_date, capacity, rsvp_count")
                .eq("gym_id", user?.gymId)
                .order("event_date", { ascending: false });
            if (error) throw error;
            const list = data || [];
            setEvents(list);
            const eventIdFromUrl = searchParams.get("eventId");
            const eventExists = eventIdFromUrl && list.some((e) => e.id === eventIdFromUrl);
            if (list.length > 0) {
                setSelectedEventId(eventExists ? eventIdFromUrl! : list[0].id);
            }
        } catch (err: any) {
            toast.error("Failed to load events: " + err.message);
        } finally {
            setLoadingEvents(false);
        }
    };

    const fetchRSVPs = async (eventId: string) => {
        setLoadingRSVPs(true);
        try {
            const { data, error } = await supabase
                .from("event_rsvps")
                .select("id, event_id, user_id, status, checked_in, check_in_time, created_at")
                .eq("event_id", eventId)
                .order("created_at", { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                setRSVPs([]);
                return;
            }

            // Fetch user names and emails
            const userIds = [...new Set(data.map((r) => r.user_id))];
            const { data: usersData } = await supabase
                .from("users")
                .select("id, name, email")
                .in("id", userIds);

            const userMap: Record<string, { name: string; email: string }> = {};
            (usersData || []).forEach((u) => {
                userMap[u.id] = { name: u.name, email: u.email };
            });

            setRSVPs(
                DataMapper.fromDb<RSVPEntry[]>(data.map((r) => ({
                    ...r,
                    status: r.status as RSVPEntry["status"],
                    checked_in: r.checked_in ?? false,
                    check_in_time: r.check_in_time ?? null,
                    user_name: userMap[r.user_id]?.name ?? null,
                    user_email: userMap[r.user_id]?.email ?? null,
                })))
            );
        } catch (err: any) {
            toast.error("Failed to load sign-ups: " + err.message);
        } finally {
            setLoadingRSVPs(false);
        }
    };

    const handleCheckIn = async (rsvpId: string, current: boolean) => {
        setProcessing(rsvpId);
        try {
            const { error } = await supabase
                .from("event_rsvps")
                .update({
                    checked_in: !current,
                    check_in_time: !current ? new Date().toISOString() : null,
                })
                .eq("id", rsvpId);
            if (error) throw error;
            toast.success(current ? "Check-in removed" : "Member checked in ✓");
            fetchRSVPs(selectedEventId);
        } catch (err: any) {
            toast.error("Failed: " + err.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleStatusChange = async (rsvpId: string, newStatus: string) => {
        setProcessing(rsvpId);
        try {
            const { error } = await supabase
                .from("event_rsvps")
                .update({ status: newStatus })
                .eq("id", rsvpId);
            if (error) throw error;
            toast.success("Status updated");
            fetchRSVPs(selectedEventId);
        } catch (err: any) {
            toast.error("Failed: " + err.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleQRScan = async (decodedText: string) => {
        if (!selectedEventId) return;

        setScanStatus({ status: "verifying", message: "Verifying sign-up..." });

        try {
            const result = await verifyEventRSVP(decodedText, selectedEventId);

            setScanStatus({
                status: result.status,
                message: result.message
            });

            if (result.status === "approved") {
                toast.success(result.message);
                fetchRSVPs(selectedEventId);
            } else {
                toast.error(result.message);
            }
        } catch (err: any) {
            setScanStatus({ status: "rejected", message: err.message });
            toast.error("Scan error: " + err.message);
        } finally {
            // Auto-clear status after 3s
            setTimeout(() => setScanStatus(null), 3000);
        }
    };

    const selectedEvent = events.find((e) => e.id === selectedEventId);
    const confirmed = rsvps.filter((r) => r.status === "confirmed").length;
    const waitlisted = rsvps.filter((r) => r.status === "waitlisted").length;
    const checkedIn = rsvps.filter((r) => r.checkedIn).length;
    const capacity = selectedEvent?.capacity ?? null;

    const filtered = rsvps.filter((r) => {
        const matchSearch =
            (r.userName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.userEmail || "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === "all" || r.status === statusFilter;
        const matchAttended =
            attendedFilter === "all" ||
            (attendedFilter === "scanned" && r.checkedIn) ||
            (attendedFilter === "not_scanned" && !r.checkedIn);
        return matchSearch && matchStatus && matchAttended;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-sidebar-accent/10 p-6 rounded-2xl border border-sidebar-border/30 backdrop-blur-md">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <ClipboardList className="h-8 w-8 text-secondary animate-pulse" />
                        Sign-up <span className="text-primary">Management</span>
                    </h1>
                    <p className="text-muted-foreground font-medium">
                        Track attendees, manage registrations, and check-in members on event day.
                    </p>
                </div>
                {/* Event Selector */}
                <div className="min-w-[280px]">
                    {loadingEvents ? (
                        <div className="h-12 bg-sidebar-accent/30 animate-pulse rounded-xl" />
                    ) : (
                        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                            <SelectTrigger className="h-12 bg-sidebar-accent/30 border-sidebar-border/50 text-white rounded-xl font-bold text-sm">
                                <SelectValue placeholder="Select an event…" />
                            </SelectTrigger>
                            <SelectContent className="bg-sidebar-background border-sidebar-border/50">
                                {events.map((ev) => (
                                    <SelectItem key={ev.id} value={ev.id}>
                                        <span className="font-bold">{ev.title}</span>
                                        <span className="text-muted-foreground ml-2 text-xs">
                                            {format(new Date(ev.event_date), "MMM d, yyyy")}
                                        </span>
                                    </SelectItem>
                                ))}
                                {events.length === 0 && (
                                    <SelectItem value="none" disabled>
                                        No events found
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Confirmed"
                    value={confirmed}
                    subtitle="Final registrations"
                    icon={CheckCircle2}
                    trend="up"
                />
                <StatsCard
                    title="Waitlisted"
                    value={waitlisted}
                    subtitle="In queue"
                    icon={Clock}
                    trend="neutral"
                />
                <StatsCard
                    title="Checked In"
                    value={checkedIn}
                    subtitle="On-day attendance"
                    icon={ScanLine}
                    trend="up"
                />
                <StatsCard
                    title="Fill Rate"
                    value={capacity ? `${Math.round((confirmed / capacity) * 100)}%` : "∞"}
                    subtitle={capacity ? `of ${capacity} cap` : "No cap set"}
                    icon={Ticket}
                    trend="neutral"
                />
            </div>

            {/* Sign-ups Table */}
            <Card className="border-sidebar-border/40 bg-sidebar-background/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-sidebar-border/30 px-6 py-5 bg-sidebar-accent/5">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                            <Users className="h-5 w-5 text-secondary" />
                            Attendee <span className="text-primary">Registry</span>
                            {selectedEvent && (
                                <Badge className="ml-2 bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                                    {selectedEvent.title}
                                </Badge>
                            )}
                        </CardTitle>
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Status filter */}
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-10 w-36 bg-sidebar-accent/30 border-sidebar-border/40 rounded-xl text-xs font-bold">
                                    <Filter className="h-3.5 w-3.5 mr-1" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-sidebar-background border-sidebar-border/50">
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="confirmed">Confirmed</SelectItem>
                                    <SelectItem value="waitlisted">Waitlisted</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={attendedFilter} onValueChange={setAttendedFilter}>
                                <SelectTrigger className="h-10 w-40 bg-sidebar-accent/30 border-sidebar-border/40 rounded-xl text-xs font-bold">
                                    <ScanLine className="h-3.5 w-3.5 mr-1" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-sidebar-background border-sidebar-border/50">
                                    <SelectItem value="all">All Attendees</SelectItem>
                                    <SelectItem value="scanned">Scanned / Attended</SelectItem>
                                    <SelectItem value="not_scanned">Not Yet Scanned</SelectItem>
                                </SelectContent>
                            </Select>
                            {/* Analytics Toggle */}
                            <Button
                                onClick={() => setIsScannerOpen(true)}
                                className="h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold flex items-center gap-2"
                                disabled={!selectedEventId}
                            >
                                <ScanLine className="h-4 w-4" />
                                Scan QR
                            </Button>
                            {/* Search */}
                            <div className="relative w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or email…"
                                    className="pl-11 h-10 bg-sidebar-accent/30 border-sidebar-border/40 rounded-xl text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            {/* Refresh */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl hover:bg-sidebar-accent"
                                onClick={() => selectedEventId && fetchRSVPs(selectedEventId)}
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {!selectedEventId ? (
                        <div className="py-32 text-center space-y-3">
                            <Ticket className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                            <p className="text-muted-foreground">Select an event to view sign-ups.</p>
                        </div>
                    ) : loadingRSVPs ? (
                        <div className="py-32 flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                            <p className="text-sm text-muted-foreground animate-pulse">Loading attendees…</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-32 text-center space-y-3">
                            <Users className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                            <h3 className="text-lg font-bold text-white">No attendees found</h3>
                            <p className="text-muted-foreground text-sm">
                                {rsvps.length === 0
                                    ? "No one has signed up for this event yet."
                                    : "No results match your current filters."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-sidebar-accent/40 border-b border-sidebar-border/30">
                                    <TableRow className="border-none hover:bg-transparent">
                                        <TableHead className="px-6 h-14 font-bold text-primary uppercase text-[10px] tracking-widest">Member</TableHead>
                                        <TableHead className="h-14 font-bold text-primary uppercase text-[10px] tracking-widest">Status</TableHead>
                                        <TableHead className="h-14 font-bold text-primary uppercase text-[10px] tracking-widest">Check-In</TableHead>
                                        <TableHead className="h-14 font-bold text-primary uppercase text-[10px] tracking-widest">Scanned at</TableHead>
                                        <TableHead className="h-14 font-bold text-primary uppercase text-[10px] tracking-widest">Signed up at</TableHead>
                                        <TableHead className="h-14 text-right pr-6 font-bold text-primary uppercase text-[10px] tracking-widest">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((rsvp) => (
                                        <TableRow
                                            key={rsvp.id}
                                            className="border-b border-sidebar-border/20 hover:bg-sidebar-accent/20 transition-all group"
                                        >
                                            <TableCell className="px-6 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-white text-sm group-hover:text-primary transition-colors">
                                                        {rsvp.userName || "Unknown Member"}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {rsvp.userEmail || "—"}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] font-bold px-2.5 py-0.5 ${statusConfig[rsvp.status]?.className ?? ""}`}
                                                >
                                                    {statusConfig[rsvp.status]?.label ?? rsvp.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <button
                                                    onClick={() => handleCheckIn(rsvp.id, rsvp.checkedIn)}
                                                    disabled={processing === rsvp.id}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${rsvp.checkedIn
                                                        ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                                                        : "bg-sidebar-accent/30 text-muted-foreground border-sidebar-border/30 hover:bg-primary/10 hover:text-primary hover:border-primary/20"
                                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                >
                                                    {rsvp.checkedIn ? (
                                                        <><CheckCircle2 className="h-3.5 w-3.5" /> Present</>
                                                    ) : (
                                                        <><XCircle className="h-3.5 w-3.5" /> Not In</>
                                                    )}
                                                </button>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {rsvp.checkedIn && rsvp.checkInTime
                                                    ? format(new Date(rsvp.checkInTime), "MMM d, HH:mm")
                                                    : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {format(new Date(rsvp.createdAt), "MMM d, yyyy HH:mm")}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 hover:bg-sidebar-accent rounded-xl"
                                                            disabled={processing === rsvp.id}
                                                        >
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="end"
                                                        className="bg-sidebar-background border-sidebar-border/50 min-w-[160px] p-2 rounded-xl shadow-2xl"
                                                    >
                                                        <DropdownMenuItem
                                                            className="gap-3 cursor-pointer py-2.5 rounded-lg focus:bg-green-500/10 focus:text-green-400"
                                                            onClick={() => handleStatusChange(rsvp.id, "confirmed")}
                                                        >
                                                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                                                            <span className="font-bold">Confirm</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="gap-3 cursor-pointer py-2.5 rounded-lg focus:bg-yellow-500/10 focus:text-yellow-400"
                                                            onClick={() => handleStatusChange(rsvp.id, "waitlisted")}
                                                        >
                                                            <Clock className="h-4 w-4 text-yellow-400" />
                                                            <span className="font-bold">Waitlist</span>
                                                        </DropdownMenuItem>
                                                        <div className="h-px bg-sidebar-border/30 my-1" />
                                                        <DropdownMenuItem
                                                            className="gap-3 cursor-pointer py-2.5 rounded-lg focus:bg-red-500/10 focus:text-red-400 text-red-400"
                                                            onClick={() => handleStatusChange(rsvp.id, "cancelled")}
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                            <span className="font-bold">Cancel sign-up</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* QR Scanner Dialog */}
            <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                <DialogContent className="sm:max-w-md bg-sidebar-background border-sidebar-border/50">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Ticket className="h-5 w-5 text-primary" />
                            Event Check-in
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Scanning for: <span className="text-white font-bold">{selectedEvent?.title}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <QRScanner
                            onScan={handleQRScan}
                            onClose={() => setIsScannerOpen(false)}
                            lastResult={scanStatus}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
