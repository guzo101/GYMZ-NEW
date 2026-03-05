import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                // Verify platform_admin role
                const { data: userData } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                if (userData?.role === 'platform_admin' || userData?.role === 'super_admin') {
                    toast.success("Welcome to Owner Admin Console");
                    navigate("/");
                } else {
                    await supabase.auth.signOut();
                    toast.error("Access Denied: You must be a platform admin to access OAC.");
                }
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to sign in");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-mesh-glow flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md glass-card rounded-2xl p-8 border-white/5 shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Gymz OAC</h1>
                    <p className="text-zinc-400">Owner Admin Console</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="text-sm text-zinc-400 mb-1.5 block ml-1">Email</label>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-black/40 border-white/5 focus:border-green-500/50 text-white rounded-xl h-12"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm text-zinc-400 mb-1.5 block ml-1">Password</label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-black/40 border-white/5 focus:border-green-500/50 text-white rounded-xl h-12"
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-500 text-white mt-6 h-12 rounded-xl font-bold transition-all shadow-lg hover:shadow-green-500/20"
                        disabled={loading}
                    >
                        {loading ? "Signing in..." : "Sign In to OAC"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
