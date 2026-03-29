import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Download, FileText, ClipboardList, TrendingUp, MousePointer2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { addBrandedHeader, fetchGymNameForReport } from "@/lib/pdfBranding";

interface Sponsor {
    id: string;
    name: string;
}

interface BannerAd {
    id: string;
    sponsor_id: string | null;
    image_url: string;
    placement_type: string;
    impressions_count: number;
    clicks_count: number;
    is_active: boolean;
}

export default function SponsorReports() {
    const { user } = useAuth();
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [banners, setBanners] = useState<BannerAd[]>([]);
    const [selectedSponsor, setSelectedSponsor] = useState<string>("all");
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (user?.gymId || (user as any)?.gym_id) {
            fetchSponsors();
        }
    }, [user?.gymId, (user as any)?.gym_id]);

    const fetchSponsors = async () => {
        setLoading(true);
        try {
            const [sponsorsRes, bannersRes] = await Promise.all([
                supabase.from("sponsors").select("id, name").eq("gym_id", user?.gymId || (user as any)?.gym_id),
                supabase.from("banner_ads").select("*").eq("gym_id", user?.gymId || (user as any)?.gym_id),
            ]);

            if (sponsorsRes.error) throw sponsorsRes.error;
            if (bannersRes.error) throw bannersRes.error;

            setSponsors(sponsorsRes.data || []);
            setBanners(bannersRes.data || []);
        } catch (err: any) {
            toast.error("Failed to load report data: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredBanners = selectedSponsor === "all"
        ? banners
        : banners.filter(b => b.sponsor_id === selectedSponsor);

    const totalImpressions = filteredBanners.reduce((acc, curr) => acc + (curr.impressions_count || 0), 0);
    const totalClicks = filteredBanners.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0);
    const averageCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    const generatePDF = async () => {
        setGenerating(true);
        try {
            const gymName = await fetchGymNameForReport(user?.gymId || (user as any)?.gym_id);
            const safeFilename = gymName.replace(/[^a-zA-Z0-9_-]/g, '_');

            const doc = new jsPDF();
            const sponsorName = selectedSponsor === "all" ? "All Sponsors" : sponsors.find(s => s.id === selectedSponsor)?.name || "Sponsor";

            const generatedBy = user?.name || user?.email || 'Admin';
            const startY = addBrandedHeader(
                doc,
                gymName,
                "Sponsor Performance Report",
                `Partner: ${sponsorName}`,
                generatedBy
            );

            // Summary Section
            doc.setFontSize(14);
            doc.setTextColor(42, 75, 42);
            doc.text("Executive Summary", 15, startY);

            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            doc.text([
                `Total Advertisements: ${filteredBanners.length}`,
                `Total Impressions: ${totalImpressions.toLocaleString()}`,
                `Total Clicks: ${totalClicks.toLocaleString()}`,
                `Average Click-Through Rate (CTR): ${averageCTR.toFixed(2)}%`,
            ], 15, startY + 8);

            // Ad Performance Table
            const tableData = filteredBanners.map(b => [
                b.placement_type.replace('_', ' ').toUpperCase(),
                b.impressions_count?.toLocaleString() || '0',
                b.clicks_count?.toLocaleString() || '0',
                `${(b.impressions_count > 0 ? (b.clicks_count / b.impressions_count) * 100 : 0).toFixed(2)}%`,
                b.is_active ? "ACTIVE" : "INACTIVE"
            ]);

            autoTable(doc, {
                startY: startY + 35,
                head: [['Placement', 'Impressions', 'Clicks', 'CTR', 'Status']],
                body: tableData,
                headStyles: { fillColor: [42, 75, 42], textColor: [255, 255, 255] },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                margin: { left: 15, right: 15 }
            });

            doc.save(`${safeFilename}_Sponsor_Report_${sponsorName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
            toast.success("Report generated successfully");
        } catch (err: any) {
            toast.error("Failed to generate PDF: " + err.message);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Sponsor Reports</h1>
                    <p className="text-muted-foreground">Detailed analytics and professional exports for your partners.</p>
                </div>
                <Button
                    onClick={generatePDF}
                    disabled={generating || filteredBanners.length === 0}
                    className="gap-2 shadow-modern-md"
                >
                    {generating ? (
                        <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div>
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    {generating ? "Generating..." : "Export PDF Report"}
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-sidebar-accent/40 border-sidebar-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Impressions</CardTitle>
                        <Eye className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalImpressions.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Ad views across platform</p>
                    </CardContent>
                </Card>
                <Card className="bg-sidebar-accent/40 border-sidebar-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Clicks</CardTitle>
                        <MousePointer2 className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Active interactions</p>
                    </CardContent>
                </Card>
                <Card className="bg-sidebar-accent/40 border-sidebar-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Average CTR</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{averageCTR.toFixed(2)}%</div>
                        <p className="text-xs text-muted-foreground">Click-Through Rate</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1 border-sidebar-border/50 bg-sidebar-accent/20 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Report Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Select Sponsor</label>
                            <Select value={selectedSponsor} onValueChange={setSelectedSponsor}>
                                <SelectTrigger className="bg-sidebar-accent/50 border-sidebar-border/50">
                                    <SelectValue placeholder="Select a sponsor" />
                                </SelectTrigger>
                                <SelectContent className="bg-sidebar-accent border-sidebar-border/50">
                                    <SelectItem value="all">All Partners</SelectItem>
                                    {sponsors.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="pt-4 border-t border-sidebar-border/50">
                            <div className="flex items-center gap-2 text-sm text-yellow-500 mb-2">
                                <FileText className="h-4 w-4" />
                                <span>PDF Format: Professional Branded</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                This report includes impression counts, click tracking, and CTR performance for each placement associated with the selected partner.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2 border-sidebar-border/50 bg-sidebar-accent/20 backdrop-blur-sm shadow-modern overflow-hidden">
                    <CardHeader className="border-b border-sidebar-border/50">
                        <CardTitle className="text-lg">Placement Detailed Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-20 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                        ) : filteredBanners.length === 0 ? (
                            <div className="py-20 text-center text-muted-foreground">
                                <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-10" />
                                <p>No advertisements found for this selection.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-sidebar-accent/50 text-muted-foreground">
                                        <tr>
                                            <th className="text-left py-3 px-4 font-medium uppercase tracking-wider text-[10px]">Placement</th>
                                            <th className="text-right py-3 px-4 font-medium uppercase tracking-wider text-[10px]">Impressions</th>
                                            <th className="text-right py-3 px-4 font-medium uppercase tracking-wider text-[10px]">Clicks</th>
                                            <th className="text-right py-3 px-4 font-medium uppercase tracking-wider text-[10px]">CTR</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/30">
                                        {filteredBanners.map((b) => (
                                            <tr key={b.id} className="hover:bg-sidebar-accent/30 transition-colors">
                                                <td className="py-3 px-4 capitalize font-medium">{b.placement_type.replace('_', ' ')}</td>
                                                <td className="py-3 px-4 text-right font-mono">{b.impressions_count?.toLocaleString()}</td>
                                                <td className="py-3 px-4 text-right font-mono">{b.clicks_count?.toLocaleString()}</td>
                                                <td className="py-3 px-4 text-right">
                                                    <Badge variant="outline" className="font-mono text-[10px]">
                                                        {(b.impressions_count > 0 ? (b.clicks_count / b.impressions_count) * 100 : 0).toFixed(2)}%
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
