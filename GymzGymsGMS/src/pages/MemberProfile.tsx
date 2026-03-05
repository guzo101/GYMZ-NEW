/* @ts-nocheck */
import { useState, useEffect, Suspense, lazy } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Edit2, Check, X, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { DataMapper } from "@/utils/dataMapper";
// QR Code component - lazy loaded to prevent blocking app startup
const MemberQRCode = lazy(() =>
  import("@/member/components/MemberQRCode").then(module => ({
    default: module.MemberQRCode
  })).catch(() => ({
    default: () => <div className="p-4 border rounded-lg text-sm text-muted-foreground">QR code unavailable</div>
  }))
);

const db = {
  from: (...args) => (supabase).from(...args),
};

export default function MemberProfile() {
  const { user, login } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    name: "",
    email: "",
    phone: "",
    photoUrl: null,
    gender: "",
    uniqueId: "",
    membershipType: "",
    membershipStatus: "",
    renewalDueDate: null,
    lastPaymentDate: null,
    subscriptionDurationMonths: 1,
    primaryObjective: "",
    secondaryObjective: "",
    areasOfCaution: "",
    intensityClearance: "",
    preferredTrainingStyles: "",
    trainerPreference: "",
    preferredTrainingEnv: "",
    availability: "",
    timezone: "",
    travelFrequency: "",
    weight: null,
    bodyFatPct: null,
    waist: null,
    restingHr: null,
    bloodPressure: "",
    height: null,
    age: null,
    goal: "",
    calculatedBmi: null,
    privacyProgress: true,
    notifSessionReminders: true,
    notifCheckin: true,
    notifProgramUpdates: true,
    photo: null as File | null,
  });

  // ── SANITIZATION LAYER (Absolute Harmony Standard via DataMapper) ──
  const mapMemberProfile = (data: any): any => DataMapper.fromDb<any>(data);

  // Calculate renewal due date from payment date + subscription duration
  function calculateRenewalDueDate(paymentDate, durationMonths) {
    if (!paymentDate || !durationMonths) return null;
    const paidDate = new Date(paymentDate);
    const dueDate = new Date(paidDate);
    dueDate.setMonth(dueDate.getMonth() + durationMonths);
    return dueDate.toISOString().split('T')[0]; // Return as YYYY-MM-DD
  }

  // Fetch full profile on mount
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setFetching(true);
      // Fetch user data
      const { data: userData, error: userError } = await db.from("users").select("*").eq("id", user.id).single();
      if (userError || !userData) {
        setFetching(false);
        return;
      }

      // Fetch latest payment for display purposes
      const { data: latestPayment } = await db
        .from("payments")
        .select("paid_at, subscription_duration_months")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("paid_at", { ascending: false })
        .limit(1)
        .single();

      // Use the stored renewal_due_date (already calculated with accumulation logic in payment approval)
      // Only recalculate if renewal_due_date is missing and we have payment data
      let renewalDueDate = userData.renewal_due_date || null;

      // Only recalculate if renewal_due_date is missing and we have payment data
      if (!renewalDueDate && latestPayment?.paid_at) {
        const duration = latestPayment.subscription_duration_months || userData.subscription_duration_months || 1;
        renewalDueDate = calculateRenewalDueDate(latestPayment.paid_at, duration);

        // Update user's renewal_due_date in database
        try {
          await db.from("users").update({
            renewal_due_date: renewalDueDate,
            last_payment_date: latestPayment.paid_at,
            subscription_duration_months: duration
          }).eq("id", user.id);
        } catch (err) {
          console.warn("Failed to update renewal due date", err);
        }
      } else if (!renewalDueDate && userData.last_payment_date && userData.subscription_duration_months) {
        // Fallback: calculate from stored last_payment_date if renewal_due_date is missing
        renewalDueDate = calculateRenewalDueDate(userData.last_payment_date, userData.subscription_duration_months);
      }

      // Get unique_id (generate in background if missing - don't block profile load)
      let uniqueId = userData.unique_id;
      if (!uniqueId) {
        // Generate in background without blocking
        import("@/lib/utils").then(({ generateAndVerifyUniqueUserId }) => {
          generateAndVerifyUniqueUserId(db)
            .then(async (newUniqueId) => {
              await db
                .from("users")
                .update({ unique_id: newUniqueId })
                .eq("id", user.id);
              // Update profile state if component is still mounted
              setProfile((prev) => ({ ...prev, unique_id: newUniqueId }));
            })
            .catch((err) => {
              console.warn("Failed to generate unique_id in background:", err);
            });
        });
      }

      setProfile({
        ...mapMemberProfile(userData),
        lastPaymentDate: latestPayment?.paid_at || userData.last_payment_date || null,
        subscriptionDurationMonths: latestPayment?.subscription_duration_months || userData.subscription_duration_months || 1,
        renewalDueDate: renewalDueDate,
        uniqueId: uniqueId || "",
        photo: null,
      });
      setFetching(false);
    })();
  }, [user?.id]);

  // Auto-create due date reminder notifications
  useEffect(() => {
    if (!user?.id || !profile.renewalDueDate || fetching) return;

    (async () => {
      const today = new Date();
      const due = new Date(profile.renewalDueDate);
      const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (isNaN(diff)) return;

      let message = "";
      let shouldCreate = false;

      if (diff < 0) {
        // Overdue - create daily reminder
        message = `Membership renewal is overdue by ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''}. Please renew to continue access.`;
        shouldCreate = true;
      } else if (diff === 0) {
        message = "Your membership renewal is due today. Please renew to continue access.";
        shouldCreate = true;
      } else if (diff <= 5) {
        message = `Your membership renewal is due in ${diff} day${diff !== 1 ? 's' : ''}. Please renew to continue access.`;
        shouldCreate = true;
      }

      if (shouldCreate) {
        // Check if notification already exists for today
        const todayStr = today.toISOString().split('T')[0];
        const { data: existing } = await db.from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "renewal_reminder")
          .gte("created_at", todayStr)
          .limit(1);

        if (!existing || existing.length === 0) {
          try {
            await db.from("notifications").insert({
              message,
              user_id: user.id,
              type: "renewal_reminder"
            });
          } catch (err) {
            console.warn("Failed to create renewal reminder", err);
          }
        }
      }
    })();
  }, [user?.id, profile.renewalDueDate, fetching]);

  function calculateDaysUntilDue(dueDate) {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function getDueDateStatus(days) {
    if (days === null) return { label: "Not set", color: "bg-gray-100 text-gray-600" };
    if (days < 0) return { label: `Overdue by ${Math.abs(days)} days`, color: "bg-red-100 text-red-700" };
    if (days === 0) return { label: "Due today", color: "bg-orange-100 text-orange-700" };
    if (days <= 5) return { label: `${days} days remaining`, color: "bg-amber-100 text-amber-700" };
    return { label: `${days} days remaining`, color: "bg-green-100 text-green-700" };
  }

  function calculateCompleteness() {
    const fields = [
      profile.firstName,
      profile.lastName,
      profile.email,
      profile.phone,
      profile.primaryObjective,
      profile.areasOfCaution,
      profile.preferredTrainingStyles,
      profile.availability,
      profile.weight,
      profile.renewalDueDate,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    let avatarUrl = profile.photoUrl;
    try {
      const fullName = `${profile.firstName} ${profile.lastName}`.trim();
      if (profile.photo) {
        const file = profile.photo;
        const ext = file.name.split('.').pop();
        const fileName = `user_${user.id}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('user-avatars')
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('user-avatars').getPublicUrl(fileName);
        if (urlData?.publicUrl) {
          avatarUrl = urlData.publicUrl;
        }
      }

      const updates = DataMapper.toDb({
        firstName: profile.firstName,
        lastName: profile.lastName,
        name: fullName,
        email: profile.email,
        phone: profile.phone,
        gender: profile.gender || null,
        membershipType: profile.membershipType || null,
        membershipStatus: profile.membershipStatus || null,
        renewalDueDate: profile.renewalDueDate || null,
        lastPaymentDate: profile.lastPaymentDate || null,
        subscriptionDurationMonths: profile.subscriptionDurationMonths || null,
        primaryObjective: profile.goal || profile.primaryObjective,
        secondaryObjective: profile.secondaryObjective,
        areasOfCaution: profile.areasOfCaution,
        intensityClearance: profile.intensityClearance,
        preferredTrainingStyles: profile.preferredTrainingStyles,
        trainerPreference: profile.trainerPreference,
        preferredTrainingEnv: profile.preferredTrainingEnv,
        availability: profile.availability,
        timezone: profile.timezone,
        travelFrequency: profile.travelFrequency,
        weight: profile.weight,
        bodyFatPct: profile.bodyFatPct,
        waist: profile.waist,
        restingHr: profile.restingHr,
        bloodPressure: profile.bloodPressure,
        height: profile.height,
        age: profile.age,
        privacyProgress: profile.privacyProgress,
        notifSessionReminders: profile.notifSessionReminders,
        notifCheckin: profile.notifCheckin,
        notifProgramUpdates: profile.notifProgramUpdates,
        avatarUrl: avatarUrl,
      });

      const { data: updateData, error: updateErr } = await db.from("users").update(updates).eq("id", user.id).select();

      if (updateErr) {
        throw updateErr;
      }
      try {
        await db.from("notifications").insert({
          message: `Profile updated: ${fullName}`,
          user_id: user.id,
          type: "profile_update"
        });
      } catch (notifyErr) {
        console.warn("Notification insert failed", notifyErr);
      }
      const { data: updatedUser } = await db.from("users").select("*").eq("id", user.id).single();
      if (updatedUser) {
        setProfile(p => ({ ...p, ...mapMemberProfile(updatedUser), photo: null, photoUrl: updatedUser.avatar_url }));
        login({
          id: updatedUser.id,
          uniqueId: updatedUser.unique_id || user.uniqueId,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          avatarUrl: updatedUser.avatar_url,
          phone: updatedUser.phone,
          goal: updatedUser.primary_objective || updatedUser.goal,
        });

        toast({
          title: "Profile Updated",
          description: "Your profile has been successfully updated.",
        });
      }
      setEditMode(false);
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  }

  function onPhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setProfile(p => ({ ...p, photo: file, photoUrl: URL.createObjectURL(file) }));
  }

  const daysUntilDue = calculateDaysUntilDue(profile.renewalDueDate);
  const dueStatus = getDueDateStatus(daysUntilDue);
  const completeness = calculateCompleteness();

  if (fetching) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-center text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  // Check if user needs to subscribe - check membership status
  const needsSubscription = !profile.membershipStatus || profile.membershipStatus.toLowerCase() !== "active";

  return (
    <div className="relative">

      <div className="max-w-6xl mx-auto py-8 space-y-6">
        {/* Header with Profile Completeness */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground mt-1">Manage your membership and preferences</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Profile Complete</div>
              <div className="text-2xl font-bold">{completeness}%</div>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-primary" style={{
              background: `conic-gradient(from 0deg, hsl(var(--primary)) ${completeness * 3.6}deg, hsl(var(--muted)) ${completeness * 3.6}deg)`
            }}></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Membership & Renewal Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Membership & Renewal</CardTitle>
                  {!editMode && (
                    <Button variant="ghost" size="sm" onClick={() => setEditMode(true)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editMode ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>First Name *</Label>
                        <Input
                          value={profile.firstName}
                          onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))}
                          placeholder="First Name"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Last Name *</Label>
                        <Input
                          value={profile.lastName}
                          onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))}
                          placeholder="Last Name"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={profile.email}
                          onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                          placeholder="Enter your email"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={profile.phone}
                          onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                          placeholder="Enter your phone number"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Gender</Label>
                        <select
                          value={profile.gender}
                          onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                        >
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                      <div>
                        <Label>Membership Type</Label>
                        <Input
                          value={profile.membershipType}
                          onChange={e => setProfile(p => ({ ...p, membershipType: e.target.value }))}
                          placeholder="e.g., Premium, Basic"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Membership Status</Label>
                        <select
                          value={profile.membershipStatus}
                          onChange={e => setProfile(p => ({ ...p, membershipStatus: e.target.value }))}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                        >
                          <option value="">Select status</option>
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Suspended">Suspended</option>
                        </select>
                      </div>
                      <div>
                        <Label>Renewal Due Date</Label>
                        <Input
                          type="date"
                          value={profile.renewalDueDate ? profile.renewalDueDate.split('T')[0] : ""}
                          onChange={e => setProfile(p => ({ ...p, renewalDueDate: e.target.value || null }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Last Payment Date</Label>
                        <Input
                          type="date"
                          value={profile.lastPaymentDate ? (typeof profile.lastPaymentDate === 'string' ? profile.lastPaymentDate.split('T')[0] : new Date(profile.lastPaymentDate).toISOString().split('T')[0]) : ""}
                          onChange={e => setProfile(p => ({ ...p, lastPaymentDate: e.target.value || null }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Subscription Duration (Months)</Label>
                        <Input
                          type="number"
                          value={profile.subscriptionDurationMonths || ""}
                          onChange={e => setProfile(p => ({ ...p, subscriptionDurationMonths: e.target.value ? parseInt(e.target.value) : 1 }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Member ID</Label>
                      <div className="mt-1 font-semibold text-lg font-mono">{profile.uniqueId || "Not assigned"}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Email</Label>
                      <div className="mt-1 font-semibold">{profile.email || "Not set"}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Phone</Label>
                      <div className="mt-1 font-semibold">{profile.phone || "Not set"}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Gender</Label>
                      <div className="mt-1 font-semibold">{profile.gender || "Not set"}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Membership Type</Label>
                      <div className="mt-1 font-semibold">{profile.membershipType || "Not set"}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Status</Label>
                      <div className="mt-1">
                        <Badge variant={profile.membershipStatus === "Active" ? "default" : "secondary"}>
                          {profile.membershipStatus || "Not set"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Renewal Due Date</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {profile.renewalDueDate
                        ? new Date(profile.renewalDueDate).toLocaleDateString()
                        : "Not set"}
                    </span>
                    {daysUntilDue !== null && (
                      <Badge className={dueStatus.color}>{dueStatus.label}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {profile.lastPaymentDate && profile.subscriptionDurationMonths
                      ? `Calculated from last payment (${new Date(profile.lastPaymentDate).toLocaleDateString()}) + ${profile.subscriptionDurationMonths} month${profile.subscriptionDurationMonths !== 1 ? 's' : ''}`
                      : "Based on your subscription plan"}
                  </p>
                </div>
                {profile.lastPaymentDate && (
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase">Last Payment Date</Label>
                    <div className="mt-1 text-sm">
                      {new Date(profile.lastPaymentDate).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {profile.subscriptionDurationMonths && (
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase">Subscription Duration</Label>
                    <div className="mt-1 text-sm">
                      {profile.subscriptionDurationMonths} month{profile.subscriptionDurationMonths !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Primary Objective Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Primary Objective</CardTitle>
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Primary Scientific Goal</Label>
                      <Input
                        value={profile.goal}
                        onChange={e => setProfile(p => ({ ...p, goal: e.target.value }))}
                        placeholder="e.g., Recomp, Fat Loss"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Detailed Objectives</Label>
                      <Textarea
                        value={profile.primaryObjective}
                        onChange={e => setProfile(p => ({ ...p, primaryObjective: e.target.value }))}
                        placeholder="e.g., Maintain lean muscle"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>Secondary Objective (Optional)</Label>
                      <Textarea
                        value={profile.secondaryObjective}
                        onChange={e => setProfile(p => ({ ...p, secondaryObjective: e.target.value }))}
                        placeholder="e.g., Posture & core stability"
                        rows={2}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profile.goal && (
                      <div className="mb-2">
                        <Label className="text-xs text-muted-foreground uppercase">Scientific Goal</Label>
                        <div className="text-primary font-bold uppercase tracking-wider">{profile.goal.replace(/_/g, ' ')}</div>
                      </div>
                    )}
                    <Label className="text-xs text-muted-foreground uppercase">Detailed Objective</Label>
                    <p className="text-sm">{profile.primaryObjective || "Not set"}</p>
                    {profile.secondaryObjective && (
                      <p className="text-sm text-muted-foreground">{profile.secondaryObjective}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Health & Constraints Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Health & Considerations</CardTitle>
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Areas of Caution</Label>
                      <Input
                        value={profile.areasOfCaution}
                        onChange={e => setProfile(p => ({ ...p, areasOfCaution: e.target.value }))}
                        placeholder="e.g., Lower back, left knee"
                      />
                    </div>
                    <div>
                      <Label>Intensity Clearance</Label>
                      <Input
                        value={profile.intensityClearance}
                        onChange={e => setProfile(p => ({ ...p, intensityClearance: e.target.value }))}
                        placeholder="e.g., Moderate-High"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Areas of Caution</Label>
                      <p className="mt-1 text-sm">{profile.areasOfCaution || "None specified"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Intensity Clearance</Label>
                      <p className="mt-1 text-sm">{profile.intensityClearance || "Not specified"}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Training Preferences Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Training Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Preferred Training Styles</Label>
                      <Input
                        value={profile.preferredTrainingStyles}
                        onChange={e => setProfile(p => ({ ...p, preferredTrainingStyles: e.target.value }))}
                        placeholder="e.g., Strength, Conditioning, Boxing"
                      />
                    </div>
                    <div>
                      <Label>Trainer Preference</Label>
                      <Input
                        value={profile.trainerPreference}
                        onChange={e => setProfile(p => ({ ...p, trainerPreference: e.target.value }))}
                        placeholder="e.g., Female trainer only"
                      />
                    </div>
                    <div>
                      <Label>Preferred Training Environment</Label>
                      <Input
                        value={profile.preferredTrainingEnv}
                        onChange={e => setProfile(p => ({ ...p, preferredTrainingEnv: e.target.value }))}
                        placeholder="e.g., Quiet corner, Private area"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Training Styles</Label>
                      <p className="mt-1 text-sm">{profile.preferredTrainingStyles || "Not specified"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Trainer Preference</Label>
                      <p className="mt-1 text-sm">{profile.trainerPreference || "No preference"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Environment</Label>
                      <p className="mt-1 text-sm">{profile.preferredTrainingEnv || "No preference"}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Availability & Lifestyle Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Availability & Lifestyle</CardTitle>
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Preferred Training Windows</Label>
                      <Textarea
                        value={profile.availability}
                        onChange={e => setProfile(p => ({ ...p, availability: e.target.value }))}
                        placeholder="e.g., Mon-Thu: 06:00-08:00, Sat: 09:00-11:00"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Timezone</Label>
                        <Input
                          value={profile.timezone}
                          onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}
                          placeholder="e.g., GMT+2"
                        />
                      </div>
                      <div>
                        <Label>Travel Frequency</Label>
                        <Input
                          value={profile.travelFrequency}
                          onChange={e => setProfile(p => ({ ...p, travelFrequency: e.target.value }))}
                          placeholder="e.g., 2-3x per month"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Availability</Label>
                      <p className="mt-1 text-sm">{profile.availability || "Not specified"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase">Timezone</Label>
                        <p className="mt-1 text-sm">{profile.timezone || "Not set"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase">Travel Frequency</Label>
                        <p className="mt-1 text-sm">{profile.travelFrequency || "Not specified"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Body Metrics Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Body Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Weight (kg)</Label>
                      <Input
                        type="number"
                        value={profile.weight || ""}
                        onChange={e => setProfile(p => ({ ...p, weight: e.target.value ? parseFloat(e.target.value) : null }))}
                      />
                    </div>
                    <div>
                      <Label>Height (cm)</Label>
                      <Input
                        type="number"
                        value={profile.height || ""}
                        onChange={e => setProfile(p => ({ ...p, height: e.target.value ? parseFloat(e.target.value) : null }))}
                      />
                    </div>
                    <div>
                      <Label>Age (yrs)</Label>
                      <Input
                        type="number"
                        value={profile.age || ""}
                        onChange={e => setProfile(p => ({ ...p, age: e.target.value ? parseInt(e.target.value) : null }))}
                      />
                    </div>
                    <div>
                      <Label>Body Fat %</Label>
                      <Input
                        type="number"
                        value={profile.bodyFatPct || ""}
                        onChange={e => setProfile(p => ({ ...p, bodyFatPct: e.target.value ? parseFloat(e.target.value) : null }))}
                      />
                    </div>
                    <div>
                      <Label>Waist (cm)</Label>
                      <Input
                        type="number"
                        value={profile.waist || ""}
                        onChange={e => setProfile(p => ({ ...p, waist: e.target.value ? parseFloat(e.target.value) : null }))}
                      />
                    </div>
                    <div>
                      <Label>Resting HR (bpm)</Label>
                      <Input
                        type="number"
                        value={profile.restingHr || ""}
                        onChange={e => setProfile(p => ({ ...p, restingHr: e.target.value ? parseFloat(e.target.value) : null }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Blood Pressure</Label>
                      <Input
                        value={profile.bloodPressure}
                        onChange={e => setProfile(p => ({ ...p, bloodPressure: e.target.value }))}
                        placeholder="e.g., 120/80"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Weight</Label>
                      <p className="mt-1 text-sm font-medium">{profile.weight ? `${profile.weight} kg` : "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Height</Label>
                      <p className="mt-1 text-sm font-medium">{profile.height ? `${profile.height} cm` : "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">BMI (Calculated)</Label>
                      <p className="mt-1 text-sm font-medium">{profile.calculatedBmi || "--"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Age</Label>
                      <p className="mt-1 text-sm font-medium">{profile.age ? `${profile.age} yrs` : "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Body Fat %</Label>
                      <p className="mt-1 text-sm font-medium">{profile.bodyFatPct ? `${profile.bodyFatPct}%` : "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Waist</Label>
                      <p className="mt-1 text-sm font-medium">{profile.waist ? `${profile.waist} cm` : "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Resting HR</Label>
                      <p className="mt-1 text-sm font-medium">{profile.restingHr ? `${profile.restingHr} bpm` : "Not set"}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground uppercase">Blood Pressure</Label>
                      <p className="mt-1 text-sm font-medium">{profile.bloodPressure || "Not set"}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* QR Code for Check-In */}
            {user?.id && (
              <div className="w-full">
                <Suspense fallback={<div className="p-4 border rounded-lg">Loading QR code...</div>}>
                  <MemberQRCode userId={user.id} userName={profile.name} initialProfile={profile} />
                </Suspense>
              </div>
            )}

            {/* Profile Photo & Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile Photo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  <div className="h-32 w-32 rounded-full border-2 border-muted overflow-hidden bg-muted flex-shrink-0">
                    {profile.photoUrl ? (
                      <img src={profile.photoUrl} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-5xl text-muted-foreground">👤</span>
                    )}
                  </div>
                </div>
                {editMode && (
                  <div>
                    <Label>Upload Photo</Label>
                    <Input type="file" accept="image/*" onChange={onPhotoChange} className="mt-1" />
                  </div>
                )}
                <div className="text-center space-y-1">
                  <div className="font-semibold">{profile.name || "N/A"}</div>
                  <div className="text-sm text-muted-foreground">{profile.email}</div>
                  {profile.phone && <div className="text-sm text-muted-foreground">📞 {profile.phone}</div>}
                </div>
              </CardContent>
            </Card>

            {/* Communication & Privacy Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Communication & Privacy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editMode ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="session-reminders" className="text-sm">Session Reminders</Label>
                      <Switch
                        id="session-reminders"
                        checked={profile.notifSessionReminders}
                        onCheckedChange={checked => setProfile(p => ({ ...p, notifSessionReminders: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="checkin" className="text-sm">Check-in Prompts</Label>
                      <Switch
                        id="checkin"
                        checked={profile.notifCheckin}
                        onCheckedChange={checked => setProfile(p => ({ ...p, notifCheckin: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="program-updates" className="text-sm">Program Updates</Label>
                      <Switch
                        id="program-updates"
                        checked={profile.notifProgramUpdates}
                        onCheckedChange={checked => setProfile(p => ({ ...p, notifProgramUpdates: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="privacy" className="text-sm">Share Progress with Coach</Label>
                      <Switch
                        id="privacy"
                        checked={profile.privacyProgress}
                        onCheckedChange={checked => setProfile(p => ({ ...p, privacyProgress: checked }))}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Session Reminders</span>
                      <Badge variant={profile.notifSessionReminders ? "default" : "secondary"}>
                        {profile.notifSessionReminders ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-in Prompts</span>
                      <Badge variant={profile.notifCheckin ? "default" : "secondary"}>
                        {profile.notifCheckin ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Program Updates</span>
                      <Badge variant={profile.notifProgramUpdates ? "default" : "secondary"}>
                        {profile.notifProgramUpdates ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Share with Coach</span>
                      <Badge variant={profile.privacyProgress ? "default" : "secondary"}>
                        {profile.privacyProgress ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {editMode ? (
              <div className="space-y-2">
                <Button onClick={handleSave} className="w-full" disabled={loading}>
                  {loading ? "Saving..." : <><Check className="h-4 w-4 mr-2" />Save Changes</>}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEditMode(false);
                    setError("");
                    // Reload profile to reset changes
                    window.location.reload();
                  }}
                >
                  <X className="h-4 w-4 mr-2" />Cancel
                </Button>
                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}
              </div>
            ) : (
              <Button onClick={() => setEditMode(true)} className="w-full">
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Modal - Show when membership is not Active */}
      {needsSubscription && (
        <SubscriptionModal open={true} />
      )}
    </div>
  );
}
