import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon, MapPin, Clock, Trophy, Flame, Activity, ArrowRight, CheckCircle2, LogOut, Timer } from "lucide-react";
import { format, isToday, differenceInDays, differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { DataMapper } from "@/utils/dataMapper";
import {
    getCurrentSession,
    getAttendanceHistory,
    calculateStreak,
    getWeeklyCount,
    checkOut,
    type AttendanceSession,
} from "@/services/attendanceService";

interface UserProfile {
    id: string;
    name: string;
    avatarUrl: string | null;
    membershipStatus: string;
}

export default function MemberAttendance() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [attendanceHistory, setAttendanceHistory] = useState<AttendanceSession[]>([]);
    const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
    const [sessionDuration, setSessionDuration] = useState<number>(0);
    const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
    const [checkoutData, setCheckoutData] = useState({
        notes: "",
        effortLevel: 3,
        focusArea: "strength",
    });
    const [stats, setStats] = useState({
        streak: 0,
        totalSessions: 0,
        thisWeek: 0,
        averageDuration: 0,
    });

    // Timer for active session
    useEffect(() => {
        if (!activeSession) return;

        const interval = setInterval(() => {
            const duration = differenceInMinutes(new Date(), new Date(activeSession.checkInTime));
            setSessionDuration(duration);
        }, 1000);

        return () => clearInterval(interval);
    }, [activeSession]);

    const fetchData = async () => {
        if (!user) return;

        try {
            setLoading(true);

            // Fetch Profile
            const { data: profileData } = await supabase
                .from("users")
                .select("id, name, avatar_url, membership_status")
                .eq("id", user.id)
                .single();

            if (profileData) {
                setProfile(DataMapper.fromDb<UserProfile>(profileData));
            }

            // Fetch current active session
            const currentSession = await getCurrentSession(user.id);
            setActiveSession(currentSession);

            // Fetch Attendance History
            const history = await getAttendanceHistory(user.id, 30);
            setAttendanceHistory(history);

            // Calculate Stats
            const streak = await calculateStreak(user.id);
            const weeklyCount = await getWeeklyCount(user.id);
            const totalSessions = history.filter(s => s.status === "session_confirmed").length;
            const avgDuration = history.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0) / (totalSessions || 1);

            setStats({
                streak,
                totalSessions,
                thisWeek: weeklyCount,
                averageDuration: Math.round(avgDuration),
            });
        } catch (err) {
            console.error("Error fetching data:", err);
            toast.error("Failed to load attendance data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    // Subscribe to real-time attendance updates
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`attendance-${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "attendance",
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [user]);

    const handleCheckOut = async () => {
        if (!activeSession) return;

        try {
            const result = await checkOut(
                activeSession.id,
                checkoutData.notes || undefined,
                checkoutData.effortLevel,
                checkoutData.focusArea
            );

            if (result.success) {
                toast.success(result.message);
                setCheckoutDialogOpen(false);
                setActiveSession(null);
                fetchData();
            } else {
                toast.error(result.message);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to check out");
        }
    };

    const initials = useMemo(() => {
        if (!profile?.name) return "U";
        return profile.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    }, [profile?.name]);

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "session_confirmed":
                return <Badge className="bg-primary">Confirmed</Badge>;
            case "checked_in":
                return <Badge className="bg-primary">In Progress</Badge>;
            case "short_session":
                return <Badge variant="secondary">Short Session</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getReinforcementMessage = () => {
        if (stats.totalSessions === 0) {
            return "You're building the habit.";
        }
        if (stats.streak >= 7) {
            return "Momentum is forming. Keep going!";
        }
        if (stats.thisWeek >= 3) {
            return "Consistency is key. You're doing great!";
        }
        return "Welcome back. That matters.";
    };

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* 1. Header & Profile Summary */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-primary">
                        <AvatarImage src={profile?.avatarUrl || undefined} />
                        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-bold">{profile?.name || "Member"}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant={profile?.membershipStatus === "Active" ? "default" : "secondary"}>
                                {profile?.membershipStatus || "Member"}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{getReinforcementMessage()}</span>
                        </div>
                    </div>
                </div>

                {/* Streak Badge */}
                {stats.streak > 0 && (
                    <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-full border border-orange-100">
                        <Flame className="h-5 w-5 fill-orange-500 text-orange-600" />
                        <span className="font-bold">{stats.streak} Day Streak</span>
                    </div>
                )}
            </div>

            {/* 2. Active Session or Check-In Status */}
            <Card className={`${activeSession ? "border-primary bg-primary/30" : "border-dashed"}`}>
                <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
                    {activeSession ? (
                        <div className="space-y-4 w-full">
                            <div className="h-20 w-20 bg-primary rounded-full flex items-center justify-center mx-auto animate-pulse">
                                <Timer className="h-10 w-10 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-primary">Session In Progress</h2>
                                <p className="text-primary font-medium">Have a great workout!</p>
                            </div>
                            <div className="flex gap-4 text-sm text-primary justify-center">
                                <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" /> {format(new Date(activeSession.checkInTime), "h:mm a")}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Timer className="h-4 w-4" /> {formatDuration(sessionDuration)}
                                </span>
                            </div>
                            <Button onClick={() => setCheckoutDialogOpen(true)} variant="default" className="mt-4">
                                <LogOut className="h-4 w-4 mr-2" />
                                Check Out
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 max-w-md">
                            <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
                                <MapPin className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">Not Checked In</h2>
                                <p className="text-muted-foreground">
                                    Scan the QR code at the gym entrance or use location verification to check in.
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground italic">
                                Check-in is only available at the gym location or via QR code scan.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 3. Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Visits</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.totalSessions}</div>
                        <p className="text-xs text-muted-foreground mt-1">Lifetime check-ins</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="font-bold">{stats.thisWeek} / 4</span>
                                <span className="text-muted-foreground">Sessions</span>
                            </div>
                            <Progress value={(stats.thisWeek / 4) * 100} className="h-2" />
                            <p className="text-xs text-muted-foreground">
                                {stats.thisWeek >= 4 ? "Goal achieved! 🎉" : `${4 - stats.thisWeek} more to reach your goal`}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Duration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.averageDuration}m</div>
                        <p className="text-xs text-muted-foreground mt-1">Per session</p>
                    </CardContent>
                </Card>
            </div>

            {/* 4. Recent History */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" /> Recent History
                </h3>

                <div className="space-y-3">
                    {attendanceHistory.length === 0 ? (
                        <div className="text-center p-8 border rounded-lg bg-muted/20">
                            <p className="text-muted-foreground">No attendance history found. Start your journey today!</p>
                        </div>
                    ) : (
                        attendanceHistory.slice(0, 10).map((session) => (
                            <div
                                key={session.id}
                                className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                        {format(new Date(session.checkInTime), "dd")}
                                    </div>
                                    <div>
                                        <div className="font-medium">{format(new Date(session.checkInTime), "EEEE, MMMM d")}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {format(new Date(session.checkInTime), "h:mm a")}
                                            {session.durationMinutes && ` • ${session.durationMinutes} mins`}
                                            {session.focusArea && ` • ${session.focusArea}`}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">{getStatusBadge(session.status)}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Check-Out Dialog */}
            <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Complete Your Session</DialogTitle>
                        <DialogDescription>Add details about your workout (optional)</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Focus Area</Label>
                            <Select value={checkoutData.focusArea} onValueChange={(value) => setCheckoutData({ ...checkoutData, focusArea: value })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="strength">Strength</SelectItem>
                                    <SelectItem value="cardio">Cardio</SelectItem>
                                    <SelectItem value="mobility">Mobility</SelectItem>
                                    <SelectItem value="mixed">Mixed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Effort Level: {checkoutData.effortLevel}/5</Label>
                            <Slider
                                value={[checkoutData.effortLevel]}
                                onValueChange={([value]) => setCheckoutData({ ...checkoutData, effortLevel: value })}
                                min={1}
                                max={5}
                                step={1}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Notes (Optional)</Label>
                            <Textarea
                                placeholder="How did your workout go?"
                                value={checkoutData.notes}
                                onChange={(e) => setCheckoutData({ ...checkoutData, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCheckoutDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCheckOut}>Complete Session</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
