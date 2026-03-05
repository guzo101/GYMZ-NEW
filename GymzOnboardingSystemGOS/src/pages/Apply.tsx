import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Mail, User, Phone, MapPin, CheckCircle2, ArrowRight, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { toast } from "sonner";

export default function Apply() {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        gymName: "",
        ownerName: "",
        email: "",
        phone: "",
        location: "",
        password: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase
                .from("gym_applications")
                .insert([DataMapper.toDb(formData)]);

            if (error) throw error;

            setSubmitted(true);
            toast.success("Application submitted successfully!");
        } catch (err: any) {
            console.error("Application error:", err);
            toast.error("Failed to submit application: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-[#4CAF50]/30 selection:text-white">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#4CAF50]/10 rounded-full blur-[120px] opacity-70 pointer-events-none" />

                <div className="relative z-10 w-full max-w-md bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)] flex flex-col items-center text-center animate-in fade-in zoom-in duration-700">
                    <div className="w-24 h-24 rounded-full bg-[#4CAF50]/20 flex items-center justify-center border-4 border-[#4CAF50]/30 mb-8 shadow-[0_0_30px_rgba(76,175,80,0.3)] animate-pulse">
                        <CheckCircle2 className="h-12 w-12 text-[#4CAF50]" />
                    </div>
                    <h2 className="text-3xl font-semibold mb-4 text-white">Application Received</h2>
                    <p className="text-zinc-400 mb-10 leading-relaxed text-sm">
                        Thank you for your interest in Gymz. Our partnership team will review your application and reach out within 24-48 hours.
                    </p>
                    <Button
                        onClick={() => window.location.href = 'http://localhost:8080'}
                        className="w-full h-12 bg-white text-black hover:bg-zinc-200 transition-colors font-medium rounded-xl text-base group"
                    >
                        Return to GMS
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans selection:bg-[#4CAF50]/30 selection:text-white">
            {/* Elegant Background Meshes */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#4CAF50]/5 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-zinc-800/20 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />

            <div className="relative z-10 w-full max-w-xl mx-auto">
                {/* Header Section */}
                <div className="text-center mb-10 animate-in slide-in-from-bottom-4 fade-in duration-700">
                    <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-white/[0.03] border border-white/10 mb-6 shadow-2xl backdrop-blur-xl">
                        <Building2 className="h-8 w-8 text-[#4CAF50]" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-4">
                        Partner with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4CAF50] to-[#81C784]">Gymz</span>
                    </h1>
                    <p className="text-zinc-400 text-lg max-w-md mx-auto leading-relaxed">
                        Elevate your facility with our definitive management ecosystem. Request access to begin.
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/[0.08] rounded-3xl p-6 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-150 fill-mode-both">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-1">
                            <Label htmlFor="gymName" className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">Gym Name</Label>
                            <div className="relative group">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-zinc-500 group-focus-within:text-[#4CAF50] transition-colors" />
                                <Input
                                    id="gymName"
                                    required
                                    placeholder="e.g. Iron Gate Fitness"
                                    className="pl-12 h-14 bg-zinc-900/50 border-white/10 focus-visible:border-[#4CAF50]/50 focus-visible:ring-1 focus-visible:ring-[#4CAF50]/50 rounded-xl text-base transition-all placeholder:text-zinc-600"
                                    value={formData.gymName}
                                    onChange={(e) => setFormData({ ...formData, gymName: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="ownerName" className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">Contact Person</Label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-zinc-500 group-focus-within:text-[#4CAF50] transition-colors" />
                                <Input
                                    id="ownerName"
                                    required
                                    placeholder="Full Name"
                                    className="pl-12 h-14 bg-zinc-900/50 border-white/10 focus-visible:border-[#4CAF50]/50 focus-visible:ring-1 focus-visible:ring-[#4CAF50]/50 rounded-xl text-base transition-all placeholder:text-zinc-600"
                                    value={formData.ownerName}
                                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <Label htmlFor="email" className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">Email Address</Label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-zinc-500 group-focus-within:text-[#4CAF50] transition-colors" />
                                    <Input
                                        id="email"
                                        type="email"
                                        required
                                        placeholder="hello@gym.com"
                                        className="pl-12 h-14 bg-zinc-900/50 border-white/10 focus-visible:border-[#4CAF50]/50 focus-visible:ring-1 focus-visible:ring-[#4CAF50]/50 rounded-xl text-base transition-all placeholder:text-zinc-600"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="phone" className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">Phone Number</Label>
                                <div className="relative group">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-zinc-500 group-focus-within:text-[#4CAF50] transition-colors" />
                                    <Input
                                        id="phone"
                                        placeholder="+1 (000) 000-0000"
                                        className="pl-12 h-14 bg-zinc-900/50 border-white/10 focus-visible:border-[#4CAF50]/50 focus-visible:ring-1 focus-visible:ring-[#4CAF50]/50 rounded-xl text-base transition-all placeholder:text-zinc-600"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="location" className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">Location</Label>
                            <div className="relative group">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-zinc-500 group-focus-within:text-[#4CAF50] transition-colors" />
                                <Input
                                    id="location"
                                    required
                                    placeholder="City, State / Country"
                                    className="pl-12 h-14 bg-zinc-900/50 border-white/10 focus-visible:border-[#4CAF50]/50 focus-visible:ring-1 focus-visible:ring-[#4CAF50]/50 rounded-xl text-base transition-all placeholder:text-zinc-600"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="password" title="This will be your admin password for the GMS" className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                                Admin Password
                                <span className="text-[10px] lowercase text-zinc-600 font-normal">(8+ characters)</span>
                            </Label>
                            <div className="relative group">
                                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-zinc-500 group-focus-within:text-[#4CAF50] transition-colors" />
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    minLength={8}
                                    placeholder="••••••••"
                                    className="pl-12 h-14 bg-zinc-900/50 border-white/10 focus-visible:border-[#4CAF50]/50 focus-visible:ring-1 focus-visible:ring-[#4CAF50]/50 rounded-xl text-base transition-all placeholder:text-zinc-600"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="pt-6">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-[#4CAF50] hover:bg-[#43a047] text-white rounded-xl font-medium text-base shadow-[0_0_20px_rgba(76,175,80,0.3)] hover:shadow-[0_0_25px_rgba(76,175,80,0.5)] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {loading ? "Submitting..." : "Submit Application"}
                                    {!loading && <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />}
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                            </Button>
                        </div>
                    </form>
                </div >
            </div >
        </div >
    );
}
