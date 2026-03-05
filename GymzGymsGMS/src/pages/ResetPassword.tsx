import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GymzLogo } from "@/components/GymzLogo";

export default function ResetPassword() {
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [step, setStep] = useState<"verify" | "reset">("reset");
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If no session, we need them to verify the OTP from their email first
                setStep("verify");

                // Try to grab email from query params if available
                const params = new URLSearchParams(location.search);
                const emailParam = params.get("email");
                if (emailParam) setEmail(emailParam);
            } else {
                setStep("reset");
            }
        };
        checkSession();
    }, [location]);

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !otp) {
            setError("Email and Code are required.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const { error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'recovery',
            });

            if (verifyError) throw verifyError;

            // Verification successful, Supabase now has a session
            setStep("reset");
        } catch (err) {
            console.error("OTP Verification Error:", err);
            setError(err instanceof Error ? err.message : "Invalid or expired code.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
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
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => {
                navigate("/login");
            }, 3000);
        } catch (err) {
            console.error("Reset Password Error:", err);
            setError(err instanceof Error ? err.message : "Unable to update password.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-8">
                <div className="w-full max-w-md space-y-8 bg-card p-10 rounded-2xl shadow-modern border text-center">
                    <div className="space-y-4">
                        <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-4xl animate-bounce">
                            ✓
                        </div>
                        <h1 className="text-3xl font-bold">Password Updated</h1>
                        <p className="text-muted-foreground">Your password has been reset successfully. Redirecting you to login...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
            <div className="w-full max-w-md space-y-8 bg-card p-10 rounded-2xl shadow-modern border">
                <div className="text-center space-y-2">
                    <GymzLogo className="h-12 w-auto mx-auto text-primary" />
                    <h1 className="text-3xl font-bold">{step === "verify" ? "Verify Code" : "Set New Password"}</h1>
                    <p className="text-muted-foreground text-sm">
                        {step === "verify"
                            ? "Enter the 6-digit code sent to your email."
                            : "Create a secure password for your account."}
                    </p>
                </div>

                {step === "verify" ? (
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Email Address</label>
                                <Input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">6-Digit Code</label>
                                <Input
                                    type="text"
                                    placeholder="123456"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    required
                                    className="tracking-[0.5em] text-center text-lg font-bold"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs text-center border border-red-100 font-medium">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg" disabled={loading}>
                            {loading ? "Verifying..." : "Verify Code"}
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">New Password</label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Confirm New Password</label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs text-center border border-red-100 font-medium">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg" disabled={loading}>
                            {loading ? "Updating..." : "Reset Password"}
                        </Button>
                    </form>
                )}

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
