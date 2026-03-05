import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, XCircle, FileText, AlertCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function VerificationReview() {
    const { gymId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [gym, setGym] = useState<any>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (gymId) fetchGymDetails();
    }, [gymId]);

    const fetchGymDetails = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('gyms')
            .select(`
        *,
        gym_onboarding_status(*),
        gym_verification_documents(*)
      `)
            .eq('id', gymId)
            .single();

        if (error) {
            toast.error("Error fetching gym");
            navigate("/");
        } else {
            setGym(DataMapper.fromDb(data));
        }
        setLoading(false);
    };

    const logAudit = async (action: string, reason?: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await supabase.from('admin_audit_logs').insert({
            actor_id: session.user.id,
            actor_email: session.user.email,
            action,
            entity_type: 'gym',
            entity_id: gymId,
            gym_id: gymId,
            reason
        });
    };

    const handleApprove = async () => {
        setProcessing(true);

        // 1. Update onboarding status
        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase
            .from('gym_onboarding_status')
            .update(DataMapper.toDb({
                status: 'active',
                reviewerId: session?.user.id,
                reviewedAt: new Date().toISOString(),
                activatedAt: new Date().toISOString()
            }))
            .eq('gym_id', gymId);

        if (error) {
            toast.error("Failed to approve gym");
        } else {
            // 2. Update gym status
            await supabase.from('gyms').update({ status: 'active' }).eq('id', gymId);

            // 3. Log Audit
            await logAudit('gym.approved');

            toast.success("Gym verified and activated!");
            navigate("/");
        }
        setProcessing(false);
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error("Rejection reason is required");
            return;
        }
        setProcessing(true);

        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase
            .from('gym_onboarding_status')
            .update(DataMapper.toDb({
                status: 'rejected',
                rejectionReason: rejectReason,
                reviewerId: session?.user.id,
                reviewedAt: new Date().toISOString()
            }))
            .eq('gym_id', gymId);

        if (error) {
            toast.error("Failed to reject gym");
        } else {
            // Update gym status
            await supabase.from('gyms').update({ status: 'rejected' }).eq('id', gymId);

            // Log Audit
            await logAudit('gym.rejected', rejectReason);

            toast.success("Gym application rejected");
            navigate("/");
        }
        setProcessing(false);
    };

    if (loading) return <div className="min-h-screen bg-mesh-glow flex items-center justify-center text-white text-lg">Loading review data...</div>;

    const score = gym?.gymOnboardingStatus?.[0]?.completenessScore || 0;

    return (
        <div className="min-h-screen bg-mesh-glow text-white">
            {/* Header */}
            <div className="bg-black/20 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-white hover:bg-white/5">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <div>
                            <h1 className="font-bold text-xl tracking-tight">Verification Review</h1>
                            <p className="text-xs text-muted-foreground">Approve or Reject Facility Applications</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-sm font-medium">Completeness: <span className={score >= 80 ? "text-green-500" : "text-yellow-500"}>{score}%</span></span>
                        <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl" onClick={() => navigate(`/gym/${gym.id}`)}>
                            View Full Profile
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Col: Info */}
                <div className="space-y-6">
                    <Card className="glass-card border-white/5 shadow-xl rounded-2xl">
                        <CardHeader>
                            <CardTitle>Gym Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Gym Name</Label>
                                <div className="font-bold text-2xl text-white">{gym.name}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-8 pt-2">
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">City</Label>
                                    <div className="text-white font-medium">{gym.city || 'Not specified'}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Currency</Label>
                                    <div className="text-white font-medium">{gym.currency || 'ZMW'}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-white/5 shadow-xl rounded-2xl">
                        <CardHeader>
                            <CardTitle>Verification Documents</CardTitle>
                            <CardDescription className="text-zinc-500">Government issued licenses and IDs</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {gym.gymVerificationDocuments?.length > 0 ? (
                                <div className="grid gap-3">
                                    {gym.gymVerificationDocuments.map((doc: any) => (
                                        <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 transition-colors hover:bg-white/10 group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                                                    <FileText className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-white tracking-wide">{doc.documentType.replace(/_/g, ' ').toUpperCase()}</div>
                                                    <div className="text-xs text-zinc-500 mt-0.5">{doc.fileName}</div>
                                                </div>
                                            </div>
                                            <Button size="sm" variant="ghost" className="text-blue-400 hover:bg-blue-400/10 rounded-lg">
                                                Download
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed border-white/5 rounded-2xl">
                                    <AlertCircle className="h-10 w-10 mb-3 text-yellow-500/50" />
                                    <p className="text-sm font-medium">No verification documents uploaded</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Col: Decision */}
                <div className="space-y-6">
                    <Card className="glass-card border-white/5 shadow-2xl rounded-2xl sticky top-28">
                        <CardHeader>
                            <CardTitle>Review Decision</CardTitle>
                            <CardDescription className="text-zinc-500">Approve or reject this gym application.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {score < 80 && (
                                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm flex gap-3 shadow-inner">
                                    <AlertTriangle className="h-5 w-5 shrink-0" />
                                    <p><strong className="font-bold uppercase text-xs block mb-1">Warning: Low Completeness</strong> Gym completeness score ({score}%) is below the recommended 80% threshold for activation.</p>
                                </div>
                            )}

                            <div className="space-y-3">
                                <Label className="text-destructive font-bold text-xs uppercase tracking-widest block ml-1">Rejection Reason</Label>
                                <Input
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Explain why this application cannot be accepted..."
                                    className="bg-black/40 border-white/5 focus:border-red-500/50 rounded-xl h-12"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <Button
                                    variant="outline"
                                    className="border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-xl h-12 font-bold"
                                    onClick={handleReject}
                                    disabled={processing || !rejectReason.trim()}
                                >
                                    <XCircle className="w-4 h-4 mr-2" /> Reject
                                </Button>
                                <Button
                                    className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-green-600/20"
                                    onClick={handleApprove}
                                    disabled={processing}
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
