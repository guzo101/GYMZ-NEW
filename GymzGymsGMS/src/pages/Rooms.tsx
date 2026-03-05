/* @ts-nocheck */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import {
    Search, Plus, Users, MessageSquare, Trash2, Edit, CheckCircle, XCircle,
    Send, UserMinus, Settings, Loader2
} from "lucide-react";
import { DataMapper } from "@/utils/dataMapper";



interface Room {
    id: string;
    name: string;
    category: string;
    description: string;
    admin_id: string;
    active: boolean;
    member_count?: number;
    created_at: string;
}

export default function Rooms() {
    const { user } = useAuth();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [showPostsDialog, setShowPostsDialog] = useState(false);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);

    // Members Dialog State
    const [showMembersDialog, setShowMembersDialog] = useState(false);
    const [roomMembers, setRoomMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Edit Room Dialog State
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editRoomData, setEditRoomData] = useState<Partial<Room>>({});
    const [isSavingRoom, setIsSavingRoom] = useState(false);


    useEffect(() => {
        if (user?.gymId) {
            fetchRooms();
        }
    }, [user?.gymId]);

    const fetchRooms = async () => {
        if (!user?.gymId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("rooms")
                .select(`
          *,
          room_members(count)
        `)
                .eq("gym_id", user.gymId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const formattedRooms = (data || []).map((l: any) => ({
                ...l,
                member_count: l.room_members?.[0]?.count || 0
            }));

            setRooms(formattedRooms);
        } catch (err: any) {
            toast.error("Failed to fetch rooms: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleRoomStatus = async (roomId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from("rooms")
                .update({ active: !currentStatus })
                .eq("id", roomId);

            if (error) throw error;
            toast.success(`Room ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
            fetchRooms();
        } catch (err: any) {
            toast.error("Failed to update room: " + err.message);
        }
    };

    const deleteRoom = async (roomId: string) => {
        if (!window.confirm("Are you sure you want to delete this room? This action cannot be undone.")) return;
        try {
            const { error } = await supabase
                .from("rooms")
                .delete()
                .eq("id", roomId);

            if (error) throw error;
            toast.success("Room deleted successfully");
            fetchRooms();
        } catch (err: any) {
            toast.error("Failed to delete room: " + err.message);
        }
    };

    const fetchRoomPosts = async (room: Room) => {
        console.log("Entering room:", room.name, "ID:", room.id);
        setSelectedRoom(room);
        setLoadingPosts(true);
        setShowPostsDialog(true);

        try {
            const { data, error } = await supabase
                .from("room_posts")
                .select(`
          *,
          users(name, avatar_url)
        `)
                .eq("room_id", room.id)
                .eq("gym_id", user.gymId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setPosts(DataMapper.fromDb(data || []));
        } catch (err: any) {
            toast.error("Failed to fetch posts: " + err.message);
        } finally {
            setLoadingPosts(false);
        }
    };

    const deletePost = async (postId: string) => {
        if (!window.confirm("Delete this post?")) return;
        try {
            const { error } = await supabase
                .from("room_posts")
                .delete()
                .eq("id", postId);

            if (error) throw error;
            toast.success("Post deleted");
            setPosts(prev => prev.filter(p => p.id !== postId));
        } catch (err: any) {
            toast.error("Failed to delete post: " + err.message);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedRoom || !user) return;

        setIsSending(true);
        try {
            const { data, error } = await supabase
                .from("room_posts")
                .insert([{
                    room_id: selectedRoom.id,
                    user_id: user.id,
                    gym_id: user.gymId,
                    content: newMessage.trim(),
                    type: 'text'
                }])
                .select(`
                    *,
                    users(name, avatar_url)
                `)
                .single();

            if (error) throw error;

            setPosts(prev => [DataMapper.fromDb(data), ...prev]);
            setNewMessage("");
            toast.success("Message sent");
        } catch (err: any) {
            toast.error("Failed to send message: " + err.message);
        } finally {
            setIsSending(false);
        }
    };

    const fetchRoomMembers = async (room: Room) => {
        setSelectedRoom(room);
        setLoadingMembers(true);
        setShowMembersDialog(true);
        try {
            const { data, error } = await supabase
                .from("room_members")
                .select(`
                    user_id,
                    joined_at,
                    users(name, avatar_url, email, role)
                `)
                .eq("room_id", room.id);

            if (error) throw error;
            setRoomMembers(data || []);
        } catch (err: any) {
            toast.error("Failed to fetch members: " + err.message);
        } finally {
            setLoadingMembers(false);
        }
    };

    const kickMember = async (userId: string) => {
        if (!selectedRoom || !window.confirm("Are you sure you want to kick this member?")) return;

        try {
            const { error } = await supabase
                .from("room_members")
                .delete()
                .eq("room_id", selectedRoom.id)
                .eq("user_id", userId);

            if (error) throw error;
            toast.success("Member kicked successfully");
            setRoomMembers(prev => prev.filter(m => m.user_id !== userId));
            fetchRooms(); // Update counts
        } catch (err: any) {
            toast.error("Failed to kick member: " + err.message);
        }
    };

    const openEditDialog = (room: Room) => {
        setEditRoomData(room);
        setShowEditDialog(true);
    };

    const handleUpdateRoom = async () => {
        if (!editRoomData.name || !editRoomData.id) return;

        setIsSavingRoom(true);
        try {
            const { error } = await supabase
                .from("rooms")
                .update({
                    name: editRoomData.name,
                    category: editRoomData.category,
                    description: editRoomData.description,
                    active: editRoomData.active
                })
                .eq("id", editRoomData.id);

            if (error) throw error;
            toast.success("Room updated successfully");
            setShowEditDialog(false);
            fetchRooms();
        } catch (err: any) {
            toast.error("Failed to update room: " + err.message);
        } finally {
            setIsSavingRoom(false);
        }
    };


    const filteredRooms = rooms.filter(l =>
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Rooms Management</h1>
                    <nav className="text-sm text-muted-foreground">
                        Home / Rooms
                    </nav>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                                placeholder="Search rooms..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50 transition-colors">
                                    <th className="h-12 px-4 text-left font-medium">Name</th>
                                    <th className="h-12 px-4 text-left font-medium">Category</th>
                                    <th className="h-12 px-4 text-left font-medium">Members</th>
                                    <th className="h-12 px-4 text-left font-medium">Status</th>
                                    <th className="h-12 px-4 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="h-24 text-center">Loading rooms...</td>
                                    </tr>
                                ) : filteredRooms.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="h-24 text-center">No rooms found.</td>
                                    </tr>
                                ) : (
                                    filteredRooms.map((room) => (
                                        <tr key={room.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td
                                                className="p-4 font-medium cursor-pointer hover:text-primary transition-colors"
                                                onClick={() => fetchRoomPosts(room)}
                                            >
                                                {room.name}
                                            </td>

                                            <td className="p-4">
                                                <Badge variant="outline">{room.category}</Badge>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1">
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                    {room.member_count}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <Badge variant={room.active ? "default" : "destructive"}>
                                                    {room.active ? "Active" : "Inactive"}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => fetchRoomPosts(room)}
                                                        title="Enter Room / View Posts"
                                                    >
                                                        <MessageSquare className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => fetchRoomMembers(room)}
                                                        title="Manage Members"
                                                    >
                                                        <Users className="h-4 w-4 text-primary" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEditDialog(room)}
                                                        title="Edit Room Settings"
                                                    >
                                                        <Settings className="h-4 w-4 text-gray-500" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => toggleRoomStatus(room.id, room.active)}
                                                        title={room.active ? "Deactivate" : "Activate"}
                                                    >
                                                        {room.active ? <XCircle className="h-4 w-4 text-orange-500" /> : <CheckCircle className="h-4 w-4 text-primary" />}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => deleteRoom(room.id)}
                                                        title="Delete Room"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
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

            {/* Posts Dialog (Enter Room) */}
            <Dialog open={showPostsDialog} onOpenChange={setShowPostsDialog}>
                <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b">
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            {selectedRoom?.name} - Interactive Room Access
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-6">
                        {loadingPosts ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground italic">
                                No activity in this room yet. Start the conversation!
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {posts.map((post) => (
                                    <div key={post.id} className="group relative flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex-shrink-0">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                                {post.users?.avatarUrl ? (
                                                    <img src={post.users.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                                                ) : (
                                                    (post.users?.name?.[0] || 'U').toUpperCase()
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span className="font-bold text-sm text-foreground">
                                                    {post.users?.name || "Member"}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                    {format(new Date(post.createdAt), "MMM d, h:mm a")}
                                                </span>
                                            </div>
                                            <div className="bg-muted/50 rounded-2xl p-4 text-sm leading-relaxed border border-border/40">
                                                {post.content}
                                            </div>
                                        </div>
                                        <button
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-destructive hover:bg-destructive/10 rounded-full h-fit mt-6"
                                            onClick={() => deletePost(post.id)}
                                            title="Moderate: Delete Post"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    <DialogFooter className="p-6 border-t bg-muted/20">
                        <div className="flex w-full gap-3">
                            <Input
                                placeholder="Type an announcement or message as Admin..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                className="flex-1 bg-background"
                            />
                            <Button
                                onClick={sendMessage}
                                disabled={isSending || !newMessage.trim()}
                                className="gap-2 shrink-0"
                            >
                                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Send
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Members Dialog */}
            <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Room Members: {selectedRoom?.name}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 pr-4">
                        {loadingMembers ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                        ) : roomMembers.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">No members yet.</div>
                        ) : (
                            <div className="space-y-2">
                                {roomMembers.map((member) => (
                                    <div key={member.user_id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                                {(member.users?.name?.[0] || 'U').toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold">{member.users?.name || "Unknown User"}</span>
                                                    {member.users?.role === 'admin' && <Badge className="text-[10px] h-4">Admin</Badge>}
                                                </div>
                                                <p className="text-xs text-muted-foreground">{member.users?.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground">Joined {format(new Date(member.joined_at), "MMM d, yyyy")}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                onClick={() => kickMember(member.user_id)}
                                                title="Kick Member"
                                            >
                                                <UserMinus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowMembersDialog(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Room Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Room Settings</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Room Name</label>
                            <Input
                                value={editRoomData.name || ""}
                                onChange={(e) => setEditRoomData({ ...editRoomData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Category</label>
                            <Input
                                value={editRoomData.category || ""}
                                onChange={(e) => setEditRoomData({ ...editRoomData, category: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <textarea
                                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={editRoomData.description || ""}
                                onChange={(e) => setEditRoomData({ ...editRoomData, description: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={editRoomData.active}
                                onChange={(e) => setEditRoomData({ ...editRoomData, active: e.target.checked })}
                                id="active_toggle"
                            />
                            <label htmlFor="active_toggle" className="text-sm font-medium">Active Status</label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                        <Button onClick={handleUpdateRoom} disabled={isSavingRoom}>
                            {isSavingRoom && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
