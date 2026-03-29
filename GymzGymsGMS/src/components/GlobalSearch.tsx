import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Search,
    Users,
    UserCheck,
    Calendar,
    Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
    id: string;
    title: string;
    subtitle: string;
    type: "member" | "staff" | "event" | "inquiry";
    url: string;
}

export function GlobalSearch({
    query,
    setQuery,
    open,
    setOpen
}: {
    query: string;
    setQuery: (q: string) => void;
    open: boolean;
    setOpen: (o: boolean) => void;
}) {
    const [results, setResults] = useState<{
        members: SearchResult[];
        staff: SearchResult[];
        events: SearchResult[];
        inquiries: SearchResult[];
    }>({
        members: [],
        staff: [],
        events: [],
        inquiries: [],
    });
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // Check if the click was on the search input itself (to avoid immediate closing)
                const searchInput = document.getElementById("header-search-input");
                if (searchInput && searchInput.contains(event.target as Node)) return;

                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setOpen]);

    // Debounced search logic
    useEffect(() => {
        if (!query.trim() || query.length < 2) {
            setResults({ members: [], staff: [], events: [], inquiries: [] });
            if (query.length === 0) setOpen(false);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const gymId = user?.gymId || (user as any)?.gym_id;
                if (!gymId) return;

                const [membersRes, staffRes, eventsRes, inquiriesRes] = await Promise.all([
                    supabase
                        .from("users")
                        .select("id, name, email, unique_id")
                        .eq("role", "member")
                        .eq("gym_id", gymId)
                        .or(`name.ilike.%${query}%,email.ilike.%${query}%,unique_id.ilike.%${query}%`)
                        .limit(5),
                    supabase
                        .from("staff")
                        .select("id, name, email, role, department")
                        .eq("gym_id", gymId)
                        .or(`name.ilike.%${query}%,email.ilike.%${query}%,role.ilike.%${query}%,department.ilike.%${query}%`)
                        .limit(5),
                    supabase
                        .from("events")
                        .select("id, title, location")
                        .eq("gym_id", gymId)
                        .or(`title.ilike.%${query}%,location.ilike.%${query}%`)
                        .limit(5),
                    supabase
                        .from("website_inquiries")
                        .select("id, full_name, email, message")
                        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,message.ilike.%${query}%`)
                        .limit(5),
                ]);

                const isStaff = user?.role === "staff";
                const membersPath = isStaff ? "/staff/members" : "/members";
                const staffPath = "/staff";
                const eventsPath = "/admin/events";
                const inquiriesPath = "/admin/inquiries";

                setResults({
                    members: (membersRes.data || []).map((m: any) => ({
                        id: m.id,
                        title: m.name || m.email || "Unknown Member",
                        subtitle: `${m.unique_id ? `#${m.unique_id} • ` : ""}${m.email || ""}`,
                        type: "member",
                        url: `${membersPath}?id=${m.id}&highlight=1`,
                    })),
                    staff: (staffRes.data || []).map((s: any) => ({
                        id: s.id,
                        title: s.name,
                        subtitle: `${s.role || ""} ${s.department ? `(${s.department})` : ""}`,
                        type: "staff",
                        url: `${staffPath}?id=${s.id}&highlight=1`,
                    })),
                    events: (eventsRes.data || []).map((e: any) => ({
                        id: e.id,
                        title: e.title,
                        subtitle: e.location || "No location",
                        type: "event",
                        url: `${eventsPath}?id=${e.id}&highlight=1`,
                    })),
                    inquiries: (inquiriesRes.data || []).map((i: any) => ({
                        id: i.id,
                        title: i.full_name || "Anonymous Inquiry",
                        subtitle: i.email || "No email",
                        type: "inquiry",
                        url: `${inquiriesPath}?id=${i.id}&highlight=1`,
                    })),
                });
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, user?.gymId, (user as any)?.gym_id, setOpen]);

    const onSelect = useCallback((url: string) => {
        setOpen(false);
        navigate(url);
    }, [navigate, setOpen]);

    if (!open || (!query.trim() && !loading)) return null;

    return (
        <div
            ref={containerRef}
            className="absolute top-full left-0 right-0 mt-2 z-50 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl animate-in fade-in slide-in-from-top-2 w-[400px] max-w-[90vw]"
        >
            <Command className="border-none">
                <CommandList className="max-h-[350px]">
                    <CommandEmpty>
                        {loading ? "Searching..." : "No results found."}
                    </CommandEmpty>

                    {results.members.length > 0 && (
                        <CommandGroup heading="Members">
                            {results.members.map((res) => (
                                <CommandItem
                                    key={res.id}
                                    onSelect={() => onSelect(res.url)}
                                    className="flex items-center gap-3 p-3 cursor-pointer"
                                >
                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <UserCheck className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{res.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">{res.subtitle}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">Member</Badge>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {results.staff.length > 0 && (
                        <CommandGroup heading="Staff">
                            {results.staff.map((res) => (
                                <CommandItem
                                    key={res.id}
                                    onSelect={() => onSelect(res.url)}
                                    className="flex items-center gap-3 p-3 cursor-pointer"
                                >
                                    <div className="h-9 w-9 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                                        <Users className="h-5 w-5 text-secondary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{res.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">{res.subtitle}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">Staff</Badge>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {results.events.length > 0 && (
                        <CommandGroup heading="Events">
                            {results.events.map((res) => (
                                <CommandItem
                                    key={res.id}
                                    onSelect={() => onSelect(res.url)}
                                    className="flex items-center gap-3 p-3 cursor-pointer"
                                >
                                    <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                        <Calendar className="h-5 w-5 text-amber-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{res.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">{res.subtitle}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">Event</Badge>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {results.inquiries.length > 0 && (
                        <CommandGroup heading="Inquiries">
                            {results.inquiries.map((res) => (
                                <CommandItem
                                    key={res.id}
                                    onSelect={() => onSelect(res.url)}
                                    className="flex items-center gap-3 p-3 cursor-pointer"
                                >
                                    <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                        <Mail className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{res.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">{res.subtitle}</p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">Inquiry</Badge>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    <CommandSeparator />

                    <CommandGroup heading="Quick Actions">
                        <CommandItem onSelect={() => onSelect(user?.role === "staff" ? "/staff/members" : "/members")} className="cursor-pointer">
                            <UserCheck className="mr-2 h-4 w-4" />
                            <span>Manage All Members</span>
                        </CommandItem>
                        <CommandItem onSelect={() => onSelect("/staff")} className="cursor-pointer">
                            <Users className="mr-2 h-4 w-4" />
                            <span>View Staff Directory</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
                <div className="p-3 border-t bg-muted/30 flex items-center justify-between text-[9px] uppercase tracking-widest font-bold text-muted-foreground/60">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><kbd className="rounded bg-background px-1 border tracking-normal">ESC</kbd> close</span>
                        <span className="flex items-center gap-1"><kbd className="rounded bg-background px-1 border tracking-normal">↵</kbd> select</span>
                    </div>
                    <div className="flex items-center gap-1 text-primary animate-pulse">
                        <Search className="h-3 w-3" />
                        LIVE SEARCH
                    </div>
                </div>
            </Command>
        </div>
    );
}
