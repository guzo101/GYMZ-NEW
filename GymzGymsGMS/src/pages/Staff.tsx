/* @ts-nocheck */
import { useEffect, useMemo, useState, Component, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Plus, Phone, Mail, Calendar, Star, Edit, X, Check, Users, RefreshCw, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

class StaffErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            <h2 className="text-lg font-semibold">Staff Page Error</h2>
          </div>
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <p className="text-sm font-mono text-destructive break-all">{this.state.error.message}</p>
            {this.state.error.stack && (
              <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-48">{this.state.error.stack}</pre>
            )}
          </div>
          <Button onClick={() => this.setState({ error: null })} variant="outline">
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

interface StaffRecord {
  id: string;
  userId?: string | null;
  name: string;
  role: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  rating: number | null;
  experienceYears: number | null;
  status: string | null;
  avatar: string | null;
  specialties: string[] | null;
  schedule: string | null;
}

interface RoleAuditRecord {
  id: string;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  entityId: string | null;
  oldRole: string | null;
  newRole: string | null;
  reason: string | null;
}

// ── SANITIZATION LAYER (Absolute Harmony Standard) ─────────────────────────
const mapStaffRecord = (data: any): StaffRecord => ({
  id: data.id ?? "",
  userId: data.user_id ?? data.id ?? null,
  name: String(data?.name ?? "").trim() || "Unknown",
  role: data.role ?? "",
  department: data.department ?? null,
  email: data.email ?? null,
  phone: data.phone ?? null,
  rating: data.rating ?? null,
  experienceYears: data.experience_years ?? null,
  status: data.status ?? "Active",
  avatar: data.avatar ?? data.avatar_url ?? null,
  specialties: data.specialties ?? null,
  schedule: data.schedule ?? null,
});

// Map users (role=staff) to StaffRecord for promoted members
const mapUserToStaffRecord = (u: any): StaffRecord => ({
  id: u.id ?? "",
  userId: u.id ?? null,
  name: String(u?.name ?? "").trim() || u?.email || "Unknown",
  role: "staff",
  department: null,
  email: u.email ?? null,
  phone: u.phone ?? null,
  rating: null,
  experienceYears: null,
  status: u.status ?? "Active",
  avatar: u.avatar_url ?? null,
  specialties: null,
  schedule: null,
});

function StaffInner() {
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightedStaffId, setHighlightedStaffId] = useState<string | null>(null);
  const lastScrolledIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add staff dialog state
  const [addDialog, setAddDialog] = useState<{ open: boolean }>({ open: false });
  const [newStaff, setNewStaff] = useState<Partial<StaffRecord>>({
    name: "",
    role: "",
    department: "",
    email: "",
    phone: "",
    status: "Active",
    specialties: [],
    rating: 5,
    experienceYears: 0,
    schedule: ""
  });
  const [savingNewStaff, setSavingNewStaff] = useState(false);
  const [demotingStaffId, setDemotingStaffId] = useState<string | null>(null);
  const [roleAuditLogs, setRoleAuditLogs] = useState<RoleAuditRecord[]>([]);
  const [loadingRoleAudit, setLoadingRoleAudit] = useState(false);

  // Edit dialog state
  const [editDialog, setEditDialog] = useState<{ open: boolean; staff: StaffRecord | null }>({ open: false, staff: null });
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!user?.gymId) {
      setLoading(false);
      return;
    }

    fetchStaff();
    if (user.role === "admin") {
      fetchRoleAuditLogs();
    }

    // Set up real-time subscription (users with role=staff)
    const channel = supabase
      .channel('staff_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `gym_id=eq.${user.gymId}`
        },
        () => {
          fetchStaff();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.gymId, user?.role]);

  // Handle deep link from search: scroll to staff and highlight
  useEffect(() => {
    if (loading || staff.length === 0) return;
    const idQ = searchParams.get("id");
    if (!idQ || lastScrolledIdRef.current === idQ) return;
    const found = staff.find((s) => s.id === idQ || s.userId === idQ);
    if (found) {
      lastScrolledIdRef.current = idQ;
      setHighlightedStaffId(found.id);
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = document.querySelector(`[data-staff-id="${found.id}"]`) || document.querySelector(`[data-staff-id="${idQ}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      });
      setTimeout(() => {
        setHighlightedStaffId(null);
        lastScrolledIdRef.current = null;
        const np = new URLSearchParams(searchParams);
        np.delete("id");
        np.delete("highlight");
        setSearchParams(np, { replace: true });
      }, 2000);
    }
  }, [loading, staff, searchParams]);

  async function fetchStaff() {
    if (!user?.gymId) {
      setStaff([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    // Fetch from users (role=staff) - promoted members live here; staff table may not exist
    const { data, error: fetchErr } = (await db
      .from("users")
      .select("id, name, email, phone, avatar_url, status")
      .eq("gym_id", user.gymId)
      .eq("role", "staff")
      .order("name")) as any;
    if (fetchErr) {
      setError("Unable to load staff members right now.");
      setStaff([]);
    } else {
      setStaff((data ?? []).map(mapUserToStaffRecord));
    }
    setLoading(false);
  }

  async function fetchRoleAuditLogs() {
    if (!user?.gymId || user?.role !== "admin") return;
    setLoadingRoleAudit(true);
    try {
      const { data, error: fetchErr } = await db
        .from("admin_audit_logs")
        .select("id, created_at, actor_id, actor_email, entity_id, old_value, new_value, reason, actor:users!actor_id(name, email)")
        .eq("action", "role_change")
        .eq("entity_type", "users")
        .eq("gym_id", user.gymId)
        .order("created_at", { ascending: false })
        .limit(25);

      if (fetchErr) throw fetchErr;

      const mapped: RoleAuditRecord[] = (data ?? []).map((row: any) => ({
        id: row.id,
        createdAt: row.created_at,
        actorName: row.actor?.name ?? null,
        actorEmail: row.actor?.email ?? row.actor_email ?? null,
        entityId: row.entity_id ?? null,
        oldRole: row.old_value?.role ?? null,
        newRole: row.new_value?.role ?? null,
        reason: row.reason ?? null,
      }));
      setRoleAuditLogs(mapped);
    } catch (err: any) {
      toast.error("Failed to load role audit log: " + (err?.message || "Unknown error"));
      setRoleAuditLogs([]);
    } finally {
      setLoadingRoleAudit(false);
    }
  }

  const filteredStaff = useMemo(
    () =>
      staff.filter(
        (member) =>
          member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          member.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (member.department ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [staff, searchTerm]
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-primary";
      case "On Leave":
        return "bg-yellow-500";
      case "Inactive":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getDepartmentColor = (department: string) => {
    switch (department) {
      case "Yoga & Pilates":
        return "bg-primary";
      case "Strength & HIIT":
        return "bg-orange-500";
      case "Cardio":
        return "bg-primary";
      case "Dance & Aerobics":
        return "bg-secondary";
      case "Personal Training":
        return "bg-red-500";
      case "Administration":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  async function handleOpenEditDialog(staffMember: StaffRecord) {
    setEditDialog({ open: true, staff: staffMember });
    try {
      // Staff list is sourced from `users` (role=staff). Load profile from `users`
      // to avoid relying on legacy `staff` table columns that may not exist.
      const { data, error } = await db
        .from("users")
        .select("id, name, email, phone, avatar_url, status")
        .eq("id", staffMember.id)
        .eq("gym_id", user.gymId)
        .eq("role", "staff")
        .single();
      if (error) throw error;
      setEditingProfile({
        ...data,
        // Normalize to the fields used by the edit dialog + save handler
        avatar: data.avatar_url ?? null,
        role: staffMember.role ?? "staff",
        department: staffMember.department ?? null,
        rating: staffMember.rating ?? null,
        experienceYears: staffMember.experienceYears ?? null,
        specialties: staffMember.specialties ?? null,
        schedule: staffMember.schedule ?? null,
        photo: null,
        photoUrl: data.avatar_url ?? null,
      });
    } catch (err: any) {
      toast.error("Failed to load staff profile: " + (err?.message || "Unknown error"));
      setEditDialog({ open: false, staff: null });
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !e.target.files[0] || !editingProfile) return;
    const file = e.target.files[0];
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `staff_${editingProfile.id}_${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('staff-avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        // Try user-avatars bucket if staff-avatars doesn't exist
        const { data: uploadData2, error: uploadError2 } = await supabase.storage
          .from('user-avatars')
          .upload(fileName, file, { upsert: true });
        if (uploadError2) throw uploadError2;
        const { data: urlData2 } = supabase.storage.from('user-avatars').getPublicUrl(fileName);
        if (urlData2?.publicUrl) {
          setEditingProfile({ ...editingProfile, avatar: urlData2.publicUrl, photoUrl: urlData2.publicUrl });
        }
      } else {
        const { data: urlData } = supabase.storage.from('staff-avatars').getPublicUrl(fileName);
        if (urlData?.publicUrl) {
          setEditingProfile({ ...editingProfile, avatar: urlData.publicUrl, photoUrl: urlData.publicUrl });
        }
      }
    } catch (err: any) {
      toast.error("Failed to upload avatar: " + (err?.message || "Unknown error"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  function handleSpecialtyChange(index: number, value: string) {
    if (!editingProfile) return;
    const newSpecialties = [...(editingProfile.specialties || [])];
    newSpecialties[index] = value;
    setEditingProfile({ ...editingProfile, specialties: newSpecialties });
  }

  function addSpecialty() {
    if (!editingProfile) return;
    setEditingProfile({ ...editingProfile, specialties: [...(editingProfile.specialties || []), ""] });
  }

  function removeSpecialty(index: number) {
    if (!editingProfile) return;
    setEditingProfile({ ...editingProfile, specialties: (editingProfile.specialties || []).filter((_: any, i: number) => i !== index) });
  }

  async function handleSaveProfile() {
    if (!editingProfile || !editDialog.staff) return;
    setSavingProfile(true);
    try {
      // Staff records come from users table; update users
      const updateData: any = {
        name: editingProfile.name,
        email: editingProfile.email || null,
        phone: editingProfile.phone || null,
        avatar_url: editingProfile.avatar || editingProfile.photoUrl || null,
        status: editingProfile.status || "Active",
      };

      const { error } = await db
        .from("users")
        .update(updateData)
        .eq("id", editDialog.staff.id);

      if (error) throw error;

      // Update local staff list
      await fetchStaff();
      toast.success("Staff profile updated successfully!");
      setEditDialog({ open: false, staff: null });
      setEditingProfile(null);
    } catch (err: any) {
      toast.error("Failed to update profile: " + (err?.message || "Unknown error"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveNewStaff() {
    if (!newStaff.name) {
      toast.error("Name is required");
      return;
    }
    if (!newStaff.email?.trim()) {
      toast.error("Email is required for adding staff. The person must be an existing member.");
      return;
    }
    setSavingNewStaff(true);
    try {
      // Staff are stored in users (role=staff). Promote existing member via RPC.
      const { data: existingUser, error: lookupErr } = await db
        .from("users")
        .select("id, role")
        .eq("email", newStaff.email.trim())
        .eq("gym_id", user.gymId)
        .maybeSingle();

      if (lookupErr) throw lookupErr;

      if (!existingUser) {
        toast.error("No member found with this email in your gym. Add them as a member first via the Members page, or invite them to join.");
        return;
      }

      if (existingUser.role === "staff") {
        toast.info("This person is already a staff member.");
        return;
      }

      if (existingUser.role !== "member") {
        toast.error("Only members can be promoted to staff.");
        return;
      }

      const { error: rpcError } = await supabase.rpc("promote_member_to_staff", {
        p_user_id: existingUser.id,
      } as any);

      if (rpcError) throw rpcError;

      // Update profile fields (name, phone, status) in users
      const updatePayload: Record<string, unknown> = {
        name: newStaff.name.trim(),
        phone: newStaff.phone || null,
        status: newStaff.status || "Active",
      };
      await db.from("users").update(updatePayload).eq("id", existingUser.id);

      toast.success("Staff member added successfully!");
      setAddDialog({ open: false });
      setNewStaff({
        name: "",
        role: "",
        department: "",
        email: "",
        phone: "",
        status: "Active",
        specialties: [],
        rating: 5,
        experienceYears: 0,
        schedule: ""
      });
      await fetchStaff();
      await fetchRoleAuditLogs();
    } catch (err: any) {
      toast.error("Failed to add staff: " + (err?.message || "Unknown error"));
    } finally {
      setSavingNewStaff(false);
    }
  }

  async function handleDemoteStaff(staffMember: StaffRecord) {
    if (!user || user.role !== "admin") {
      toast.error("Only admins can revoke staff access.");
      return;
    }

    setDemotingStaffId(staffMember.id);
    try {
      let targetUserId = staffMember.userId || null;

      // Fallback resolution for legacy staff rows that don't carry user_id.
      if (!targetUserId && staffMember.email) {
        const { data: userByEmail, error: userErr } = await db
          .from("users")
          .select("id")
          .eq("email", staffMember.email)
          .eq("gym_id", user.gymId)
          .eq("role", "staff")
          .maybeSingle();

        if (userErr) throw userErr;
        targetUserId = userByEmail?.id || null;
      }

      if (!targetUserId) {
        toast.error("No linked staff account found for this staff record.");
        return;
      }

      const { error: rpcError } = await supabase.rpc("demote_staff_to_member", {
        p_user_id: targetUserId,
      } as any);

      if (rpcError) throw rpcError;

      toast.success(`${staffMember.name} demoted to member successfully.`);
      await fetchStaff();
      await fetchRoleAuditLogs();
    } catch (err: any) {
      toast.error("Failed to demote staff: " + (err?.message || "Unknown error"));
    } finally {
      setDemotingStaffId(null);
    }
  }

  // Auth still resolving - show visible loading state
  if (authLoading) {
    return (
      <div className="space-y-6 min-h-[60vh] flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="h-9 w-48 bg-muted animate-pulse rounded-md" />
          <div className="h-10 w-40 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[140px] bg-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-foreground font-medium">Loading Staff...</p>
            <p className="text-sm text-muted-foreground mt-1">Please wait</p>
          </div>
        </div>
      </div>
    );
  }

  // User has no gym - show clear message (admin/staff must have gym)
  if (user && !user.gymId) {
    return (
      <div className="space-y-6 min-h-[60vh] flex flex-col">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff</h1>
          <nav className="text-sm text-muted-foreground">Home / Staff</nav>
        </div>
        <Card className="flex-1 flex items-center justify-center min-h-[300px] border-2 border-dashed border-muted-foreground/30">
          <CardContent className="py-16 text-center">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Gym Assigned</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your account is not linked to a gym yet. Please contact your administrator to assign your account to a gym before managing staff.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-[60vh]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff</h1>
          <nav className="text-sm text-muted-foreground">
            Home / Staff
          </nav>
        </div>
        <Button
          onClick={() => setAddDialog({ open: true })}
          disabled={!user?.gymId}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {/* Premium Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <StatsCard
          title="Total Staff"
          value={staff.length}
          icon={Users}
          trend="neutral"
        />
        <StatsCard
          title="Active Staff"
          value={staff.filter(s => s.status === "Active").length}
          icon={Check}
          trend="up"
        />
        <StatsCard
          title="Avg Rating"
          value={staff.length > 0 ? (staff.reduce((s, m) => s + (Number(m.rating) || 0), 0) / staff.length).toFixed(1) : "5.0"}
          icon={Star}
          trend="up"
        />
      </div>

      {/* Role Change Audit Log */}
      {user?.role === "admin" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Role Changes Audit</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRoleAuditLogs}
                disabled={loadingRoleAudit}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingRoleAudit ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingRoleAudit ? (
              <div className="py-6 text-sm text-muted-foreground">Loading audit log...</div>
            ) : roleAuditLogs.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">No role changes recorded yet.</div>
            ) : (
              <div className="space-y-3">
                {roleAuditLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <p className="text-sm font-medium">
                        {log.oldRole || "unknown"} → {log.newRole || "unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : "Unknown time"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      By: {log.actorName || log.actorEmail || "Unknown admin"} • User ID: {log.entityId || "Unknown"}
                    </p>
                    {log.reason && (
                      <p className="text-xs mt-1">{log.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card className="bg-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Filter by Department
              </Button>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule View
              </Button>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-full bg-muted animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    <div className="flex gap-2">
                      <div className="h-5 w-20 bg-muted animate-pulse rounded" />
                      <div className="h-5 w-16 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                    <div className="flex gap-2 pt-2">
                      <div className="h-9 flex-1 bg-muted animate-pulse rounded" />
                      <div className="h-9 flex-1 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredStaff.map((member) => (
            <Card key={member.id} data-staff-id={member.id} className={`hover:shadow-md transition-all cursor-pointer ${highlightedStaffId === member.id ? "ring-2 ring-primary ring-offset-2 shadow-lg shadow-primary/20 animate-pulse" : ""}`} onClick={() => handleOpenEditDialog(member)}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                        {((member.name || "?").split(" ").map((part) => part[0]).join("").slice(0, 2) || "?").toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{member.name || "Unknown"}</h3>
                        <p className="text-sm text-muted-foreground">{member.role || "—"}</p>
                      </div>
                      <Badge className={`${getStatusColor(member.status || "Active")} text-white`}>
                        {member.status || "Active"}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2">
                        <Badge className={`${getDepartmentColor(member.department || "")} text-white text-xs`}>
                          {member.department || "General"}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          <span className="text-xs">{member.rating ?? "N/A"}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {member.experienceYears ? `${member.experienceYears} years` : "Experience TBD"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="text-xs">{member.email || "No email"}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="text-xs">{member.phone || "No phone"}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span className="text-xs">Schedule: {member.schedule || "TBD"}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Specialties:</p>
                      <div className="flex flex-wrap gap-1">
                        {member.specialties?.length ? (
                          member.specialties.map((specialty, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {specialty}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No specialties listed</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditDialog(member);
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      {user?.role === "admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDemoteStaff(member);
                          }}
                          disabled={demotingStaffId === member.id}
                        >
                          {demotingStaffId === member.id ? "..." : "Revoke Staff"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredStaff.length === 0 && (
        <Card className="border-2 border-dashed border-muted">
          <CardContent className="py-16 text-center">
            <Users className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No staff members found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {searchTerm ? "Try adjusting your search terms." : "Get started by adding your first staff member."}
            </p>
            {!searchTerm && user?.gymId && (
              <Button className="mt-4" onClick={() => setAddDialog({ open: true })}>
                <Plus className="h-4 w-4 mr-2" />
                Add Staff Member
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => {
        if (!savingProfile) {
          setEditDialog({ open, staff: null });
          setEditingProfile(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Staff Profile</DialogTitle>
            <DialogDescription>
              Edit profile information for {editDialog.staff?.name}
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
                <div>
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingProfile.name || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
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
                  <Label htmlFor="edit-role">Role</Label>
                  <Input
                    id="edit-role"
                    value={editingProfile.role || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, role: e.target.value })}
                    className="mt-1"
                    placeholder="e.g., Personal Trainer"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-department">Department</Label>
                  <Input
                    id="edit-department"
                    value={editingProfile.department || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, department: e.target.value })}
                    className="mt-1"
                    placeholder="e.g., Strength & HIIT"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <select
                    id="edit-status"
                    value={editingProfile.status || "Active"}
                    onChange={(e) => setEditingProfile({ ...editingProfile, status: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="edit-rating">Rating (0-5)</Label>
                  <Input
                    id="edit-rating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={editingProfile.rating || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, rating: e.target.value ? parseFloat(e.target.value) : null })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-experience">Experience (Years)</Label>
                  <Input
                    id="edit-experience"
                    type="number"
                    value={editingProfile.experienceYears || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, experienceYears: e.target.value ? parseFloat(e.target.value) : null })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-schedule">Schedule</Label>
                <Textarea
                  id="edit-schedule"
                  value={editingProfile.schedule || ""}
                  onChange={(e) => setEditingProfile({ ...editingProfile, schedule: e.target.value })}
                  className="mt-1"
                  rows={2}
                  placeholder="e.g., Mon-Fri: 6am-2pm, Sat: 8am-12pm"
                />
              </div>

              <div>
                <Label>Specialties</Label>
                <div className="space-y-2 mt-1">
                  {(editingProfile.specialties || []).map((specialty: string, index: number) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={specialty}
                        onChange={(e) => handleSpecialtyChange(index, e.target.value)}
                        placeholder="Enter specialty"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeSpecialty(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSpecialty}
                  >
                    + Add Specialty
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialog({ open: false, staff: null });
                setEditingProfile(null);
              }}
              disabled={savingProfile}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile || !editingProfile?.name}
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

      {/* Add Staff Dialog */}
      <Dialog open={addDialog.open} onOpenChange={(open) => {
        if (!savingNewStaff) {
          setAddDialog({ open: open });
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
            <DialogDescription>
              Promote an existing member to staff. Email is required — the person must already be a member in your gym.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-name">Name *</Label>
                <Input
                  id="new-name"
                  value={newStaff.name || ""}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="mt-1"
                  placeholder="Full name"
                />
              </div>
              <div>
                <Label htmlFor="new-email">Email *</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newStaff.email || ""}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="mt-1"
                  placeholder="Member's email (must exist in your gym)"
                />
              </div>
              <div>
                <Label htmlFor="new-phone">Phone</Label>
                <Input
                  id="new-phone"
                  value={newStaff.phone || ""}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="mt-1"
                  placeholder="+123..."
                />
              </div>
              <div>
                <Label htmlFor="new-role">Role</Label>
                <Input
                  id="new-role"
                  value={newStaff.role || ""}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="mt-1"
                  placeholder="e.g., Personal Trainer"
                />
              </div>
              <div>
                <Label htmlFor="new-department">Department</Label>
                <Input
                  id="new-department"
                  value={newStaff.department || ""}
                  onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })}
                  className="mt-1"
                  placeholder="e.g., Strength & HIIT"
                />
              </div>
              <div>
                <Label htmlFor="new-status">Status</Label>
                <select
                  id="new-status"
                  value={newStaff.status || "Active"}
                  onChange={(e) => setNewStaff({ ...newStaff, status: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <Label htmlFor="new-rating">Rating (0-5)</Label>
                <Input
                  id="new-rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={newStaff.rating || 5}
                  onChange={(e) => setNewStaff({ ...newStaff, rating: e.target.value ? parseFloat(e.target.value) : 5 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="new-experience">Experience (Years)</Label>
                <Input
                  id="new-experience"
                  type="number"
                  value={newStaff.experienceYears || 0}
                  onChange={(e) => setNewStaff({ ...newStaff, experienceYears: e.target.value ? parseFloat(e.target.value) : 0 })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="new-schedule">Schedule</Label>
              <Textarea
                id="new-schedule"
                value={newStaff.schedule || ""}
                onChange={(e) => setNewStaff({ ...newStaff, schedule: e.target.value })}
                className="mt-1"
                rows={2}
                placeholder="e.g., Mon-Fri: 6am-2pm, Sat: 8am-12pm"
              />
            </div>

            <div>
              <Label>Specialties</Label>
              <div className="space-y-2 mt-1">
                {(newStaff.specialties || []).map((specialty, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={specialty}
                      onChange={(e) => {
                        const s = [...(newStaff.specialties || [])];
                        s[index] = e.target.value;
                        setNewStaff({ ...newStaff, specialties: s });
                      }}
                      placeholder="Enter specialty"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const s = (newStaff.specialties || []).filter((_, i) => i !== index);
                        setNewStaff({ ...newStaff, specialties: s });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewStaff({ ...newStaff, specialties: [...(newStaff.specialties || []), ""] })}
                >
                  + Add Specialty
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialog({ open: false });
              }}
              disabled={savingNewStaff}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveNewStaff}
              disabled={savingNewStaff || !newStaff.name || !newStaff.email?.trim()}
            >
              {savingNewStaff ? (
                "Saving..."
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Add Staff Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Staff() {
  return (
    <StaffErrorBoundary>
      <StaffInner />
    </StaffErrorBoundary>
  );
}
