/**
 * Sent Notifications — Notifications sent to members (in-app, payment reminders, etc.)
 * Shows: who received, type, message, viewed status, date
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bell,
  RefreshCw,
  DollarSign,
  User,
  Mail,
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle,
  Send,
  Smartphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const NOTIFICATION_TYPES: Record<string, { label: string; icon: React.ElementType }> = {
  renewal_reminder: { label: "Renewal Reminder", icon: Calendar },
  win_back: { label: "Win-back", icon: Mail },
  payment: { label: "Payment", icon: DollarSign },
  payment_pending: { label: "Payment Pending", icon: DollarSign },
  payment_approved: { label: "Payment Approved", icon: CheckCircle2 },
  payment_rejected: { label: "Payment Rejected", icon: AlertCircle },
  event_announcement: { label: "Event Announcement", icon: Calendar },
  admin_update: { label: "Admin Message", icon: Mail },
  chat: { label: "Chat", icon: Mail },
  default: { label: "Other", icon: Bell },
};

interface SentNotification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  created_at: string;
  is_read?: boolean;
  status?: string;
  users?: { name: string; email: string } | null;
}

interface GymMember {
  id: string;
  name: string;
  email: string;
  last_notification_at?: string | null;
}

interface GymEvent {
  id: string;
  title: string;
  image_url?: string | null;
  event_date: string;
}

export default function SentNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<SentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewedFilter, setViewedFilter] = useState<string>("all");
  const [members, setMembers] = useState<GymMember[]>([]);
  const [testPushMemberId, setTestPushMemberId] = useState<string>("");
  const [testPushManualUserId, setTestPushManualUserId] = useState<string>("");
  const [testPushTitle, setTestPushTitle] = useState("Admin");
  const [testPushBody, setTestPushBody] = useState("This is a test push notification.");
  const [sendingPush, setSendingPush] = useState(false);

  const [testInAppMemberId, setTestInAppMemberId] = useState<string>("");
  const [testInAppManualUserId, setTestInAppManualUserId] = useState<string>("");
  const [testInAppTitle, setTestInAppTitle] = useState("Admin");
  const [testInAppMessage, setTestInAppMessage] = useState("This is a test in-app notification from GMS.");
  const [testInAppActionUrl, setTestInAppActionUrl] = useState("Main");
  const [testInAppImageUrl, setTestInAppImageUrl] = useState("");
  const [testInAppEventId, setTestInAppEventId] = useState<string>("");
  const [testInAppOverlayText, setTestInAppOverlayText] = useState("");
  const [testInAppAlsoPush, setTestInAppAlsoPush] = useState(true);
  const [sendingInApp, setSendingInApp] = useState(false);
  const [events, setEvents] = useState<GymEvent[]>([]);
  const [memberReachFilter, setMemberReachFilter] = useState<"all" | "not_sent" | "sent">("all");

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Avoid embed: notifications has 3 FKs to users (user_id, member_id, recipient_admin_id).
      // PostgREST cannot disambiguate. Fetch notifications first, then users separately.
      const { data: notifData, error: notifError } = await supabase
        .from("notifications")
        .select("id, user_id, type, message, created_at, is_read, status")
        .not("user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (notifError) {
        toast.error("Failed to load notifications: " + notifError.message);
        setNotifications([]);
        return;
      }

      const notificationsRaw = (notifData || []) as (SentNotification & { users?: { name: string; email: string } | null })[];
      const userIds = [...new Set(notificationsRaw.map((n) => n.user_id).filter(Boolean))] as string[];

      let userMap: Record<string, { name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, name, email")
          .in("id", userIds);
        userMap = Object.fromEntries(
          (usersData || []).map((u) => [u.id, { name: u.name || "", email: u.email || "" }])
        );
      }

      const enriched = notificationsRaw.map((n) => ({
        ...n,
        users: n.user_id ? userMap[n.user_id] ?? null : null,
      }));

      setNotifications(enriched);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load notifications");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Fetch gym members with last notification sent (for reach management)
  useEffect(() => {
    if (!user?.gymId) return;
    (async () => {
      const { data: membersData } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("gym_id", user.gymId)
        .eq("role", "member")
        .order("name");
      const membersList = (membersData || []) as GymMember[];
      const memberIds = membersList.map((m) => m.id);

      let notifData: { user_id: string; created_at: string }[] = [];
      if (memberIds.length > 0) {
        const { data } = await supabase
          .from("notifications")
          .select("user_id, created_at")
          .in("user_id", memberIds)
          .order("created_at", { ascending: false });
        notifData = data || [];
      }

      const lastByUser: Record<string, string> = {};
      (notifData || []).forEach((n: { user_id: string; created_at: string }) => {
        if (!lastByUser[n.user_id]) lastByUser[n.user_id] = n.created_at;
      });

      setMembers(
        membersList.map((m) => ({
          ...m,
          last_notification_at: lastByUser[m.id] || null,
        }))
      );
    })();
  }, [user?.gymId]);

  // Fetch gym events for rich notifications
  useEffect(() => {
    if (!user?.gymId) return;
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, image_url, event_date")
        .eq("gym_id", user.gymId)
        .eq("is_active", true)
        .gte("event_date", new Date().toISOString())
        .order("event_date")
        .limit(50);
      setEvents((data || []) as GymEvent[]);
    })();
  }, [user?.gymId]);

  const sendTestPush = async () => {
    const userId = testPushMemberId || testPushManualUserId.trim();
    if (!userId || !testPushTitle.trim() || !testPushBody.trim()) {
      toast.error("Select a member from the dropdown, or paste a User ID, and enter title and message.");
      return;
    }
    setSendingPush(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Not authenticated.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("send-push-to-user", {
        body: { user_id: userId, title: testPushTitle.trim(), body: testPushBody.trim() },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(data.message || `Push sent to ${data.sent} device(s)`);
      } else {
        toast.error(data?.error || "Push failed");
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to send push";
      if (msg.toLowerCase().includes("edge function") || msg.toLowerCase().includes("fetch")) {
        toast.error(
          "Edge function unreachable. Deploy it first: run 'supabase functions deploy send-push-to-user' from the GMS folder."
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setSendingPush(false);
    }
  };

  const sendTestInApp = async () => {
    const userId = testInAppMemberId || testInAppManualUserId.trim();
    const hasEvent = !!testInAppEventId;
    const hasMessage = !!testInAppMessage.trim();
    if (!userId || (!hasMessage && !hasEvent)) {
      toast.error("Select a member and enter a message or select an event.");
      return;
    }
    setSendingInApp(true);
    try {
      const { data: memberData } = await supabase
        .from("users")
        .select("gym_id")
        .eq("id", userId)
        .maybeSingle();
      const gymId = memberData?.gym_id ?? user?.gymId ?? null;

      const selectedEvent = testInAppEventId ? events.find((e) => e.id === testInAppEventId) : null;
      const imageUrl = selectedEvent?.image_url || testInAppImageUrl.trim() || undefined;
      const title = selectedEvent ? (testInAppOverlayText.trim() || selectedEvent.title) : (testInAppTitle.trim() || "Admin");
      const message = selectedEvent
        ? (testInAppMessage.trim() || `${selectedEvent.title} – ${new Date(selectedEvent.event_date).toLocaleDateString()}`)
        : testInAppMessage.trim();
      const metadata = imageUrl || selectedEvent
        ? { image_url: imageUrl, event_id: selectedEvent?.id, overlay_text: testInAppOverlayText.trim() || undefined }
        : undefined;
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        gym_id: gymId,
        type: selectedEvent ? "event_announcement" : "admin_message",
        message,
        title,
        sender_id: user?.id ?? undefined,
        sender_type: "admin",
        sender_name: user?.name || user?.email || "Admin",
        priority: 3,
        is_read: false,
        status: "unread",
        action_url: selectedEvent ? "EventDetail" : (testInAppActionUrl.trim() || null),
        action_label: "View",
        metadata: metadata || undefined,
      });

      if (error) throw error;

        if (testInAppAlsoPush) {
        const { data: pushData, error: pushError } = await supabase.functions.invoke("send-push-to-user", {
          body: { user_id: userId, title: testInAppTitle.trim() || "Admin", body: testInAppMessage.trim().substring(0, 200) },
        });
        if (pushError) {
          toast.success("In-app sent. Push failed (member may not have app/token).");
        } else if (pushData?.success) {
          toast.success("In-app + push sent. Member will see overlay even when app is closed.");
        } else {
          toast.success("In-app sent. Push: " + (pushData?.error || "failed"));
        }
      } else {
        toast.success("In-app notification sent. Member will see it when they open the bell.");
      }
      fetchNotifications();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send in-app notification");
    } finally {
      setSendingInApp(false);
    }
  };

  const filtered = notifications.filter((n) => {
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    if (viewedFilter === "viewed" && !n.is_read) return false;
    if (viewedFilter === "unviewed" && n.is_read) return false;
    return true;
  });

  const viewedCount = notifications.filter((n) => n.is_read).length;
  const unviewedCount = notifications.filter((n) => !n.is_read).length;
  const types = [...new Set(notifications.map((n) => n.type))].sort();

  const DAYS_CONSIDERED_SENT = 7;
  const filteredMembers = members.filter((m) => {
    if (memberReachFilter === "all") return true;
    const lastSent = m.last_notification_at ? new Date(m.last_notification_at) : null;
    const withinDays = lastSent && (Date.now() - lastSent.getTime()) < DAYS_CONSIDERED_SENT * 24 * 60 * 60 * 1000;
    if (memberReachFilter === "not_sent") return !withinDays;
    if (memberReachFilter === "sent") return !!withinDays;
    return true;
  });
  const notYetNotifiedCount = members.filter((m) => !m.last_notification_at || (Date.now() - new Date(m.last_notification_at).getTime()) > DAYS_CONSIDERED_SENT * 24 * 60 * 60 * 1000).length;
  const alreadyNotifiedCount = members.length - notYetNotifiedCount;

  const getTypeInfo = (type: string) =>
    NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.default;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sent Notifications</h1>
        <p className="text-muted-foreground mt-1">
          In-app notifications sent to members: payment reminders, renewal reminders, admin messages, and more.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Member reach</CardTitle>
          <CardDescription>
            Avoid over-sending: target members who haven&apos;t received notifications recently.
          </CardDescription>
          <div className="flex gap-6 mt-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{members.length}</span>
              <span className="text-sm text-muted-foreground">total members</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-amber-500" />
              <span className="font-medium">{notYetNotifiedCount}</span>
              <span className="text-sm text-muted-foreground">not notified (last 7 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-medium">{alreadyNotifiedCount}</span>
              <span className="text-sm text-muted-foreground">already notified</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">Test Push Notification</CardTitle>
              <CardDescription>
                Send a test push to a member&apos;s app. They must have the app installed and notifications enabled.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex-1 min-w-[220px]">
              <Label>Member (dropdown)</Label>
              <Select value={testPushMemberId} onValueChange={(v) => { setTestPushMemberId(v); setTestPushManualUserId(""); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={members.length === 0 ? "No members" : "Select member"} />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[220px]">
              <Label>Or paste User ID</Label>
              <Input
                value={testPushManualUserId}
                onChange={(e) => { setTestPushManualUserId(e.target.value); if (e.target.value) setTestPushMemberId(""); }}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Get User ID from Members page → click member → copy from URL or profile.
              </p>
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label>Title</Label>
              <Input
                value={testPushTitle}
                onChange={(e) => setTestPushTitle(e.target.value)}
                placeholder="Notification title"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Message</Label>
              <Input
                value={testPushBody}
                onChange={(e) => setTestPushBody(e.target.value)}
                placeholder="Notification body"
              />
            </div>
            <Button onClick={sendTestPush} disabled={sendingPush}>
              <Send className="h-4 w-4 mr-2" />
              {sendingPush ? "Sending..." : "Send Test Push"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">Test In-App Notification</CardTitle>
              <CardDescription>
                Send a test in-app notification. Member will see it in the bell when they open the app.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex-1 min-w-[220px]">
              <Label>Member</Label>
              <Select
                value={memberReachFilter}
                onValueChange={(v) => setMemberReachFilter(v as "all" | "not_sent" | "sent")}
              >
                <SelectTrigger className="w-[140px] mb-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({members.length})</SelectItem>
                  <SelectItem value="not_sent">Not yet notified ({notYetNotifiedCount})</SelectItem>
                  <SelectItem value="sent">Already notified ({alreadyNotifiedCount})</SelectItem>
                </SelectContent>
              </Select>
              <Select value={testInAppMemberId} onValueChange={(v) => { setTestInAppMemberId(v); setTestInAppManualUserId(""); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={filteredMembers.length === 0 ? "No members" : "Select member"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[220px]">
              <Label>Or paste User ID</Label>
              <Input
                value={testInAppManualUserId}
                onChange={(e) => { setTestInAppManualUserId(e.target.value); if (e.target.value) setTestInAppMemberId(""); }}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label>Subject / Title</Label>
              <Input
                value={testInAppTitle}
                onChange={(e) => setTestInAppTitle(e.target.value)}
                placeholder="e.g. New Event"
              />
            </div>
            <div className="flex-1 min-w-[280px]">
              <Label>Message</Label>
              <Input
                value={testInAppMessage}
                onChange={(e) => setTestInAppMessage(e.target.value)}
                placeholder="Notification message"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <Label>Open screen</Label>
              <Select value={testInAppActionUrl} onValueChange={setTestInAppActionUrl}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Main">Dashboard</SelectItem>
                  <SelectItem value="Payments">Payments</SelectItem>
                  <SelectItem value="Nutrition">Nutrition</SelectItem>
                  <SelectItem value="Profile">Profile</SelectItem>
                  <SelectItem value="EventHome">Events</SelectItem>
                  <SelectItem value="EventDetail">Event detail (use with event)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Gym event (rich notification)</Label>
              <Select value={testInAppEventId || "__none__"} onValueChange={(v) => { setTestInAppEventId(v === "__none__" ? "" : v); setTestInAppImageUrl(""); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None – use custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title} ({new Date(e.event_date).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <Label>Overlay text (on event banner)</Label>
              <Input
                value={testInAppOverlayText}
                onChange={(e) => setTestInAppOverlayText(e.target.value)}
                placeholder="e.g. Don't miss out!"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Or custom image URL</Label>
              <Input
                value={testInAppImageUrl}
                onChange={(e) => setTestInAppImageUrl(e.target.value)}
                placeholder="https://... (when no event)"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="test-inapp-push"
                checked={testInAppAlsoPush}
                onCheckedChange={(v) => setTestInAppAlsoPush(!!v)}
              />
              <Label htmlFor="test-inapp-push" className="text-sm font-normal cursor-pointer">
                Also send push (overlay when app closed)
              </Label>
            </div>
            <Button onClick={sendTestInApp} disabled={sendingInApp}>
              <Bell className="h-4 w-4 mr-2" />
              {sendingInApp ? "Sending..." : "Send Test In-App"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Member notifications</CardTitle>
              <CardDescription>
                {notifications.length} total · {viewedCount} viewed · {unviewedCount} unviewed
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {types.map((t) => (
                    <SelectItem key={t} value={t}>
                      {getTypeInfo(t).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={viewedFilter} onValueChange={setViewedFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Viewed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="unviewed">Unviewed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchNotifications} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No notifications match your filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Viewed</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((n) => {
                  const typeInfo = getTypeInfo(n.type);
                  const Icon = typeInfo.icon;
                  return (
                    <TableRow key={n.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {n.users?.name || "Unknown"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {n.users?.email || n.user_id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Icon className="h-3 w-3" />
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <p className="text-sm line-clamp-2">{n.message}</p>
                      </TableCell>
                      <TableCell>
                        {n.is_read ? (
                          <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Viewed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <Circle className="h-3 w-3" />
                            Unviewed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        <br />
                        <span className="text-xs">{format(new Date(n.created_at), "PPp")}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
