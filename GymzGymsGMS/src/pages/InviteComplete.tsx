/**
 * Invite Complete - Redirect handler for gym admin invite links.
 * When an invitee clicks the link, Supabase redirects here with auth tokens in the hash.
 * We establish the session, show a "Set your password" form, then redirect to app or login.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GymzLogo } from "@/components/GymzLogo";

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor;
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

function parseHashParams(hash: string): Record<string, string> {
  if (!hash) return {};
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  return trimmed.split("&").reduce((acc, part) => {
    const [key, value] = part.split("=");
    if (!key) return acc;
    acc[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
    return acc;
  }, {} as Record<string, string>);
}

export default function InviteComplete() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"loading" | "set-password" | "success" | "error">("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const hash = window.location.hash || "";
    const params = parseHashParams(hash);

    // Check for error params from Supabase
    const err = params["error"] || params["error_code"];
    const errDesc = params["error_description"];
    if (err) {
      setErrorMessage(
        err === "access_denied" || err === "otp_expired"
          ? "This invite link is invalid or has expired. Please ask your platform admin to send a new invite."
          : errDesc || "Something went wrong. Please try again or request a new invite."
      );
      setStep("error");
      return;
    }

    const accessToken = params["access_token"];
    const refreshToken = params["refresh_token"];
    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(() => {
          // Clear the hash from URL (tokens are now in session)
          window.history.replaceState(null, "", window.location.pathname);
          setStep("set-password");
        })
        .catch((e) => {
          console.error("[InviteComplete] setSession error:", e);
          setErrorMessage("Could not complete sign-in. Please try the link again or request a new invite.");
          setStep("error");
        });
      return;
    }

    // No tokens and no error - maybe already completed or invalid
    setErrorMessage("Invalid or expired invite link. Please request a new invite from your platform admin.");
    setStep("error");
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setStep("success");

      // After a short delay, redirect
      const session = data.session;
      setTimeout(() => {
        const appScheme = "gymz-app://invite-complete";
        if (isMobile() && session) {
          const hash = `#access_token=${session.access_token}&refresh_token=${session.refresh_token}`;
          window.location.replace(`${appScheme}${hash}`);
          setTimeout(() => window.location.replace(`/login${hash}`), 2000);
        } else {
          navigate("/login");
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to set password.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Setting up your account...</p>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-6 bg-card p-10 rounded-2xl shadow-modern border text-center">
          <GymzLogo className="h-12 w-auto mx-auto text-primary" />
          <h1 className="text-xl font-bold">Invite Link Invalid</h1>
          <p className="text-muted-foreground text-sm">{errorMessage}</p>
          <Button variant="outline" onClick={() => navigate("/login")}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-8 bg-card p-10 rounded-2xl shadow-modern border text-center">
          <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-4xl">
            ✓
          </div>
          <h1 className="text-3xl font-bold">Password Set</h1>
          <p className="text-muted-foreground">
            You can now log in with your email and password. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  // step === "set-password"
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-md space-y-8 bg-card p-10 rounded-2xl shadow-modern border">
        <div className="text-center space-y-2">
          <GymzLogo className="h-12 w-auto mx-auto text-primary" />
          <h1 className="text-3xl font-bold">Set Your Password</h1>
          <p className="text-muted-foreground text-sm">
            Create a password so you can log in with your email next time.
          </p>
        </div>

        <form onSubmit={handleSetPassword} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                Confirm Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs text-center border border-red-100 font-medium">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg" disabled={loading}>
            {loading ? "Setting..." : "Set Password & Continue"}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
            onClick={() => navigate("/login")}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
