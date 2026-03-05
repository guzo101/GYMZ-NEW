import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
    Plus,
    Ticket,
    Search,
    Edit,
    Trash2,
    Calendar,
    MapPin,
    Users,
    MoreVertical,
    CheckCircle2,
    Bell,
    Send,
    ImagePlus,
    X,
    Zap,
    ArrowUpRight,
    MapPinned,
    Clock3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Badge } from "@/components/ui/badge";
import { notifyEventAnnouncement } from "@/lib/notifications";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

interface Event {
    id: string;
    title: string;
    description: string;
    location: string;
    event_date: string;
    end_date: string | null;
    capacity: number | null;
    rsvp_count: number;
    image_url: string | null;
    is_active: boolean;
    gym_id: string;
    is_free: boolean;
    price: number | null;
    created_at: string;
}

export default function Events() {
    const { user } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isAnnounceDialogOpen, setIsAnnounceDialogOpen] = useState(false);
    const [announcementMsg, setAnnouncementMsg] = useState("");
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [announcing, setAnnouncing] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // datetime-local string pick e.g. "2026-02-21T14:00"
    const [eventDateTime, setEventDateTime] = useState("");

    useEffect(() => {
        if (user?.gymId || (user as any)?.gym_id) fetchEvents();
    }, [user?.gymId, (user as any)?.gym_id]);

    const fetchEvents = async () => {
        const gymId = user?.gymId || (user as any)?.gym_id;

        if (!gymId || gymId === "undefined") {
            console.warn("[fetchEvents] Missing gym identification. Skipping fetch.");
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("events")
                .select("*")
                .eq("gym_id", gymId)
                .order("event_date", { ascending: true });
            if (error) throw error;
            setEvents(data || []);
        } catch (err: any) {
            toast.error("Failed to fetch events: " + err.message);
        } finally {
            setLoading(false);
        }
    };


    const openCreateDialog = () => {
        const gymId = user?.gymId || (user as any)?.gym_id;
        if (!gymId) {
            toast.error("Your account is not associated with a gym. Please contact support.");
            return;
        }
        setEditingEvent({ is_active: true, gym_id: gymId, is_free: true, price: null });
        setEventDateTime("");
        setIsDialogOpen(true);
    };

    const openEditDialog = (event: Event) => {
        setEditingEvent(event);
        if (event.event_date) {
            setEventDateTime(new Date(event.event_date).toISOString());
        } else {
            setEventDateTime("");
        }
        setIsDialogOpen(true);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const gymId = user?.gymId || (user as any)?.gym_id || editingEvent?.gym_id;

        if (!file) return;

        if (!gymId) {
            toast.error("Gym association missing. Cannot upload image.");
            return;
        }

        setUploadingImage(true);
        try {
            const ext = file.name.split(".").pop();
            const path = `events/${gymId}/${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from("gym-images")
                .upload(path, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from("gym-images").getPublicUrl(path);
            setEditingEvent((prev) => ({ ...prev, image_url: data.publicUrl }));
            toast.success("Image uploaded successfully");
        } catch (err: any) {
            console.error("[ImageUpload] Error:", err);
            toast.error("Upload failed: " + err.message);
        } finally {
            setUploadingImage(false);
        }
    };


    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Final sanity check for gymId
        const gymId = user?.gymId || (user as any)?.gym_id || editingEvent?.gym_id;

        if (!gymId) {
            toast.error("Gym reference missing. Please refresh and try again.");
            return;
        }

        if (!editingEvent?.title) {
            toast.error("Event title is required.");
            return;
        }

        if (!eventDateTime) {
            toast.error("Please pick a date & time for the event.");
            return;
        }

        setSaving(true);
        try {
            const eventData = {
                title: editingEvent.title,
                description: editingEvent.description || null,
                location: editingEvent.location || null,
                event_date: new Date(eventDateTime).toISOString(),
                end_date: editingEvent.end_date || null,
                capacity: editingEvent.capacity || null,
                image_url: editingEvent.image_url || null,
                is_active: editingEvent.is_active ?? true,
                gym_id: gymId,
                is_free: editingEvent.is_free ?? true,
                price: editingEvent.is_free ? null : (editingEvent.price ?? null),
            };

            if (editingEvent.id) {
                const { error } = await supabase
                    .from("events")
                    .update(eventData)
                    .eq("id", editingEvent.id);
                if (error) throw error;
                toast.success("Event updated successfully");
            } else {
                const { error } = await supabase
                    .from("events")
                    .insert([eventData]);

                if (error) {
                    console.error("[CreateEvent] DB Error:", error);
                    throw error;
                }
                toast.success("Event created successfully!");
            }

            setIsDialogOpen(false);
            setEditingEvent(null);
            fetchEvents();
        } catch (err: any) {
            console.error("[CreateEvent] Catch Block:", err);
            toast.error("Failed to save event: " + (err.details || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this event? This cannot be undone.")) return;
        try {
            const { error } = await supabase.from("events").delete().eq("id", id);
            if (error) throw error;
            toast.success("Event deleted");
            fetchEvents();
        } catch (err: any) {
            toast.error("Delete failed: " + err.message);
        }
    };

    const handleSendAnnouncement = async () => {
        if (!selectedEventId || !announcementMsg.trim()) return;
        setAnnouncing(true);
        try {
            const { data: attendees, error } = await supabase
                .from("event_rsvps")
                .select("user_id")
                .eq("event_id", selectedEventId)
                .in("status", ["confirmed", "waitlisted"]);

            if (error) throw error;

            if (!attendees?.length) {
                toast.info("No attendees found to notify.");
                setIsAnnounceDialogOpen(false);
                return;
            }

            const userIds = attendees.map((a) => a.user_id);
            await notifyEventAnnouncement({
                event_id: selectedEventId,
                user_ids: userIds,
                message: announcementMsg
            });

            toast.success(`Announcement sent to ${userIds.length} attendees`);
            setIsAnnounceDialogOpen(false);
            setAnnouncementMsg("");
        } catch (err: any) {
            toast.error("Announcement failed: " + err.message);
        } finally {
            setAnnouncing(false);
        }
    };

    const toggleActive = async (id: string, current: boolean) => {
        try {
            const { error } = await supabase
                .from("events")
                .update({ is_active: !current })
                .eq("id", id);
            if (error) throw error;
            fetchEvents();
        } catch (err: any) {
            toast.error("Toggle status failed: " + err.message);
        }
    };

    const filtered = events.filter(
        (e) =>
            e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Header / Top Panel */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-sidebar-accent/10 p-6 rounded-2xl border border-sidebar-border/30 backdrop-blur-md">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <Zap className="h-8 w-8 text-secondary animate-pulse" />
                        Event <span className="text-primary">Management</span>
                    </h1>
                    <p className="text-muted-foreground/80 font-medium">Create and manage your gym's community calendar & experiences.</p>
                </div>
                <Button
                    onClick={openCreateDialog}
                    className="gap-2 h-12 px-6 text-base font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(76,175,80,0.2)] bg-primary hover:bg-primary/90 text-white"
                >
                    <Plus className="h-5 w-5" /> Create Event
                </Button>
            </div>

            {/* Premium Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatsCard
                    title="Upcoming"
                    value={events.filter(e => new Date(e.event_date) >= new Date()).length}
                    subtitle="Total scheduled"
                    icon={Calendar}
                    trend="neutral"
                />
                <StatsCard
                    title="Total Sign-ups"
                    value={events.reduce((a, c) => a + (c.rsvp_count || 0), 0)}
                    subtitle="Active registrations"
                    icon={Users}
                    trend="up"
                />
                <StatsCard
                    title="Live Events"
                    value={events.filter(e => e.is_active).length}
                    subtitle="Publicly visible"
                    icon={Zap}
                    trend="up"
                />
            </div>

            {/* Main Registry Card */}
            <Card className="border-sidebar-border/40 bg-sidebar-background/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-sidebar-border/30 px-6 py-5 bg-sidebar-accent/5">
                    <div className="flex items-center justify-between flex-wrap gap-6">
                        <div className="space-y-0.5">
                            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                                <Ticket className="h-5 w-5 text-secondary" />
                                Event <span className="text-primary">Registry</span>
                            </CardTitle>
                            <p className="text-xs text-muted-foreground/70">Manage ongoing and upcoming schedules</p>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Filter by title or location..."
                                className="pl-11 h-11 bg-sidebar-accent/30 border-sidebar-border/40 focus:border-primary/50 transition-all rounded-xl"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-32 flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                            <p className="text-sm text-muted-foreground animate-pulse">Syncing events...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-32 text-center space-y-4">
                            <div className="bg-sidebar-accent/30 h-20 w-20 rounded-full flex items-center justify-center mx-auto border border-sidebar-border/30">
                                <Ticket className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-white">No entries found</h3>
                                <p className="text-muted-foreground text-sm max-w-[250px] mx-auto">Either refine your filter or create your first event to get started.</p>
                            </div>
                            <Button variant="outline" onClick={openCreateDialog} className="border-primary/30 text-primary hover:bg-primary/10">
                                <Plus className="h-4 w-4 mr-2" /> Start Now
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-sidebar-accent/40 border-b border-sidebar-border/30">
                                    <TableRow className="border-none hover:bg-transparent">
                                        <TableHead className="px-6 h-14 font-bold text-primary uppercase text-[10px] tracking-widest">Event Detail</TableHead>
                                        <TableHead className="h-14 font-bold text-primary uppercase text-[10px] tracking-widest">Admission</TableHead>
                                        <TableHead className="h-14 font-bold text-primary uppercase text-[10px] tracking-widest">Timing</TableHead>
                                        <TableHead className="h-14 font-bold text-primary uppercase text-[10px] tracking-widest">Venue</TableHead>
                                        <TableHead className="h-14 font-bold text-primary uppercase text-[10px] tracking-widest text-center">Sign-ups</TableHead>
                                        <TableHead className="h-14 font-bold text-primary uppercase text-[10px] tracking-widest">Visibility</TableHead>
                                        <TableHead className="h-14 text-right pr-6 font-bold text-primary uppercase text-[10px] tracking-widest">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((event) => (
                                        <TableRow key={event.id} className="border-b border-sidebar-border/20 hover:bg-sidebar-accent/20 transition-all group">
                                            <TableCell className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-20 rounded-xl overflow-hidden flex-shrink-0 bg-sidebar-accent/40 border border-sidebar-border/30 flex items-center justify-center shadow-inner relative group-hover:scale-105 transition-transform">
                                                        {event.image_url ? (
                                                            <img src={event.image_url} className="h-full w-full object-cover" alt="" />
                                                        ) : (
                                                            <div className="bg-sidebar-background w-full h-full flex items-center justify-center">
                                                                <Ticket className="h-5 w-5 text-muted-foreground/20" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <div className="font-bold text-white leading-tight group-hover:text-primary transition-colors">{event.title}</div>
                                                        <div className="text-xs text-muted-foreground truncate max-w-[220px] font-medium italic opacity-70">
                                                            {event.description || "No description provided"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {event.is_free !== false ? (
                                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/40 text-[10px] font-black uppercase">FREE</Badge>
                                                ) : (
                                                    <span className="text-sm font-bold text-primary">K{Number(event.price || 0).toLocaleString()}</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                                                        <Calendar className="h-3.5 w-3.5 text-primary" />
                                                        {format(new Date(event.event_date), "MMM d, yyyy")}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] font-bold text-secondary pl-5 uppercase">
                                                        <Clock3 className="h-3 w-3" />
                                                        {format(new Date(event.event_date), "HH:mm")}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-sidebar-accent/30 px-3 py-1.5 rounded-full border border-sidebar-border/30 w-fit">
                                                    <MapPinned className="h-3.5 w-3.5 text-blue-400" />
                                                    {event.location || "Default Venue"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <div className="text-sm font-black text-secondary">{event.rsvp_count || 0}</div>
                                                    <div className="text-[9px] font-bold uppercase text-muted-foreground px-2 py-0.5 rounded-md bg-sidebar-accent/50 border border-sidebar-border/20">
                                                        / {event.capacity || "∞"} spots
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Switch
                                                        checked={event.is_active}
                                                        onCheckedChange={() => toggleActive(event.id, event.is_active)}
                                                        className="data-[state=checked]:bg-primary"
                                                    />
                                                    <Badge className={event.is_active ? "bg-green-500/10 text-green-500 border-green-500/20 text-[10px] font-bold" : "bg-muted/50 text-muted-foreground border-muted-foreground/20 text-[10px] font-bold"}>
                                                        {event.is_active ? "PUBLIC" : "DRAFT"}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-sidebar-accent rounded-xl"><MoreVertical className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-sidebar-background border-sidebar-border/50 min-w-[160px] p-2 rounded-xl shadow-2xl">
                                                        <DropdownMenuItem className="gap-3 cursor-pointer py-2.5 rounded-lg focus:bg-primary/10 focus:text-primary transition-colors" onClick={() => openEditDialog(event)}>
                                                            <Edit className="h-4 w-4" /> <span className="font-bold">Edit Details</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="gap-3 cursor-pointer py-2.5 rounded-lg focus:bg-primary/10 focus:text-primary transition-colors" onClick={() => { setSelectedEventId(event.id); setIsAnnounceDialogOpen(true); }}>
                                                            <Bell className="h-4 w-4" /> <span className="font-bold">Announce</span>
                                                        </DropdownMenuItem>
                                                        <div className="h-px bg-sidebar-border/30 my-2" />
                                                        <DropdownMenuItem className="gap-3 text-red-500 focus:text-red-500 cursor-pointer py-2.5 rounded-lg focus:bg-red-500/10 transition-colors" onClick={() => handleDelete(event.id)}>
                                                            <Trash2 className="h-4 w-4" /> <span className="font-bold">Remove Event</span>
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

            {/* ─────────────────────────────────────────────── */}
            {/* Create / Edit Dialog — Premium Dark Design     */}
            {/* ─────────────────────────────────────────────── */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="p-0 overflow-hidden border-0 sm:max-w-[580px] rounded-3xl" style={{ background: "#0D110D", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 40px 100px rgba(0,0,0,0.8)" }}>

                    {/* Branding Bar */}
                    <div className="relative h-2.5 w-full flex">
                        <div className="flex-1 bg-primary/80" />
                        <div className="w-24 bg-primary" />
                        <div className="w-12 bg-yellow-500" />
                    </div>

                    <div className="px-6 pt-5 pb-1">

                        <DialogHeader>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="h-12 w-12 rounded-2xl flex items-center justify-center transform rotate-3" style={{ background: "#1A221A", border: "1px solid rgba(76,175,80,0.2)" }}>
                                    <Zap className="h-6 w-6 text-primary" />
                                </div>
                                <div className="space-y-0.5">
                                    <DialogTitle className="text-2xl font-bold text-white">
                                        {editingEvent?.id ? "Update " : "Craft "}<span className="text-primary">Experience</span>
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold text-secondary/80 tracking-wider uppercase">
                                        Gym Access & Community Calendar Sync
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <form onSubmit={handleSave}>
                        <div className="px-6 flex flex-col gap-5 py-5" style={{ maxHeight: "calc(90vh - 180px)", overflowY: "auto" }}>


                            {/* Event Banner Image Selection */}
                            <div className="space-y-2.5">
                                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Visual Identity</Label>
                                <div
                                    onClick={() => !uploadingImage && imageInputRef.current?.click()}
                                    className={`relative group cursor-pointer rounded-2xl overflow-hidden flex flex-col items-center justify-center transition-all duration-300 border-2 border-dashed ${editingEvent?.image_url ? 'border-transparent' : 'border-sidebar-border/40 hover:border-primary/40 bg-sidebar-accent/10'}`}
                                    style={{ height: "160px" }}
                                >
                                    {editingEvent?.image_url ? (
                                        <>
                                            <img src={editingEvent.image_url} className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-110" alt="Preview" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2">
                                                <div className="p-3 bg-white/10 backdrop-blur-md rounded-full">
                                                    <Edit className="h-6 w-6 text-white" />
                                                </div>
                                                <span className="text-white text-xs font-bold uppercase tracking-widest">Replace Art</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(ev) => { ev.stopPropagation(); setEditingEvent((p) => ({ ...p, image_url: null })); }}
                                                className="absolute top-3 right-3 rounded-full p-2 bg-black/40 hover:bg-red-500/80 transition-colors backdrop-blur-md border border-white/10"
                                            >
                                                <X className="h-4 w-4 text-white" />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="text-center space-y-3">
                                            {uploadingImage ? (
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Uploading Art...</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="p-4 bg-primary/5 rounded-full inline-block border border-primary/10">
                                                        <ImagePlus className="h-8 w-8 text-primary/60" />
                                                    </div>
                                                    <p className="text-xs font-bold text-muted-foreground">Upload Experience Banner</p>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </div>

                            {/* Core Info Group */}
                            <div className="grid gap-5">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Event Headline</Label>
                                    <Input
                                        required
                                        value={editingEvent?.title || ""}
                                        onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                                        placeholder="e.g. MORNING VELOCITY SPRINT"
                                        className="h-12 bg-[#141A14] border-sidebar-border/40 rounded-xl px-4 font-bold text-white placeholder:text-muted-foreground/30 focus:border-primary/50"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Launch Time</Label>
                                        <DateTimePicker
                                            value={eventDateTime}
                                            onChange={setEventDateTime}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Max Spots</Label>
                                        <div className="relative">
                                            <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none z-10" />
                                            <Input
                                                type="number"
                                                min={1}
                                                value={editingEvent?.capacity || ""}
                                                onChange={(e) => setEditingEvent({ ...editingEvent, capacity: parseInt(e.target.value) || null })}
                                                placeholder="UNLIMITED"
                                                className="h-12 bg-[#141A14] border-sidebar-border/40 rounded-xl pl-12 pr-4 font-bold text-white focus:border-primary/50 uppercase"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Admission: Free or Paid */}
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Admission</Label>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex items-center gap-3">
                                            <Switch
                                                checked={editingEvent?.is_free !== false}
                                                onCheckedChange={(checked) => setEditingEvent({ ...editingEvent, is_free: checked, price: checked ? null : (editingEvent?.price ?? 0) })}
                                                className="data-[state=checked]:bg-primary"
                                            />
                                            <span className="text-sm font-bold text-white">{editingEvent?.is_free !== false ? "Free" : "Paid"}</span>
                                        </div>
                                        {editingEvent?.is_free === false && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">Price (Kwacha):</span>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={0.01}
                                                    value={editingEvent?.price ?? ""}
                                                    onChange={(e) => setEditingEvent({ ...editingEvent, price: parseFloat(e.target.value) || 0 })}
                                                    placeholder="0"
                                                    className="h-10 w-28 bg-[#141A14] border-sidebar-border/40 rounded-xl px-3 font-bold text-primary"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Mission Location</Label>
                                    <div className="relative">
                                        <MapPinned className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none z-10" />
                                        <Input
                                            value={editingEvent?.location || ""}
                                            onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                                            placeholder="STUDIO A / CROSSFIT ZONE / ZOOM"
                                            className="h-12 bg-[#141A14] border-sidebar-border/40 rounded-xl pl-12 pr-4 font-bold text-white focus:border-primary/50 uppercase"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Mission Brief (Description)</Label>
                                    <Textarea
                                        rows={4}
                                        value={editingEvent?.description || ""}
                                        onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                                        placeholder="Outline the goals, session flow, and requirements for attendees..."
                                        className="bg-[#141A14] border-sidebar-border/40 rounded-xl p-4 font-medium text-white placeholder:text-muted-foreground/30 focus:border-primary/50 resize-none min-h-[100px]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action Footer */}
                        <div className="px-6 py-5 bg-[#090C09] flex items-center justify-between gap-4 border-t border-white/5">

                            <button
                                type="button"
                                onClick={() => setIsDialogOpen(false)}
                                className="px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
                            >
                                ABORT
                            </button>
                            <Button
                                type="submit"
                                disabled={saving}
                                className="h-14 px-10 rounded-2xl text-sm font-bold uppercase tracking-widest shadow-[0_10px_30px_rgba(76,175,80,0.3)] hover:scale-[1.03] active:scale-[0.98] transition-all"
                            >
                                {saving ? "Processing..." : editingEvent?.id ? "Sync Changes" : "Deploy Event"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Announcement Dialog — Premium Version */}
            <Dialog open={isAnnounceDialogOpen} onOpenChange={setIsAnnounceDialogOpen}>
                <DialogContent className="p-0 overflow-hidden border-0 sm:max-w-[440px] rounded-3xl" style={{ background: "#0D110D", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 40px 100px rgba(0,0,0,0.8)" }}>
                    <div className="h-2 w-full bg-gradient-to-r from-primary via-yellow-400 to-primary" />
                    <div className="p-8 space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-sidebar-accent/30 border border-primary/20">
                                <Bell className="h-6 w-6 text-primary" />
                            </div>
                            <div className="space-y-0.5">
                                <h2 className="text-xl font-bold text-white uppercase tracking-tight">Deploy <span className="text-primary">Broadcast</span></h2>
                                <p className="text-[10px] font-bold text-secondary/80 uppercase tracking-widest">Instant Push Notification to Attendees</p>
                            </div>
                        </div>
                        <Textarea
                            rows={5}
                            value={announcementMsg}
                            onChange={(e) => setAnnouncementMsg(e.target.value)}
                            placeholder="Message to signed-up members..."
                            className="bg-[#141A14] border-sidebar-border/40 rounded-2xl p-4 font-bold text-white placeholder:text-muted-foreground/30 focus:border-primary/50 resize-none"
                        />
                        <div className="flex gap-4 pt-2">
                            <Button
                                variant="ghost"
                                onClick={() => setIsAnnounceDialogOpen(false)}
                                className="flex-1 h-12 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground hover:bg-white/5"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSendAnnouncement}
                                disabled={announcing || !announcementMsg.trim()}
                                className="flex-1 h-12 rounded-xl text-xs font-bold uppercase tracking-widest shadow-[0_10px_20px_rgba(76,175,80,0.2)]"
                            >
                                {announcing ? "Transmitting..." : (
                                    <span className="flex items-center gap-2">
                                        <Send className="h-4 w-4" /> Send Now
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
