/* @ts-nocheck */
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { generateAndVerifyUniqueUserId } from "@/lib/utils";
import { GymzLogo } from "@/components/GymzLogo";
import { getOrCreateThreadId } from "@/services/aiChat";

const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

const stats = [
  { value: "5k+", label: "ACTIVE MEMBERS" },
  { value: "120+", label: "EXPERT TRAINERS" },
  { value: "24/7", label: "FACILITY ACCESS" },
];

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function Login() {
  const { user, login } = useAuth();
  const [role, setRole] = useState<'admin' | 'member'>('admin');
  const [memberForm, setMemberForm] = useState<'login' | 'signup'>('login');

  // Basic Info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Health Metrics (Same as App Onboarding)
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [fitnessGoal, setFitnessGoal] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  // Consent
  const [agreed, setAgreed] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<React.ReactNode>("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const navigate = useNavigate();

  // 1. Mount-time Redirect (Replacing Global AuthRedirect)
  // Only redirect if a user is already logged in AND we aren't currently in the middle of a login attempt
  useEffect(() => {
    if (user && !loading) {
      if (user.role === 'admin' || user.role === 'super_admin') {
        navigate("/dashboard", { replace: true });
      } else if (user.role === 'member') {
        navigate("/member/dashboard", { replace: true });
      } else if (user.role === 'staff') {
        navigate("/staff/profile", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  function resetForms() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setConfirm("");
    setGender("");
    setAge("");
    setFitnessGoal("");
    setHeight("");
    setWeight("");
    setAgreed(false);
    setError("");
    setSuccess("");
    setLoading(false);
  }

  function handleSetRole(newRole: 'admin' | 'member') {
    setRole(newRole);
    setError("");
    setSuccess("");
    setLoading(false);
    resetForms();
    if (newRole === 'member') setMemberForm('login');
    setShowForgotPassword(false);
  }

  function handleSetMemberForm(f: 'login' | 'signup') {
    setMemberForm(f);
    setError("");
    setSuccess("");
    resetForms();
    setShowForgotPassword(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (showForgotPassword) {
      await handleForgotPassword();
      return;
    }
    setError("");
    setSuccess("");

    if (role === 'member' && memberForm === 'signup') {
      if (!firstName || !lastName || !gender || !age || !fitnessGoal || !height || !weight) {
        setError("Please fill in all onboarding fields.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      if (!agreed) {
        setError("You must agree to the Terms & Conditions.");
        return;
      }
    }

    if (!validateEmail(email)) { setError("Valid email required."); return; }
    if (!password) { setError("Password required."); return; }

    setLoading(true);
    try {
      if (role === 'admin') {
        await handleAdminLogin();
      } else if (memberForm === 'signup') {
        await handleMemberSignup();
      } else {
        await handleMemberLogin();
      }
    } catch (err) {
      console.error("Login Error:", err);
      // If error happened, ensure we are signed out globally
      await supabase.auth.signOut().catch(() => { });
      setError(err instanceof Error ? err.message : "Unable to process request.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      setSuccess(
        <span>
          A reset link and code has been sent.{" "}
          <button
            onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}
            className="underline font-bold hover:text-primary transition-colors"
          >
            Enter code manually
          </button>
        </span>
      );
    } catch (err) {
      console.error("Forgot Password Error:", err);
      setError(err instanceof Error ? err.message : "Unable to process reset request.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: verificationEmail,
        token: otp,
        type: 'signup',
      });
      if (verifyError) throw verifyError;
      if (data.user) {
        login({ id: data.user.id, name: data.user.user_metadata?.name || verificationEmail, email: verificationEmail, role: "member" });
        navigate("/member/dashboard");
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Invalid code."); }
    finally { setLoading(false); }
  }

  if (needsVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-8 bg-card p-10 rounded-2xl shadow-modern border">
          <div className="text-center space-y-2">
            <GymzLogo className="h-12 w-auto mx-auto text-primary" />
            <h1 className="text-3xl font-bold">Verify Email</h1>
            <p className="text-muted-foreground text-sm">Enter the code sent to {verificationEmail}</p>
          </div>
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <Input value={otp} onChange={e => setOtp(e.target.value)} placeholder="000000" className="text-center text-3xl font-bold tracking-widest h-16" maxLength={6} required />
            <Button type="submit" className="w-full h-12" disabled={loading}>{loading ? "Verifying..." : "Verify & Sign In"}</Button>
          </form>
        </div>
      </div>
    );
  }

  async function handleAdminLogin() {
    // 1. Authenticate
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;

    const authUser = authData.user;

    // 2. STRICT ROLE CHECK
    // Fetch profile to verify role before allowing navigation
    const { data: profile, error: profileError } = await db.from("users").select("role, gym_id").eq("id", authUser.id).single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      throw new Error("Admin profile not found. If you are a member, please use the Member tab.");
    }

    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin' || profile.role === 'staff';
    const hasGym = profile.gym_id !== null && profile.gym_id !== undefined;

    if (!isAdmin) {
      await supabase.auth.signOut();
      throw new Error("ACCESS DENIED: Use the Member login tab.");
    }

    if (!hasGym && profile.role !== 'super_admin') {
      // Self-heal: try resolving gym from gym_contacts before rejecting
      const { data: contact } = await db.from("gym_contacts")
        .select("gym_id")
        .eq("email", email)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (contact?.gym_id) {
        // Auto-patch the user profile so future logins work immediately
        await db.from("users").update({ gym_id: contact.gym_id }).eq("id", authUser.id);
        profile.gym_id = contact.gym_id;
      } else {
        await supabase.auth.signOut();
        throw new Error("SECURITY ALERT: Your account is not associated with a gym. Please contact support.");
      }
    }

    // 3. Finalize
    login({
      id: authUser.id,
      name: authUser.user_metadata?.name || email.split('@')[0],
      email: authUser.email,
      role: profile.role,
      gymId: profile.gym_id,
    });

    navigate("/dashboard");
  }

  async function handleMemberLogin() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;

    const authUser = authData.user;

    // STRICT ROLE + ACCESS MODE CHECK
    const { data: profile } = await db.from("users").select("role, access_mode").eq("id", authUser.id).single();

    if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
      await supabase.auth.signOut();
      throw new Error("This is an Admin account. Please use the Staff / Admin login tab.");
    }

    // Block event_access users from accessing the paid gym member dashboard
    if (profile?.access_mode === 'event_access') {
      await supabase.auth.signOut();
      throw new Error("Your account has Event Access only. Please use the Gymz mobile app to access your events, nutrition tracking, and community features.");
    }

    login({
      id: authUser.id,
      name: authUser.user_metadata?.name || email.split('@')[0],
      email: authUser.email,
      role: profile?.role || "member",
    });

    navigate("/member/dashboard");
  }

  async function handleMemberSignup() {
    const fullName = `${firstName} ${lastName}`.trim();
    const avatar = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(fullName)}`;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          name: fullName,
          gender,
          age: parseInt(age),
          fitness_goal: fitnessGoal,
          height: parseFloat(height),
          weight: parseFloat(weight),
          marketing_consent: marketingConsent,
          marketing_consent_date: marketingConsent ? new Date().toISOString() : null,
          avatar_url: avatar,
          role: "member",
          gym_id: '66874288-028a-495b-b98a-ceddf94876b6', // The Sweat Factory
        }
      }
    });

    if (authError) throw authError;

    if (authData.user && !authData.session) {
      setVerificationEmail(email);
      setNeedsVerification(true);
      return;
    }

    if (authData.user && authData.session) {
      login({
        id: authData.user.id,
        name: fullName,
        email: email,
        role: "member",
        avatarUrl: avatar,
      });
      navigate("/member/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex bg-background bg-mesh-glow">
      {/* Sidebar / Left Side Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] w-[400px] p-12 text-white">
        <div className="space-y-6">
          <div className="flex items-center">
            <GymzLogo className="h-10 w-auto mr-3" />
            <span className="text-4xl font-bold tracking-tighter">Gymz</span>
          </div>
          <p className="text-xl font-light opacity-80 leading-relaxed">Experience the next evolution of fitness management.</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-xl transition-all hover:bg-white/10">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-[10px] uppercase tracking-widest opacity-60 font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="text-[10px] opacity-40">© 2025 Gymz SYSTEM. ALL RIGHTS RESERVED.</div>
      </div>

      <div className="flex-1 flex items-center justify-center px-8 py-12 bg-muted/10">
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center space-y-4">
            <GymzLogo className="h-20 w-auto mx-auto mb-2" />
            <p className="text-sm text-muted-foreground/60 tracking-widest uppercase font-medium mb-8">Elevate Your Fitness Experience</p>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))] bg-clip-text text-transparent">
              {showForgotPassword ? "Reset Password" : "Welcome back!"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {showForgotPassword ? "Enter your email to receive a reset link." : "Please enter your credentials to access the system."}
            </p>
          </div>

          {!showForgotPassword && (
            <div className="flex bg-muted/50 p-1 rounded-xl shadow-inner mb-6 transition-all">
              <button className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${role === 'admin' ? 'bg-white shadow-sm text-primary scale-[1.02]' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => handleSetRole('admin')}>Staff / Admin</button>
              <button className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${role === 'member' ? 'bg-white shadow-sm text-primary scale-[1.02]' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => handleSetRole('member')}>Member</button>
            </div>
          )}

          {role === 'member' && !showForgotPassword && (
            <div className="flex border border-muted p-1 rounded-xl mb-6 bg-background/50">
              <button className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${memberForm === 'login' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-primary'}`} onClick={() => handleSetMemberForm('login')}>Sign In</button>
              <button className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${memberForm === 'signup' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-primary'}`} onClick={() => handleSetMemberForm('signup')}>Create Account</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {role === 'member' && memberForm === 'signup' && !showForgotPassword && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">About You</label>
                  <Input placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                </div>
                <div className="space-y-1 mt-5">
                  <Input placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} required />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Personal</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none" value={gender} onChange={e => setGender(e.target.value)} required>
                    <option value="">Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1 mt-5">
                  <Input type="number" placeholder="Age" value={age} onChange={e => setAge(e.target.value)} required />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Transformation Goal</label>
                  <Input placeholder="Fitness Goal (e.g. Muscle Gain, Weight Loss)" value={fitnessGoal} onChange={e => setFitnessGoal(e.target.value)} required />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Metrics</label>
                  <Input type="number" placeholder="Height (cm)" value={height} onChange={e => setHeight(e.target.value)} required />
                </div>
                <div className="space-y-1 mt-5">
                  <Input type="number" placeholder="Weight (kg)" value={weight} onChange={e => setWeight(e.target.value)} required />
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Account Credentials</label>
                <Input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              {!showForgotPassword && (
                <>
                  <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                  {role === 'member' && memberForm === 'signup' && (
                    <Input type="password" placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                  )}
                </>
              )}
            </div>

            {/* Checkboxes (App Parity) */}
            {role === 'member' && memberForm === 'signup' && !showForgotPassword && (
              <div className="space-y-3 py-2 animate-in fade-in duration-700">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className={`mt-0.5 h-5 w-5 rounded border-2 transition-all flex items-center justify-center ${agreed ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`} onClick={() => setAgreed(!agreed)}>
                    {agreed && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground leading-tight">
                      I agree to the <span className="text-primary font-bold underline">Terms & Conditions</span> and Privacy Policy.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className={`mt-0.5 h-5 w-5 rounded border-2 transition-all flex items-center justify-center ${marketingConsent ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`} onClick={() => setMarketingConsent(!marketingConsent)}>
                    {marketingConsent && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground leading-tight">
                      ✨ Send me <span className="text-[hsl(var(--primary))] font-bold">exclusive discounts</span> and fitness tips.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs text-center border border-red-100 font-medium animate-shake">{error}</div>}
            {success && <div className="p-4 bg-green-50 text-green-600 rounded-xl text-xs text-center border border-green-100 font-medium">{success}</div>}

            <Button type="submit" className="w-full h-14 text-lg font-bold shadow-lg transition-transform active:scale-[0.98]" disabled={loading}>
              {loading ? "Processing..." : showForgotPassword ? "Send Reset Link" : (role === 'admin' || memberForm === 'login' ? "Sign In" : "Register Now")}
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                onClick={() => {
                  setShowForgotPassword(!showForgotPassword);
                  setError("");
                  setSuccess("");
                }}
              >
                {showForgotPassword ? "Back to Login" : "Forgot your password?"}
              </button>
            </div>

            {role === 'admin' && !showForgotPassword && (
              <div className="text-center pt-4 border-t border-muted/30">
                <p className="text-xs text-muted-foreground mb-2">Want to bring Gymz to your facility?</p>
                <button
                  type="button"
                  className="text-sm font-bold text-primary hover:text-primary/80 transition-all"
                  onClick={() => {
                    const url = import.meta.env.VITE_PARTNER_APPLY_URL || "http://localhost:8084/apply";
                    if (typeof window !== "undefined" && (window as any).electronAPI?.openExternal) {
                      (window as any).electronAPI.openExternal(url);
                    } else {
                      window.open(url, "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  Apply to become a Partner
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
