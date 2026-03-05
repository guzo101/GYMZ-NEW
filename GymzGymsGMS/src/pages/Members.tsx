/* @ts-nocheck */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/StatsCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, Filter, Plus, User, Crown, Star, Bell, Send, Edit, MessageCircle, X, Check, Grid3x3, LayoutGrid, List, Calendar, Zap, Users, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowUpDown, SortAsc, SortDesc, ChevronDown, Download } from "lucide-react";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandedHeader } from "@/lib/pdfBranding";
import { sanitizeMembershipStatuses, isMembershipValid } from "@/services/membershipService";
import { DataMapper } from "@/utils/dataMapper";
import { fetchGymPlans } from "@/services/gymPricing";
const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

interface MemberRecord {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
  membershipType: string | null;
  membershipStatus: string | null;
  joinDate: string | null;
  levelLabel: string | null;
  points: number | null;
  streak: number | null;
  renewalDueDate: string | null;
  avatarUrl?: string | null;
  role?: string;
  uniqueId?: string | null;
  height?: number | null;
  age?: number | null;
  goal?: string | null;
}

// ── SANITIZATION LAYER (Absolute Harmony Standard via DataMapper) ─────────────
const mapMemberRecord = (data: any): MemberRecord => DataMapper.fromDb<MemberRecord>(data);

export default function Members() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationDialog, setNotificationDialog] = useState<{ open: boolean; member: MemberRecord | null }>({ open: false, member: null });
  const [notificationMessage, setNotificationMessage] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [promotingMemberId, setPromotingMemberId] = useState<string | null>(null);

  // Edit profile dialog state
  const [editDialog, setEditDialog] = useState<{ open: boolean; member: MemberRecord | null }>({ open: false, member: null });
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [exportingMembers, setExportingMembers] = useState(false);

  // Chat dialog state
  const [chatDialog, setChatDialog] = useState<{ open: boolean; member: MemberRecord | null }>({ open: false, member: null });
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // View mode state: 'grid' | 'compact' | 'list'
  const [viewMode, setViewMode] = useState<"grid" | "compact" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState("All");
  const [membershipTypeFilter, setMembershipTypeFilter] = useState("All");
  const [gymPlanNames, setGymPlanNames] = useState<string[]>([]);
  const [sortField, setSortField] = useState<"points" | "streak" | "join_date" | "name" | "expiry">("name");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const init = async () => {
      if (!user?.gymId) return;
      await sanitizeMembershipStatuses();
      await fetchMembers();
      const plans = await fetchGymPlans(user.gymId, null);
      setGymPlanNames(plans.map(p => p.planName));
    };
    init();
  }, [user?.gymId]);

  // Handle deep linking via query parameters
  useEffect(() => {
    if (loading || members.length === 0) return;

    const searchQ = searchParams.get("search");
    const idQ = searchParams.get("id");

    const statusQ = searchParams.get("status");
    const sortQ = searchParams.get("sort");

    if (searchQ) {
      setSearchTerm(searchQ);
    }

    if (statusQ) {
      // Map URL status to filter value ("Active", "Inactive", "All")
      // Ensure case matching if needed, though state usually expects Title Case
      const formattedStatus = statusQ.charAt(0).toUpperCase() + statusQ.slice(1).toLowerCase();
      setStatusFilter(formattedStatus);
    }

    if (sortQ) {
      // Validate sort field
      if (["points", "streak", "join_date", "name", "expiry"].includes(sortQ)) {
        setSortField(sortQ as any);
      }
    }

    if (idQ) {
      const member = members.find(m => m.id === idQ);
      if (member) {
        handleOpenEditDialog(member);
        // Clear the ID from search params so it doesn't keep opening on every re-render/filter change
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("id");
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [loading, members, searchParams]);

  // Extract membership type from payment description — matches gym plans first, then common keywords
  const extractMembershipType = (desc: string, planNames: string[] = []): string | null => {
    if (!desc) return null;
    const normalized = desc.toLowerCase().trim();
    for (const plan of planNames) {
      if (plan && normalized.includes(plan.toLowerCase())) return plan;
    }
    if (normalized.includes("day pass") || normalized.includes("daypass")) return "Day Pass";
    if (normalized.includes("basic")) return "Basic";
    if (normalized.includes("couple")) return "Couple";
    if (normalized.includes("premium")) return "Premium";
    if (normalized.includes("family")) return "Family";
    return null;
  };

  // Sync membership_type for all members based on their most recent payment
  const syncMembershipTypesFromPayments = async () => {
    if (user?.role !== "admin" && user?.role !== "super_admin") return;
    if (!user?.gymId) return;

    try {

      // Get all members
      const { data: allMembers, error: membersError } = await db
        .from("users")
        .select("id, name, email, membership_type, membership_status")
        .eq("role", "member")
        .eq("gym_id", user.gymId);

      if (membersError) throw membersError;
      if (!allMembers || allMembers.length === 0) return;

      let updatedCount = 0;
      let skippedCount = 0;

      // Get MOST RECENT payment for each member that is approved/completed
      // We search for statuses that indicate "Paid" but potentially not yet processed into a subscription
      const { data: allRecentPayments, error: paymentError } = await db
        .from("payments")
        .select("id, user_id, description, paid_at, status")
        .eq("gym_id", user.gymId)
        .in("status", ["approved", "completed", "paid", "success"])
        .order("created_at", { ascending: false });

      if (paymentError) throw paymentError;

      // Group payments by user_id
      const latestPaymentMap = new Map();
      (allRecentPayments || []).forEach(p => {
        if (!latestPaymentMap.has(p.user_id)) {
          latestPaymentMap.set(p.user_id, p);
        }
      });

      for (const member of allMembers) {
        const recentPayment = latestPaymentMap.get(member.id);

        if (!recentPayment) {
          skippedCount++;
          continue;
        }

        // TRIGGER SYNC: If payment is 'approved' but NOT yet 'completed' (consumed by RPC),
        // or if the user is somehow not 'Active' despite having an approved payment.
        const needsActivation =
          recentPayment.status === "approved" ||
          (recentPayment.status === "completed" && (member.membership_status || "").toLowerCase() !== "active");

        if (!needsActivation) {
          skippedCount++;
          continue;
        }

        try {
          const { data: activationResult, error: activationError } = await supabase.rpc('activate_subscription_from_payment', {
            p_payment_id: recentPayment.id,
            p_admin_id: user.id
          });

          if (activationError) throw activationError;

          if (activationResult && !activationResult.success) {
            // Likely already processed or invalid tier, skip silently
            skippedCount++;
          } else {
            updatedCount++;
          }
        } catch (err: any) {
          console.error(`✗ RPC Error during sync for ${member.id}:`, err.message);
          skippedCount++;
        }
      }

      if (updatedCount > 0) {
        fetchMembers();
      }
    } catch (err) {
      console.error("Error syncing membership types:", err);
    }
  };

  // Automatically generate IDs for members without them and sync membership types (runs when admin views members page)
  useEffect(() => {
    if ((user?.role === "admin" || user?.role === "super_admin") && user?.gymId) {
      // Wait a bit after page load to not interfere with initial data fetch
      const timer = setTimeout(async () => {
        try {
          // First, sync membership types from payments
          await syncMembershipTypesFromPayments();

          // Then generate IDs for members without them
          const { generateAndVerifyUniqueUserId } = await import("@/lib/utils");
          let successCount = 0;
          const { data: allMembers } = await db
            .from("users")
            .select("id, name, email, unique_id")
            .eq("role", "member")
            .eq("gym_id", user.gymId);

          if (allMembers) {
            const needsId = allMembers.filter((m: any) => !m.unique_id || m.unique_id === null || m.unique_id === "");
            if (needsId.length > 0) {
              for (const member of needsId) {
                try {
                  const uniqueId = await generateAndVerifyUniqueUserId(db, 30);
                  const { error } = await db.from("users").update({ unique_id: uniqueId }).eq("id", member.id);
                  if (!error) {
                    successCount++;
                  }
                  // Small delay to avoid overwhelming database
                  await new Promise(resolve => setTimeout(resolve, 50));
                } catch (err: any) {
                  console.error(`✗ Failed for ${member.email || member.id}:`, err.message);
                }
              }
              // Refresh members list to show new IDs
              if (successCount > 0) {
                fetchMembers();
              }
            }
          }
        } catch (err) {
          console.error("Error in admin auto-tasks:", err);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user?.role]);

  async function fetchMembers() {
    if (!user?.gymId) return;
    setLoading(true);
    setError(null);
    const query = db
      .from("users")
      .select("id, name, first_name, last_name, email, role, status, membership_status, unique_id, join_date, membership_type, renewal_due_date, points, streak, avatar_url, height, age, goal")
      .eq("role", "member")
      .eq("gym_id", user.gymId)
      .order("created_at", { ascending: false });

    const { data, error } = (await query) as any;
    if (error) {
      console.error("Fetch members error:", error);
      setError("Unable to load members: " + (error.message || "Unknown error"));
      setMembers([]);
    } else {
      setMembers((data ?? []).map(mapMemberRecord));
    }
    setLoading(false);
  }

  // Subscription tier ranking (higher number = higher tier)
  const getSubscriptionTier = (membership: string): number => {
    const normalized = membership?.toLowerCase() || "";
    if (normalized.includes("day pass") || normalized.includes("daypass")) return 1;
    if (normalized.includes("basic")) return 2;
    if (normalized.includes("couple")) return 3;
    if (normalized.includes("premium")) return 4;
    if (normalized.includes("family")) return 5;
    return 0; // Unspecified/Unknown
  };

  // Sort members by subscription tier and status
  const filteredMembers = useMemo(
    () => {
      let filtered = members.filter(
        (member) => {
          const nameMatch = (member.name || "").toLowerCase().includes(searchTerm.toLowerCase());
          const emailMatch = (member.email || "").toLowerCase().includes(searchTerm.toLowerCase());
          return nameMatch || emailMatch;
        }
      );

      if (statusFilter !== "All") {
        filtered = filtered.filter(member => member.membershipStatus === statusFilter);
      }

      if (membershipTypeFilter !== "All") {
        filtered = filtered.filter(member => (member.membershipType || "").includes(membershipTypeFilter));
      }

      // Sort the list
      return filtered.sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
          case "points":
            comparison = (a.points || 0) - (b.points || 0);
            break;
          case "streak":
            comparison = (a.streak || 0) - (b.streak || 0);
            break;
          case "join_date":
            comparison = new Date(a.joinDate || 0).getTime() - new Date(b.joinDate || 0).getTime();
            break;
          case "expiry":
            comparison = new Date(a.renewalDueDate || "9999-12-31").getTime() - new Date(b.renewalDueDate || "9999-12-31").getTime();
            break;
          case "name":
            comparison = (a.name || "").localeCompare(b.name || "");
            break;
          default:
            comparison = 0;
        }

        return sortOrder === "desc" ? -comparison : comparison;
      });
    },
    [members, searchTerm, statusFilter, membershipTypeFilter, sortField, sortOrder]
  );

  const getMembershipColor = (membership: any) => {
    const normalized = (typeof membership === 'string' ? membership : "").toLowerCase().trim();
    if (normalized.includes("day pass") || normalized.includes("daypass")) return "bg-gray-500";
    if (normalized.includes("basic")) return "bg-primary";
    if (normalized.includes("couple")) return "bg-primary";
    if (normalized.includes("premium")) return "bg-yellow-500";
    if (normalized.includes("family")) return "bg-gradient-to-r from-primary to-secondary";
    return "bg-gray-500";
  };

  const getMembershipBadge = (membership: any) => {
    const normalized = (typeof membership === 'string' ? membership : "").toLowerCase().trim();
    if (normalized.includes("day pass") || normalized.includes("daypass")) {
      return { icon: Calendar, color: "text-gray-600", bgColor: "bg-gray-100" };
    }
    if (normalized.includes("basic")) {
      return { icon: Zap, color: "text-primary", bgColor: "bg-primary" };
    }
    if (normalized.includes("couple")) {
      return { icon: Users, color: "text-primary", bgColor: "bg-primary" };
    }
    if (normalized.includes("premium")) {
      return { icon: Crown, color: "text-yellow-600", bgColor: "bg-yellow-100" };
    }
    if (normalized.includes("family")) {
      return { icon: Sparkles, color: "text-primary", bgColor: "bg-gradient-to-r from-primary to-secondary" };
    }
    return { icon: User, color: "text-gray-600", bgColor: "bg-gray-100" };
  };

  const getStatusColor = (status: any) => {
    const s = typeof status === 'string' ? status : "";
    switch (s) {
      case "Active":
        return "bg-primary";
      case "Inactive":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  async function handleSendNotification() {
    if (!notificationDialog.member || !notificationMessage.trim()) return;
    setSendingNotification(true);
    try {
      const { error } = await db.from("notifications").insert({
        message: notificationMessage.trim(),
        user_id: notificationDialog.member.id,
        gym_id: user.gymId,
        type: "admin_update",
        read: false
      });
      if (error) throw error;
      setNotificationDialog({ open: false, member: null });
      setNotificationMessage("");
      toast.success("Notification sent successfully!");
    } catch (err: any) {
      toast.error("Failed to send notification: " + (err?.message || "Unknown error"));
    } finally {
      setSendingNotification(false);
    }
  }

  async function handlePromoteToStaff(member: MemberRecord) {
    if (!member?.id) return;
    if (!user || user.role !== "admin") {
      toast.error("Only admins can assign staff roles.");
      return;
    }

    setPromotingMemberId(member.id);
    try {
      const { error } = await supabase.rpc("promote_member_to_staff", {
        p_user_id: member.id,
      } as any);

      if (error) throw error;

      toast.success(`${member.name || member.email || "Member"} promoted to staff.`);
      await fetchMembers();
    } catch (err: any) {
      toast.error("Failed to promote member: " + (err?.message || "Unknown error"));
    } finally {
      setPromotingMemberId(null);
    }
  }

  async function handleOpenEditDialog(member: MemberRecord) {
    setEditDialog({ open: true, member });
    try {
      // Fetch full member profile data
      const { data: userData, error: userError } = await db
        .from("users")
        .select("*")
        .eq("id", member.id)
        .single();

      if (userError) throw userError;

      // Check if we have payment info, if not try to find it in payments table
      let lastPaymentDate = userData.last_payment_date;
      let membershipType = userData.membership_type;
      let renewalDate = userData.renewal_due_date;

      const { data: paymentData } = await db
        .from("payments")
        .select("paid_at, description, amount")
        .eq("user_id", member.id)
        .eq("gym_id", user.gymId)
        .eq("status", "completed")
        .order("paid_at", { ascending: false })
        .limit(1)
        .single();

      if (paymentData) {
        if (!lastPaymentDate && paymentData.paid_at) {
          lastPaymentDate = paymentData.paid_at;
        }

        // If membership type is missing or generic, try to get it from payment
        if (!membershipType || membershipType === "Member") {
          const extracted = extractMembershipType(paymentData.description, gymPlanNames);
          if (extracted) membershipType = extracted;
        }
      }

      // Auto-calculate Renewal Date if missing, based on Type + Last Payment
      if (!renewalDate && lastPaymentDate && membershipType) {
        const payDate = new Date(lastPaymentDate);
        const typeRaw = membershipType.toLowerCase();

        // Use "Base Date + Duration" for consistency
        // Since we don't know current expiry here if it was missing, we assume base = payDate - 1
        const baseDate = new Date(payDate);
        baseDate.setDate(baseDate.getDate() - 1);

        let expiryDate = new Date(baseDate);

        if (typeRaw.includes("day")) {
          expiryDate.setDate(expiryDate.getDate() + 1);
          renewalDate = expiryDate.toISOString();
        } else if (typeRaw.includes("week")) {
          expiryDate.setDate(expiryDate.getDate() + 7);
          renewalDate = expiryDate.toISOString();
        } else if (typeRaw.includes("year") || typeRaw.includes("annual")) {
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          renewalDate = expiryDate.toISOString();
        } else {
          // Default Monthly (1 month)
          expiryDate.setMonth(expiryDate.getMonth() + 1);
          renewalDate = expiryDate.toISOString();
        }
      }

      setEditingProfile({
        ...userData,
        first_name: userData.first_name || userData.name?.split(' ')[0] || "",
        last_name: userData.last_name || (userData.name?.includes(' ') ? userData.name.substring(userData.name.indexOf(' ') + 1) : "") || "",
        last_payment_date: lastPaymentDate,
        membership_type: membershipType,
        renewal_due_date: renewalDate,
        height: userData.height,
        age: userData.age,
        goal: userData.primary_objective || userData.goal,
        photo: null,
        photoUrl: userData.avatar_url
      });
    } catch (err: any) {
      toast.error("Failed to load member profile: " + (err?.message || "Unknown error"));
      setEditDialog({ open: false, member: null });
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !e.target.files[0] || !editingProfile) return;
    const file = e.target.files[0];
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `user_${editingProfile.id}_${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('user-avatars').getPublicUrl(fileName);
      if (urlData?.publicUrl) {
        setEditingProfile({ ...editingProfile, avatar_url: urlData.publicUrl, photoUrl: urlData.publicUrl });
      }
    } catch (err: any) {
      toast.error("Failed to upload avatar: " + (err?.message || "Unknown error"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveProfile() {
    if (!editingProfile || !editDialog.member) return;
    setSavingProfile(true);
    try {
      const fullName = `${editingProfile.firstName || editingProfile.first_name} ${editingProfile.lastName || editingProfile.last_name}`.trim();
      const updateData = DataMapper.toDb({
        firstName: editingProfile.firstName || editingProfile.first_name || "",
        lastName: editingProfile.lastName || editingProfile.last_name || "",
        name: fullName,
        email: editingProfile.email,
        phone: editingProfile.phone || null,
        avatarUrl: editingProfile.avatarUrl || editingProfile.avatar_url || editingProfile.photoUrl || null,
        membershipType: editingProfile.membershipType || editingProfile.membership_type || null,
        membershipStatus: editingProfile.membershipStatus || editingProfile.membership_status || null,
        status: editingProfile.status || 'Active',
        renewalDueDate: editingProfile.renewalDueDate || editingProfile.renewal_due_date || null,
        lastPaymentDate: editingProfile.lastPaymentDate || editingProfile.last_payment_date || null,
        subscriptionDurationMonths: editingProfile.subscriptionDurationMonths || editingProfile.subscription_duration_months || null,
        primaryObjective: editingProfile.primaryObjective || editingProfile.primary_objective || null,
        secondaryObjective: editingProfile.secondaryObjective || editingProfile.secondary_objective || null,
        areasOfCaution: editingProfile.areasOfCaution || editingProfile.areas_of_caution || null,
        intensityClearance: editingProfile.intensityClearance || editingProfile.intensity_clearance || null,
        preferredTrainingStyles: editingProfile.preferredTrainingStyles || editingProfile.preferred_training_styles || null,
        trainerPreference: editingProfile.trainerPreference || editingProfile.trainer_preference || null,
        preferredTrainingEnv: editingProfile.preferredTrainingEnv || editingProfile.preferred_training_env || null,
        availability: editingProfile.availability || null,
        timezone: editingProfile.timezone || null,
        travelFrequency: editingProfile.travelFrequency || editingProfile.travel_frequency || null,
        weight: editingProfile.weight || null,
        bodyFatPct: editingProfile.bodyFatPct || editingProfile.body_fat_pct || null,
        waist: editingProfile.waist || null,
        restingHr: editingProfile.restingHr || editingProfile.resting_hr || null,
        bloodPressure: editingProfile.bloodPressure || editingProfile.blood_pressure || null,
        privacyProgress: editingProfile.privacyProgress !== false,
        notifSessionReminders: editingProfile.notifSessionReminders !== false,
        notifCheckin: editingProfile.notifCheckin !== false,
        notifProgramUpdates: editingProfile.notifProgramUpdates !== false,
        height: editingProfile.height || null,
        age: editingProfile.age || null,
        goal: editingProfile.goal || null,
      });

      const { error } = await db
        .from("users")
        .update(updateData)
        .eq("id", editDialog.member.id);

      if (error) throw error;

      // Update local members list
      await fetchMembers();
      toast.success("Profile updated successfully!");
      setEditDialog({ open: false, member: null });
      setEditingProfile(null);
    } catch (err: any) {
      toast.error("Failed to update profile: " + (err?.message || "Unknown error"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleOpenChat(member: MemberRecord) {
    setChatDialog({ open: true, member });
    await fetchMessages(member.id);
  }

  // Subscribe to new messages when chat dialog is open
  useEffect(() => {
    if (!chatDialog.open || !chatDialog.member || !user?.id) return;
    const conversationId = `${user.id}_${chatDialog.member.id}`;
    const channel = supabase.channel(`chat:${conversationId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => { fetchMessages(chatDialog.member!.id); }).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `type=eq.chat,user_id=eq.${chatDialog.member!.id}` }, () => { fetchMessages(chatDialog.member!.id); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatDialog.open, chatDialog.member?.id, user?.id]);

  // Global Real-time Member Updates Subscription
  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "super_admin") return;

    const userChannel = supabase
      .channel("global:users-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users", filter: `gym_id=eq.${user.gymId}` },
        async (payload) => {
          console.log("Real-time Member Change:", payload.eventType, payload.new || payload.old);

          if (payload.eventType === 'INSERT') {
            const newUser = payload.new as MemberRecord;
            if (newUser.role === 'member') {
              setMembers(current => [newUser, ...current]);
              toast.info(`New member registered: ${newUser.name || newUser.email}`);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedUser = payload.new as MemberRecord;
            if (updatedUser.role !== 'member') {
              // If role changed from member, remove them
              setMembers(current => current.filter(m => m.id !== updatedUser.id));
              return;
            }

            if (payload.new.membership_status === 'Active' && payload.old.membership_status !== 'Active') {
              toast.success(`Member Activated: ${payload.new.name || 'Member'}`);
            }

            setMembers((current) =>
              current.map((member) =>
                member.id === payload.new.id ? { ...member, ...payload.new } : member
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setMembers(current => current.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [user?.id, user?.role]);

  async function fetchMessages(memberId: string) {
    if (!user?.id || !memberId) return;
    setLoadingMessages(true);
    try {
      const conversationId1 = `${user.id}_${memberId}`;
      const conversationId2 = `${memberId}_${user.id}`;

      // Try to fetch from messages table first
      let { data: messagesData, error: messagesError } = await db
        .from("messages")
        .select("*")
        .or(`conversation_id.eq.${conversationId1},conversation_id.eq.${conversationId2}`)
        .order("created_at", { ascending: true });

      // If messages table doesn't exist or has no data, use notifications as chat
      if (messagesError || !messagesData || messagesData.length === 0) {
        // Use notifications as a simple chat system
        // Fetch messages where admin sent to member or member sent to admin
        const { data: notificationsData } = await db
          .from("notifications")
          .select("*")
          .eq("type", "chat")
          .or(`and(user_id.eq.${memberId},sender_id.eq.${user.id}),and(user_id.eq.${user.id},sender_id.eq.${memberId})`)
          .order("created_at", { ascending: true });

        if (notificationsData && notificationsData.length > 0) {
          setMessages(notificationsData.map((n: any) => ({
            id: n.id,
            content: n.message,
            sender_id: n.sender_id || (n.user_id === user.id ? memberId : user.id),
            created_at: n.created_at,
          })));
        } else {
          setMessages([]);
        }
      } else {
        setMessages(messagesData || []);
      }
    } catch (err: any) {
      console.error("Error fetching messages:", err);
      // Fallback: try fetching from notifications only
      try {
        const { data: notificationsData } = await db
          .from("notifications")
          .select("*")
          .eq("type", "chat")
          .or(`user_id.eq.${memberId},user_id.eq.${user?.id || ""}`)
          .order("created_at", { ascending: true });

        setMessages((notificationsData || []).map((n: any) => ({
          id: n.id,
          content: n.message,
          sender_id: n.sender_id || (n.user_id === user?.id ? memberId : user?.id),
          created_at: n.created_at,
        })));
      } catch (fallbackErr) {
        console.error("Fallback fetch also failed:", fallbackErr);
        setMessages([]);
      }
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !chatDialog.member || !user?.id || sendingMessage) return;
    setSendingMessage(true);
    try {
      const conversationId = `${user.id}_${chatDialog.member.id}`;
      const messageContent = newMessage.trim();

      // Try to insert into messages table first
      let { error: messageError } = await db.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        receiver_id: chatDialog.member.id,
        content: messageContent,
        created_at: new Date().toISOString(),
      });

      // Fallback to notifications if messages table doesn't exist
      if (messageError) {
        // Create notification for the member
        const { error: notifError } = await db.from("notifications").insert({
          message: messageContent,
          user_id: chatDialog.member.id,
          type: "chat",
          sender_id: user.id,
          read: false,
        });
        if (notifError) throw notifError;
      }

      setNewMessage("");
      // Small delay to ensure message is saved before fetching
      setTimeout(async () => {
        await fetchMessages(chatDialog.member!.id);
      }, 100);
    } catch (err: any) {
      toast.error("Failed to send message: " + (err?.message || "Unknown error"));
      console.error("Send message error:", err);
    } finally {
      setSendingMessage(false);
    }
  }

  const exportMembersToPDF = async () => {
    setExportingMembers(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4') as any; // Landscape for more columns

      const startY = await addBrandedHeader(doc, 'Gymz MEMBER REGISTRY');

      // Statistics Summary
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text('Member Distribution', 15, startY);

      const activeCount = filteredMembers.filter(m => m.membershipStatus === 'Active').length;
      const totalPoints = filteredMembers.reduce((s, m) => s + (Number(m.points) || 0), 0);
      const avgStreak = filteredMembers.length > 0
        ? (filteredMembers.reduce((s, m) => s + (Number(m.streak) || 0), 0) / filteredMembers.length).toFixed(1)
        : "0.0";

      autoTable(doc, {
        startY: 55,
        head: [['Metric', 'Value']],
        body: [
          ['Total Viewable Members', filteredMembers.length.toString()],
          ['Active Memberships', activeCount.toString()],
          ['Registry Total Points', totalPoints.toLocaleString()],
          ['Registry Average Streak', avgStreak]
        ],
        theme: 'striped',
        headStyles: { fillColor: [42, 75, 42] },
        styles: { fontSize: 9 },
        margin: { left: 15 }
      });

      // Main Table
      const tableData = filteredMembers.map(m => [
        m.uniqueId || '---',
        m.name || m.email || '---',
        (m.membershipType || '—').toUpperCase(),
        (m.membershipStatus || 'Inactive').toUpperCase(),
        m.renewalDueDate ? format(new Date(m.renewalDueDate), 'dd/MM/yyyy') : '---',
        (m.points || 0).toString(),
        (m.streak || 0).toString()
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable?.finalY + 15 || 100,
        head: [['ID', 'Name/Email', 'Tier', 'Status', 'Expiry', 'Points', 'Streak']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [42, 75, 42] },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 60 },
          3: { fontStyle: 'bold' }
        }
      });

      doc.save(`Gymz_Members_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success("Member list exported successfully!");
    } catch (err) {
      console.error("Member PDF Export Error:", err);
      toast.error("Failed to export member list. Please try again.");
    } finally {
      setExportingMembers(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <nav className="text-sm text-muted-foreground">
            Home / Members
          </nav>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportMembersToPDF} disabled={exportingMembers}>
            {exportingMembers ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export List
          </Button>
          <Button className="w-fit">
            <Plus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Premium Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatsCard
          title="Total Members"
          value={members.length}
          icon={Users}
          trend="neutral"
        />
        <StatsCard
          title="Active Members"
          value={members.filter(m => m.membershipStatus === "Active").length}
          icon={Check}
          trend="up"
        />
        <StatsCard
          title="Registry Points"
          value={members.reduce((s, m) => s + (Number(m.points) || 0), 0).toLocaleString()}
          icon={Star}
          trend="up"
        />
        <StatsCard
          title="Average Streak"
          value={members.length > 0 ? (members.reduce((s, m) => s + (Number(m.streak) || 0), 0) / members.length).toFixed(1) : "0.0"}
          icon={Zap}
          trend="up"
        />
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "compact" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode("compact")}
                  title="Compact View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode("list")}
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filter & Sort
                    {(statusFilter !== "All" || membershipTypeFilter !== "All") && (
                      <Badge variant="secondary" className="ml-1 px-1 h-5 min-w-5 flex items-center justify-center">
                        {(statusFilter !== "All" ? 1 : 0) + (membershipTypeFilter !== "All" ? 1 : 0)}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Status</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {["All", "Active", "Inactive", "Pending"].map((status) => (
                          <Button
                            key={status}
                            variant={statusFilter === status ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter(status)}
                            className="text-xs"
                          >
                            {status}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Membership Type</h4>
                      <select
                        value={membershipTypeFilter}
                        onChange={(e) => setMembershipTypeFilter(e.target.value)}
                        className="w-full p-2 text-sm border rounded-md"
                      >
                        <option value="All">All Types</option>
                        {[...new Set([...gymPlanNames, ...members.map(m => m.membershipType).filter(Boolean)])]
                          .sort((a, b) => (a || "").localeCompare(b || ""))
                          .map((name) => (
                            <option key={name} value={name!}>{name}</option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <h4 className="font-medium leading-none">Sort By</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "name", label: "Name" },
                          { id: "points", label: "Points" },
                          { id: "streak", label: "Streak" },
                          { id: "join_date", label: "Joined" },
                          { id: "expiry", label: "Expiry" }
                        ].map((field) => (
                          <Button
                            key={field.id}
                            variant={sortField === field.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSortField(field.id as any)}
                            className="text-xs"
                          >
                            {field.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Order</h4>
                      <div className="flex gap-2">
                        <Button
                          variant={sortOrder === "desc" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => setSortOrder("desc")}
                        >
                          <SortDesc className="h-4 w-4" />
                          High to Low
                        </Button>
                        <Button
                          variant={sortOrder === "asc" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => setSortOrder("asc")}
                        >
                          <SortAsc className="h-4 w-4" />
                          Low to High
                        </Button>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      className="w-full text-xs text-muted-foreground h-8"
                      onClick={() => {
                        setStatusFilter("All");
                        setMembershipTypeFilter("All");
                        setSortField("name");
                        setSortOrder("asc");
                      }}
                    >
                      Reset All
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Card>
          <CardContent className="py-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Loading members...</CardContent>
        </Card>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMembers.map((member) => (
                <Card key={member.id} className="hover:shadow-md transition-shadow flex flex-col relative overflow-hidden group">
                  <CardContent className="p-5 flex flex-col flex-1">
                    {/* Absolute icon container for dashboard consistency */}
                    {(() => {
                      const badge = getMembershipBadge(member.membershipType);
                      const Icon = badge.icon;
                      return (
                        <div className={`absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-xl shadow-lg bg-gradient-to-br from-primary to-primary-foreground/20 transition-transform group-hover:scale-110`}>
                          <Icon className="h-3.5 w-3.5 text-white" />
                        </div>
                      );
                    })()}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="h-full w-full object-cover rounded-full"
                            />
                          ) : (
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {(member.name || member.email || "??")
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold truncate">{member.name}</h3>
                          <div className="flex flex-col">
                            <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5 opacity-70">Member ID: {member.uniqueId || "---"}</p>
                          </div>
                        </div>
                      </div>
                      {(() => {
                        const badge = getMembershipBadge(member.membershipType);
                        const Icon = badge.icon;
                        return <Icon className={`h-5 w-5 ${badge.color} flex-shrink-0 ml-2`} />;
                      })()}
                    </div>

                    <div className="space-y-2.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Membership</span>
                        {(() => {
                          const badge = getMembershipBadge(member.membershipType);
                          const Icon = badge.icon;
                          return (
                            <Badge className={`${getMembershipColor(member.membershipType)} text-white flex items-center gap-1.5`}>
                              <Icon className="h-3.5 w-3.5" />
                              {member.membershipType}
                            </Badge>
                          );
                        })()}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge className={`${getStatusColor(member.membershipStatus)} text-white`}>
                          {member.membershipStatus}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Level</span>
                        <span className="text-sm font-medium">{member.levelLabel || "Not set"}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Points</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium">{member.points ?? 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Streak</span>
                        <span className="text-sm font-medium">
                          {member.streak ?? 0} {(member.streak ?? 0) === 1 ? "day" : "days"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Joined</span>
                        <span className="text-sm">
                          {member.joinDate ? new Date(member.joinDate).toLocaleDateString() : "Unknown"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t">
                      <div className="grid grid-cols-4 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full flex flex-col items-center justify-center gap-1 h-auto py-2.5 px-2"
                          onClick={() => setNotificationDialog({ open: true, member })}
                        >
                          <Bell className="h-4 w-4 flex-shrink-0" />
                          <span className="text-xs leading-tight">Notify</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full flex flex-col items-center justify-center gap-1 h-auto py-2.5 px-2"
                          onClick={() => handleOpenChat(member)}
                        >
                          <MessageCircle className="h-4 w-4 flex-shrink-0" />
                          <span className="text-xs leading-tight">Chat</span>
                        </Button>
                        <Button
                          size="sm"
                          className="w-full flex flex-col items-center justify-center gap-1 h-auto py-2.5 px-2"
                          onClick={() => handleOpenEditDialog(member)}
                        >
                          <Edit className="h-4 w-4 flex-shrink-0" />
                          <span className="text-xs leading-tight">Edit</span>
                        </Button>
                        {user?.role === "admin" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full flex flex-col items-center justify-center gap-1 h-auto py-2.5 px-2"
                            onClick={() => handlePromoteToStaff(member)}
                            disabled={promotingMemberId === member.id}
                          >
                            <Check className="h-4 w-4 flex-shrink-0" />
                            <span className="text-xs leading-tight">
                              {promotingMemberId === member.id ? "..." : "Staff"}
                            </span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Compact View */}
          {viewMode === "compact" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredMembers.map((member) => (
                <Card key={member.id} className="hover:shadow-md transition-shadow flex flex-col cursor-pointer relative overflow-hidden group" onClick={() => handleOpenEditDialog(member)}>
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    {/* Absolute icon container for dashboard consistency */}
                    {(() => {
                      const badge = getMembershipBadge(member.membershipType);
                      const Icon = badge.icon;
                      return (
                        <div className={`absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-lg shadow-md bg-gradient-to-br from-primary to-primary-foreground/20 transition-transform group-hover:scale-110`}>
                          <Icon className="h-3 w-3 text-white" />
                        </div>
                      );
                    })()}
                    <div className="relative mb-3">
                      <Avatar className="h-16 w-16 mx-auto">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="h-full w-full object-cover rounded-full"
                          />
                        ) : (
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                            {(member.name || member.email || "??")
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(member.membershipStatus)}`} />
                    </div>
                    <h3 className="font-semibold text-sm mb-1 truncate w-full">{member.name}</h3>
                    <p className="text-xs text-muted-foreground truncate w-full mb-2">{member.email}</p>
                    <div className="flex flex-col gap-1.5 w-full">
                      {(() => {
                        const badge = getMembershipBadge(member.membershipType);
                        const Icon = badge.icon;
                        return (
                          <Badge className={`${getMembershipColor(member.membershipType)} text-white text-xs w-full justify-center flex items-center gap-1`}>
                            <Icon className="h-3 w-3" />
                            {member.membershipType}
                          </Badge>
                        );
                      })()}
                      <div className="flex items-center justify-center gap-1 text-xs">
                        <Star className="h-3 w-3 text-yellow-500" />
                        <span>{member.points ?? 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === "list" && (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left p-4 font-semibold text-sm">Member</th>
                        <th className="text-left p-4 font-semibold text-sm">Membership</th>
                        <th className="text-left p-4 font-semibold text-sm">Status</th>
                        <th className="text-left p-4 font-semibold text-sm">Level</th>
                        <th className="text-left p-4 font-semibold text-sm">Points</th>
                        <th className="text-left p-4 font-semibold text-sm">Streak</th>
                        <th className="text-left p-4 font-semibold text-sm">Joined</th>
                        <th className="text-right p-4 font-semibold text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((member, index) => (
                        <tr
                          key={member.id}
                          className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => handleOpenEditDialog(member)}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                {member.avatarUrl ? (
                                  <img
                                    src={member.avatarUrl}
                                    alt={member.name}
                                    className="h-full w-full object-cover rounded-full"
                                  />
                                ) : (
                                  <AvatarFallback className="bg-primary text-primary-foreground">
                                    {(member.name || member.email || "??")
                                      .split(" ")
                                      .map((part) => part[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{member.name}</span>
                                  {(() => {
                                    const badge = getMembershipBadge(member.membershipType);
                                    const Icon = badge.icon;
                                    return <Icon className={`h-4 w-4 ${badge.color}`} />;
                                  })()}
                                </div>
                                <div className="flex flex-col">
                                  <p className="text-sm text-muted-foreground">{member.email}</p>
                                  <p className="text-[10px] font-mono text-muted-foreground opacity-70">Member ID: {member.uniqueId || "---"}</p>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            {(() => {
                              const badge = getMembershipBadge(member.membershipType);
                              const Icon = badge.icon;
                              return (
                                <Badge className={`${getMembershipColor(member.membershipType)} text-white flex items-center gap-1.5 w-fit`}>
                                  <Icon className="h-3.5 w-3.5" />
                                  {member.membershipType}
                                </Badge>
                              );
                            })()}
                          </td>
                          <td className="p-4">
                            <Badge className={`${getStatusColor(member.membershipStatus)} text-white`}>
                              {member.membershipStatus}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <span className="text-sm">{member.levelLabel || "Not set"}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500" />
                              <span className="text-sm font-medium">{member.points ?? 0}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm">
                              {member.streak ?? 0} {(member.streak ?? 0) === 1 ? "day" : "days"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm">
                              {member.joinDate ? new Date(member.joinDate).toLocaleDateString() : "Unknown"}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => setNotificationDialog({ open: true, member })}
                              >
                                <Bell className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleOpenChat(member)}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleOpenEditDialog(member)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {user?.role === "admin" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2"
                                  onClick={() => handlePromoteToStaff(member)}
                                  disabled={promotingMemberId === member.id}
                                >
                                  {promotingMemberId === member.id ? "..." : "Staff"}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!loading && filteredMembers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No members found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search terms." : "Get started by adding your first member."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Send Notification Dialog */}
      <Dialog open={notificationDialog.open} onOpenChange={(open) => {
        if (!sendingNotification) {
          setNotificationDialog({ open, member: null });
          setNotificationMessage("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>To</Label>
              <div className="mt-1 text-sm font-medium">
                {notificationDialog.member?.name} ({notificationDialog.member?.email})
              </div>
            </div>
            <div>
              <Label htmlFor="notification-message">Message</Label>
              <Textarea
                id="notification-message"
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder="Enter notification message..."
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNotificationDialog({ open: false, member: null });
                setNotificationMessage("");
              }}
              disabled={sendingNotification}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendNotification}
              disabled={!notificationMessage.trim() || sendingNotification}
            >
              {sendingNotification ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => {
        if (!savingProfile) {
          setEditDialog({ open, member: null });
          setEditingProfile(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Member Profile</DialogTitle>
            <DialogDescription>
              Edit profile information for {editDialog.member?.name}
            </DialogDescription>
          </DialogHeader>
          {editingProfile && (
            <div className="space-y-4 py-4">
              {/* Avatar Upload */}
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 rounded-full border-2 border-muted overflow-hidden bg-muted flex-shrink-0">
                  {editingProfile.photoUrl ? (
                    <img src={editingProfile.photoUrl} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">👤</span>
                  )}
                </div>
                <div>
                  <Label htmlFor="avatar-upload">Profile Photo</Label>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="mt-1"
                    disabled={uploadingAvatar}
                  />
                  {uploadingAvatar && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="edit-first-name">First Name *</Label>
                    <Input
                      id="edit-first-name"
                      value={editingProfile.first_name || ""}
                      onChange={(e) => setEditingProfile({ ...editingProfile, first_name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="edit-last-name">Last Name *</Label>
                    <Input
                      id="edit-last-name"
                      value={editingProfile.last_name || ""}
                      onChange={(e) => setEditingProfile({ ...editingProfile, last_name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingProfile.email || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, email: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editingProfile.phone || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, phone: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-membership-type">Membership Type</Label>
                  <Input
                    id="edit-membership-type"
                    value={editingProfile.membership_type || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, membership_type: e.target.value })}
                    className="mt-1"
                    placeholder="e.g., Premium, Basic"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-account-status">Account Access</Label>
                  <select
                    id="edit-account-status"
                    value={editingProfile.status || "Active"}
                    onChange={(e) => setEditingProfile({ ...editingProfile, status: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                  >
                    <option value="Active">Active (Can Login)</option>
                    <option value="Suspended">Suspended (Blocked)</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="edit-membership-status">Membership Status</Label>
                  <select
                    id="edit-membership-status"
                    value={editingProfile.membership_status || ""}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      let overrides: any = { membership_status: newStatus };

                      if (newStatus === "Active") {
                        // Smart Auto-Fill Dates
                        const now = new Date();
                        const todayStr = now.toISOString().split("T")[0];

                        // 1. If Last Payment Date is missing, set it to today
                        let baseDateStr = editingProfile.last_payment_date;
                        if (!baseDateStr) {
                          baseDateStr = todayStr;
                          overrides.last_payment_date = todayStr;
                        }

                        // 2. If Renewal Due Date is missing OR we want to force re-calc based on type
                        // (Only if it's currently empty to avoid overwriting manual edits, OR if we just set payment date)
                        if (!editingProfile.renewal_due_date) {
                          const baseDate = new Date(baseDateStr);
                          const type = (editingProfile.membership_type || "").toLowerCase();
                          let expiryDate = new Date(baseDate);

                          if (type.includes("day")) {
                            expiryDate.setDate(expiryDate.getDate());
                          } else if (type.includes("week")) {
                            expiryDate.setDate(expiryDate.getDate() + 7);
                          } else if (type.includes("year") || type.includes("annual")) {
                            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                          } else {
                            // Default to monthly (30 days)
                            expiryDate.setMonth(expiryDate.getMonth() + 1);
                          }
                          // Format to YYYY-MM-DD
                          overrides.renewal_due_date = expiryDate.toISOString().split("T")[0];
                        }
                      }

                      setEditingProfile({ ...editingProfile, ...overrides });
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                  >
                    <option value="">Select status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="edit-renewal-due-date">Renewal Due Date</Label>
                  <Input
                    id="edit-renewal-due-date"
                    type="date"
                    value={editingProfile.renewal_due_date ? editingProfile.renewal_due_date.split('T')[0] : ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, renewal_due_date: e.target.value || null })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-last-payment-date">Last Payment Date</Label>
                  <Input
                    id="edit-last-payment-date"
                    type="date"
                    value={editingProfile.last_payment_date ? editingProfile.last_payment_date.split('T')[0] : ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, last_payment_date: e.target.value || null })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-subscription-duration">Subscription Duration (Months)</Label>
                  <Input
                    id="edit-subscription-duration"
                    type="number"
                    value={editingProfile.subscription_duration_months || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, subscription_duration_months: e.target.value ? parseInt(e.target.value) : null })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-height">Height (cm)</Label>
                  <Input
                    id="edit-height"
                    type="number"
                    value={editingProfile.height || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, height: e.target.value ? parseFloat(e.target.value) : null })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-age">Age (yrs)</Label>
                  <Input
                    id="edit-age"
                    type="number"
                    value={editingProfile.age || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, age: e.target.value ? parseInt(e.target.value) : null })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-goal">Scientific Goal</Label>
                <Input
                  id="edit-goal"
                  value={editingProfile.goal || ""}
                  onChange={(e) => setEditingProfile({ ...editingProfile, goal: e.target.value })}
                  className="mt-1"
                  placeholder="e.g., Recomp, Fat Loss"
                />
              </div>

              <div>
                <Label htmlFor="edit-primary-objective">Primary Objective</Label>
                <Textarea
                  id="edit-primary-objective"
                  value={editingProfile.primary_objective || ""}
                  onChange={(e) => setEditingProfile({ ...editingProfile, primary_objective: e.target.value })}
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="edit-secondary-objective">Secondary Objective</Label>
                <Textarea
                  id="edit-secondary-objective"
                  value={editingProfile.secondary_objective || ""}
                  onChange={(e) => setEditingProfile({ ...editingProfile, secondary_objective: e.target.value })}
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-areas-of-caution">Areas of Caution</Label>
                  <Input
                    id="edit-areas-of-caution"
                    value={editingProfile.areas_of_caution || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, areas_of_caution: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-intensity">Intensity Clearance</Label>
                  <Input
                    id="edit-intensity"
                    value={editingProfile.intensity_clearance || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, intensity_clearance: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-training-styles">Preferred Training Styles</Label>
                  <Input
                    id="edit-training-styles"
                    value={editingProfile.preferred_training_styles || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, preferred_training_styles: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-trainer-preference">Trainer Preference</Label>
                  <Input
                    id="edit-trainer-preference"
                    value={editingProfile.trainer_preference || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, trainer_preference: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-training-env">Preferred Training Environment</Label>
                  <Input
                    id="edit-training-env"
                    value={editingProfile.preferred_training_env || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, preferred_training_env: e.target.value })}
                    className="mt-1"
                    placeholder="e.g., Quiet corner, Private area"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-timezone">Timezone</Label>
                  <Input
                    id="edit-timezone"
                    value={editingProfile.timezone || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, timezone: e.target.value })}
                    className="mt-1"
                    placeholder="e.g., GMT+2"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-travel-frequency">Travel Frequency</Label>
                  <Input
                    id="edit-travel-frequency"
                    value={editingProfile.travel_frequency || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, travel_frequency: e.target.value })}
                    className="mt-1"
                    placeholder="e.g., 2-3x per month"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-weight">Weight (kg)</Label>
                  <Input
                    id="edit-weight"
                    type="number"
                    value={editingProfile.weight || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, weight: e.target.value ? parseFloat(e.target.value) : null })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-body-fat">Body Fat %</Label>
                  <Input
                    id="edit-body-fat"
                    type="number"
                    value={editingProfile.body_fat_pct || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, body_fat_pct: e.target.value ? parseFloat(e.target.value) : null })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-waist">Waist (cm)</Label>
                  <Input
                    id="edit-waist"
                    type="number"
                    value={editingProfile.waist || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, waist: e.target.value ? parseFloat(e.target.value) : null })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-resting-hr">Resting HR (bpm)</Label>
                  <Input
                    id="edit-resting-hr"
                    type="number"
                    value={editingProfile.resting_hr || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, resting_hr: e.target.value ? parseFloat(e.target.value) : null })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-blood-pressure">Blood Pressure</Label>
                  <Input
                    id="edit-blood-pressure"
                    value={editingProfile.blood_pressure || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, blood_pressure: e.target.value })}
                    className="mt-1"
                    placeholder="e.g., 120/80"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-availability">Availability</Label>
                <Textarea
                  id="edit-availability"
                  value={editingProfile.availability || ""}
                  onChange={(e) => setEditingProfile({ ...editingProfile, availability: e.target.value })}
                  className="mt-1"
                  rows={2}
                  placeholder="e.g., Mon-Thu: 06:00-08:00"
                />
              </div>

              {/* Notification Preferences */}
              <div className="border-t pt-4">
                <Label className="text-base font-semibold mb-3 block">Notification Preferences</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-session-reminders" className="text-sm">Session Reminders</Label>
                    <input
                      id="notif-session-reminders"
                      type="checkbox"
                      checked={editingProfile.notif_session_reminders !== false}
                      onChange={(e) => setEditingProfile({ ...editingProfile, notif_session_reminders: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-checkin" className="text-sm">Check-in Prompts</Label>
                    <input
                      id="notif-checkin"
                      type="checkbox"
                      checked={editingProfile.notif_checkin !== false}
                      onChange={(e) => setEditingProfile({ ...editingProfile, notif_checkin: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-program-updates" className="text-sm">Program Updates</Label>
                    <input
                      id="notif-program-updates"
                      type="checkbox"
                      checked={editingProfile.notif_program_updates !== false}
                      onChange={(e) => setEditingProfile({ ...editingProfile, notif_program_updates: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="privacy-progress" className="text-sm">Share Progress with Coach</Label>
                    <input
                      id="privacy-progress"
                      type="checkbox"
                      checked={editingProfile.privacy_progress !== false}
                      onChange={(e) => setEditingProfile({ ...editingProfile, privacy_progress: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialog({ open: false, member: null });
                setEditingProfile(null);
              }}
              disabled={savingProfile}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile || !editingProfile?.name || !editingProfile?.email}
            >
              {savingProfile ? (
                "Saving..."
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Dialog */}
      <Dialog open={chatDialog.open} onOpenChange={(open) => {
        if (!sendingMessage) {
          setChatDialog({ open, member: null });
          setMessages([]);
          setNewMessage("");
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chat with {chatDialog.member?.name}</DialogTitle>
            <DialogDescription>
              {chatDialog.member?.email}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-[400px] max-h-[500px] border rounded-lg p-4 mb-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">Loading messages...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">No messages yet. Start the conversation!</span>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message: any) => {
                  const isAdmin = message.sender_id === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${isAdmin
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                          }`}
                      >
                        <p className="text-sm">{message.content || message.message}</p>
                        <p className={`text-xs mt-1 ${isAdmin ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}>
                          {format(new Date(message.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={sendingMessage}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sendingMessage}
            >
              {sendingMessage ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
