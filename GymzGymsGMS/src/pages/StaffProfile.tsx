/* @ts-nocheck */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Edit2, Check, X, AlertCircle, User, Mail, Phone, Briefcase, Calendar, Star, MapPin, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const db = {
  from: (...args) => (supabase).from(...args),
};

// Zambia Kwacha currency formatter
const currency = new Intl.NumberFormat("en-ZM", {
  style: "currency",
  currency: "ZMW",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export default function StaffProfile() {
  const { user, login } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    department: "",
    avatar: null,
    rating: null,
    experience_years: null,
    status: "Active",
    specialties: [] as string[],
    schedule: "",
    photo: null as File | null,
    photoUrl: null,
  });
  const [staffId, setStaffId] = useState<string | null>(null);
  const [tips, setTips] = useState<any[]>([]);
  const [tipStats, setTipStats] = useState({
    totalApproved: 0,
    totalPending: 0,
  });
  const [loadingTips, setLoadingTips] = useState(false);

  // Fetch staff profile on mount
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setFetching(true);
      try {
        // First try to find staff by user_id or email
        let staffData = null;

        // Try to find by user_id if staff table has user_id column
        const { data: staffById, error: err1 } = await db
          .from("staff")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (!err1 && staffById) {
          staffData = staffById;
        } else {
          // Try to find by email
          const { data: staffByEmail, error: err2 } = await db
            .from("staff")
            .select("*")
            .eq("email", user.email)
            .single();

          if (!err2 && staffByEmail) {
            staffData = staffByEmail;
          } else {
            // Try to find by name
            const { data: staffByName, error: err3 } = await db
              .from("staff")
              .select("*")
              .eq("name", user.name)
              .limit(1)
              .single();

            if (!err3 && staffByName) {
              staffData = staffByName;
            }
          }
        }

        if (staffData) {
          setStaffId(staffData.id);
          setProfile({
            name: staffData.name || user.name || "",
            email: staffData.email || user.email || "",
            phone: staffData.phone || "",
            role: staffData.role || "",
            department: staffData.department || "",
            avatar: staffData.avatar,
            rating: staffData.rating || null,
            experience_years: staffData.experience_years || null,
            status: staffData.status || "Active",
            specialties: staffData.specialties || [],
            schedule: staffData.schedule || "",
            photo: null,
            photoUrl: staffData.avatar || null,
          });
        } else {
          // If no staff record found, use user data
          setProfile({
            name: user.name || "",
            email: user.email || "",
            phone: user.phone || "",
            role: user.role || "",
            department: "",
            avatar: null,
            rating: null,
            experience_years: null,
            status: "Active",
            specialties: [],
            schedule: "",
            photo: null,
            photoUrl: user.avatarUrl || null,
          });
        }
      } catch (err: any) {
        console.error("Error fetching staff profile:", err);
        setError(err.message || "Failed to load profile");
      } finally {
        setFetching(false);
      }
    })();
  }, [user?.id, user?.email, user?.name]);

  const fetchTips = useCallback(async () => {
    if (!staffId) return;
    setLoadingTips(true);
    try {
      const { data: tipsData, error: tipsError } = await db
        .from("payments")
        .select("id, tip_amount, status, paid_at, created_at, users!user_id(name, id), description")
        .eq("trainer_id", staffId)
        .not("tip_amount", "is", null)
        .order("paid_at", { ascending: false })
        .limit(50);

      if (tipsError) {
        console.error("Error fetching tips:", tipsError);
        setTips([]);
        setTipStats({ totalApproved: 0, totalPending: 0 });
        return;
      }

      const tipsList = (tipsData || []).filter(t => t.tip_amount && Number(t.tip_amount) > 0);
      setTips(tipsList);

      // Calculate stats
      const approved = tipsList
        .filter(t => t.status === "completed")
        .reduce((sum, t) => sum + Number(t.tip_amount || 0), 0);

      const pending = tipsList
        .filter(t => t.status === "pending_approval" || t.status === "pending")
        .reduce((sum, t) => sum + Number(t.tip_amount || 0), 0);

      setTipStats({
        totalApproved: approved,
        totalPending: pending,
      });
    } catch (err: any) {
      console.error("Error fetching tips:", err);
      setTips([]);
      setTipStats({ totalApproved: 0, totalPending: 0 });
    } finally {
      setLoadingTips(false);
    }
  }, [staffId]);

  // Fetch tips for the trainer
  useEffect(() => {
    if (!staffId) return;
    fetchTips();

    // Set up real-time subscription for tips
    const channel = supabase
      .channel(`trainer-tips-${staffId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `trainer_id=eq.${staffId}`
      }, (payload) => {
        // Refresh tips when payment is created or updated
        fetchTips();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [staffId, fetchTips]);

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    let avatarUrl = profile.photoUrl || profile.avatar;

    try {
      // Upload photo if changed
      if (profile.photo) {
        const file = profile.photo;
        const ext = file.name.split('.').pop();
        const fileName = `staff_${user.id}_${Date.now()}.${ext}`;
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
          if (urlData2?.publicUrl) avatarUrl = urlData2.publicUrl;
        } else {
          const { data: urlData } = supabase.storage.from('staff-avatars').getPublicUrl(fileName);
          if (urlData?.publicUrl) avatarUrl = urlData.publicUrl;
        }
      }

      // Update staff table
      const updateData: any = {
        name: profile.name,
        email: profile.email,
        phone: profile.phone || null,
        role: profile.role || null,
        department: profile.department || null,
        avatar: avatarUrl,
        rating: profile.rating || null,
        experience_years: profile.experience_years || null,
        status: profile.status || "Active",
        specialties: profile.specialties.length > 0 ? profile.specialties : null,
        schedule: profile.schedule || null,
      };

      // Try to update existing staff record
      let { data: existingStaff, error: findError } = await db
        .from("staff")
        .select("id")
        .or(`user_id.eq.${user.id},email.eq.${profile.email},name.eq.${profile.name}`)
        .limit(1)
        .single();

      if (!findError && existingStaff) {
        // Update existing record
        const { error: updateError } = await db
          .from("staff")
          .update(updateData)
          .eq("id", existingStaff.id);

        if (updateError) throw updateError;
      } else {
        // Create new staff record
        const { error: insertError } = await db
          .from("staff")
          .insert([{ ...updateData, user_id: user.id }]);

        if (insertError) throw insertError;
      }

      // Also update users table if it exists
      try {
        await db.from("users").update({
          name: profile.name,
          email: profile.email,
          phone: profile.phone || null,
          avatar_url: avatarUrl,
        }).eq("id", user.id);
      } catch (userUpdateErr) {
        console.warn("Could not update users table:", userUpdateErr);
      }

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });

      // Refresh profile
      const { data: updatedStaff } = await db
        .from("staff")
        .select("*")
        .or(`user_id.eq.${user.id},email.eq.${profile.email}`)
        .limit(1)
        .single();

      if (updatedStaff) {
        setStaffId(updatedStaff.id);
        setProfile(p => ({ ...p, ...updatedStaff, photo: null, photoUrl: updatedStaff.avatar }));
      }

      // Update auth context
      login({
        id: user.id,
        unique_id: user.unique_id,
        name: profile.name,
        email: profile.email,
        role: user.role,
        avatarUrl: avatarUrl,
        phone: profile.phone,
        goal: user.goal,
      });

      setEditMode(false);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
      toast({
        title: "Error",
        description: err.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function onPhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setProfile(p => ({ ...p, photo: file, photoUrl: URL.createObjectURL(file) }));
  }

  function handleSpecialtyChange(index: number, value: string) {
    const newSpecialties = [...profile.specialties];
    newSpecialties[index] = value;
    setProfile(p => ({ ...p, specialties: newSpecialties }));
  }

  function addSpecialty() {
    setProfile(p => ({ ...p, specialties: [...p.specialties, ""] }));
  }

  function removeSpecialty(index: number) {
    setProfile(p => ({ ...p, specialties: p.specialties.filter((_, i) => i !== index) }));
  }

  if (fetching) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-center text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Staff Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your professional information</p>
        </div>
        {!editMode && (
          <Button onClick={() => setEditMode(true)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Basic Information</CardTitle>
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
                      <Label>Full Name *</Label>
                      <Input
                        value={profile.name}
                        onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                        placeholder="Enter your full name"
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
                      <Label>Status</Label>
                      <select
                        value={profile.status}
                        onChange={e => setProfile(p => ({ ...p, status: e.target.value }))}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                      >
                        <option value="Active">Active</option>
                        <option value="On Leave">On Leave</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase">Full Name</Label>
                    <div className="mt-1 font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {profile.name || "Not set"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase">Email</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {profile.email || "Not set"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase">Phone</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {profile.phone || "Not set"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase">Status</Label>
                    <div className="mt-1">
                      <Badge variant={profile.status === "Active" ? "default" : "secondary"}>
                        {profile.status || "Active"}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips & Earnings Card */}
          {staffId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Tips & Earnings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingTips ? (
                  <div className="text-center text-muted-foreground py-4">Loading tips...</div>
                ) : (
                  <>
                    {/* Tip Statistics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="text-sm text-muted-foreground mb-1">Approved Tips</div>
                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                          {currency.format(tipStats.totalApproved)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Ready to withdraw
                        </div>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                        <div className="text-sm text-muted-foreground mb-1">Pending Tips</div>
                        <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                          {currency.format(tipStats.totalPending)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Awaiting approval
                        </div>
                      </div>
                    </div>

                    {/* Tip Transactions List */}
                    {tips.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold mb-2">Recent Tips</div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {tips.map((tip) => {
                            const isApproved = tip.status === "completed";
                            const tipDate = tip.paid_at || tip.created_at;
                            return (
                              <div
                                key={tip.id}
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">
                                      {currency.format(Number(tip.tip_amount || 0))}
                                    </span>
                                    <Badge
                                      variant={isApproved ? "default" : "secondary"}
                                      className={
                                        isApproved
                                          ? "bg-primary"
                                          : "bg-orange-500"
                                      }
                                    >
                                      {isApproved ? "Approved" : "Pending"}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {tip.users?.name || "Anonymous"} • {tipDate ? format(new Date(tipDate), "MMM d, yyyy") : "N/A"}
                                  </div>
                                  {tip.description && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {tip.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-4">
                        No tips received yet
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Professional Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Professional Information</CardTitle>
            </CardHeader>
            <CardContent>
              {editMode ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Role</Label>
                      <Input
                        value={profile.role}
                        onChange={e => setProfile(p => ({ ...p, role: e.target.value }))}
                        placeholder="e.g., Personal Trainer, Yoga Instructor"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Input
                        value={profile.department}
                        onChange={e => setProfile(p => ({ ...p, department: e.target.value }))}
                        placeholder="e.g., Strength & HIIT, Yoga & Pilates"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Experience (Years)</Label>
                      <Input
                        type="number"
                        value={profile.experience_years || ""}
                        onChange={e => setProfile(p => ({ ...p, experience_years: e.target.value ? parseFloat(e.target.value) : null }))}
                        placeholder="Years of experience"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Rating</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={profile.rating || ""}
                        onChange={e => setProfile(p => ({ ...p, rating: e.target.value ? parseFloat(e.target.value) : null }))}
                        placeholder="0.0 - 5.0"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Schedule</Label>
                    <Textarea
                      value={profile.schedule}
                      onChange={e => setProfile(p => ({ ...p, schedule: e.target.value }))}
                      placeholder="e.g., Mon-Fri: 6am-2pm, Sat: 8am-12pm"
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Specialties</Label>
                    <div className="space-y-2 mt-1">
                      {profile.specialties.map((specialty, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={specialty}
                            onChange={e => handleSpecialtyChange(index, e.target.value)}
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
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Role</Label>
                      <div className="mt-1 font-semibold flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        {profile.role || "Not set"}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Department</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {profile.department || "Not set"}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Experience</Label>
                      <div className="mt-1">
                        {profile.experience_years ? `${profile.experience_years} years` : "Not set"}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Rating</Label>
                      <div className="mt-1 flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        {profile.rating ? profile.rating.toFixed(1) : "Not rated"}
                      </div>
                    </div>
                  </div>
                  {profile.schedule && (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Schedule</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {profile.schedule}
                      </div>
                    </div>
                  )}
                  {profile.specialties && profile.specialties.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Specialties</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.specialties.map((specialty, index) => (
                          <Badge key={index} variant="outline">
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Profile Photo */}
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

          {/* Action Buttons */}
          {editMode ? (
            <div className="space-y-2">
              <Button onClick={handleSave} className="w-full" disabled={loading || !profile.name || !profile.email}>
                {loading ? "Saving..." : <><Check className="h-4 w-4 mr-2" />Save Changes</>}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEditMode(false);
                  setError("");
                  window.location.reload();
                }}
                disabled={loading}
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
  );
}

