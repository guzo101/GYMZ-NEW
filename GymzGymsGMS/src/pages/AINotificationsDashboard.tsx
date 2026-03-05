/**
 * AI & Notifications Admin Dashboard
 * 
 * Purpose: Give admins full control over:
 * - AI Chat message templates (edit, enable/disable, A/B test)
 * - Notification rules (when to trigger, frequency limits)
 * - Real-time stats (messages sent, costs, open rates)
 * - Test mode (send test messages to specific users)
 * 
 * UI Framework: Shadcn UI + Lucide React
 */

import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Edit,
    Play,
    Info,
    MessageSquare,
    Zap,
    BarChart3,
    Settings2,
    TrendingUp,
    History,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getOrCreateThreadId, getOrCreateChatId, storeMessage } from '@/services/aiChat';
import { toast } from "sonner";

interface NotificationTemplate {
    id: string;
    template_key: string;
    category: string;
    channel: string;
    content: string;
    enabled: boolean;
    priority: number;
    variant: string;
    usage_count: number;
    last_used_at: string | null;
}

interface NotificationRule {
    id: string;
    rule_key: string;
    rule_name: string;
    description: string;
    enabled: boolean;
    trigger_type: string;
    max_per_day: number;
    max_per_week: number;
    min_hours_between: number;
}

interface NotificationStats {
    date: string;
    channel: string;
    notification_type: string;
    total_sent: number;
    total_opened: number;
    open_rate_percent: number;
    unique_users: number;
}

interface AIChatCostStats {
    date: string;
    ai_messages: number;
    total_tokens: number;
    total_cost_usd: number;
    avg_generation_time: number;
}

export default function AINotificationsDashboard() {
    const [activeTab, setActiveTab] = useState("templates");
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [rules, setRules] = useState<NotificationRule[]>([]);
    const [notificationStats, setNotificationStats] = useState<NotificationStats[]>([]);
    const [costStats, setCostStats] = useState<AIChatCostStats[]>([]);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
    const [testDialogOpen, setTestDialogOpen] = useState(false);
    const [testTemplate, setTestTemplate] = useState<NotificationTemplate | null>(null);
    const [testMemberId, setTestMemberId] = useState('');
    const [testManualUserId, setTestManualUserId] = useState('');
    const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);
    const [sendingTest, setSendingTest] = useState(false);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    // Load data on mount
    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        await Promise.all([
            loadTemplates(),
            loadRules(),
            loadNotificationStats(),
            loadCostStats()
        ]);
        setLoading(false);
    };

    const loadTemplates = async () => {
        const { data } = await supabase
            .from('notification_templates' as any)
            .select('*')
            .order('category', { ascending: true });
        if (data) setTemplates(data);
    };

    const loadRules = async () => {
        const { data } = await supabase
            .from('notification_rules' as any)
            .select('*')
            .order('rule_name', { ascending: true });
        if (data) setRules(data);
    };

    const loadNotificationStats = async () => {
        const { data } = await supabase
            .from('admin_notification_stats_daily' as any)
            .select('*')
            .limit(30);
        if (data) setNotificationStats(data);
    };

    const loadCostStats = async () => {
        const { data } = await supabase
            .from('admin_ai_chat_costs' as any)
            .select('*')
            .limit(30);
        if (data) setCostStats(data);
    };

    const handleToggleTemplate = async (templateId: string, enabled: boolean) => {
        const { error } = await supabase
            .from('notification_templates' as any)
            .update({ enabled: !enabled })
            .eq('id', templateId);

        if (error) {
            toast.error("Failed to update template");
        } else {
            toast.success(enabled ? "Template disabled" : "Template enabled");
            loadTemplates();
        }
    };

    const handleToggleRule = async (ruleId: string, enabled: boolean) => {
        const { error } = await supabase
            .from('notification_rules' as any)
            .update({ enabled: !enabled })
            .eq('id', ruleId);

        if (error) {
            toast.error("Failed to update rule");
        } else {
            toast.success(enabled ? "Rule disabled" : "Rule enabled");
            loadRules();
        }
    };

    const handleEditTemplate = (template: NotificationTemplate) => {
        setSelectedTemplate({ ...template });
        setEditDialogOpen(true);
    };

    const handleSaveTemplate = async () => {
        if (!selectedTemplate) return;

        const { error } = await supabase
            .from('notification_templates' as any)
            .update({
                content: selectedTemplate.content,
                priority: selectedTemplate.priority,
            })
            .eq('id', selectedTemplate.id);

        if (error) {
            toast.error("Failed to save changes");
        } else {
            toast.success("Changes saved successfully");
            setEditDialogOpen(false);
            loadTemplates();
        }
    };

    const handleOpenTestDialog = (template: NotificationTemplate) => {
        setTestTemplate(template);
        setTestDialogOpen(true);
        setTestMemberId('');
        setTestManualUserId('');
    };

    useEffect(() => {
        if (!user?.gymId || !testDialogOpen) return;
        (async () => {
            const { data } = await supabase
                .from('users')
                .select('id, name, email')
                .eq('gym_id', user.gymId)
                .eq('role', 'member')
                .order('name');
            setMembers((data || []) as { id: string; name: string; email: string }[]);
        })();
    }, [user?.gymId, testDialogOpen]);

    const handleSendTest = async () => {
        if (!testTemplate) return;
        const userId = testMemberId || testManualUserId.trim();
        if (!userId) {
            toast.error("Select a member or paste a User ID");
            return;
        }
        setSendingTest(true);
        try {
            const substituteVars = (text: string, firstName = 'Member') =>
                text
                    .replace(/\{first_name\}/g, firstName)
                    .replace(/\{streak\}/g, '0')
                    .replace(/\{gym_visits_week\}/g, '0')
                    .replace(/\{day\}/g, new Date().toLocaleDateString('en-US', { weekday: 'long' }))
                    .replace(/\{time\}/g, new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));

            if (testTemplate.channel?.toLowerCase() === 'push') {
                const content = substituteVars(testTemplate.content);
                const { data, error } = await supabase.functions.invoke('send-push-to-user', {
                    body: { user_id: userId, title: `Test: ${testTemplate.template_key}`, body: content.substring(0, 200) },
                });
                if (error) throw error;
                if (data?.success) {
                    toast.success(data.message || 'Push sent');
                } else {
                    toast.error(data?.error || 'Push failed');
                }
            } else if (testTemplate.channel?.toLowerCase() === 'ai_chat') {
                const { data: userData } = await supabase.from('users').select('first_name, name').eq('id', userId).maybeSingle();
                const firstName = userData?.first_name || userData?.name?.split(' ')[0] || 'Member';
                const content = substituteVars(testTemplate.content, firstName);
                const threadId = await getOrCreateThreadId(userId);
                const chatId = await getOrCreateChatId(userId, threadId);
                await storeMessage(userId, threadId, chatId, 'ai', content);
                toast.success('AI Chat test message sent. Member will see it when they open Gymz AI.');
            } else {
                toast.info(`Test for ${testTemplate.channel} — only Push and AI Chat are supported.`);
            }
            setTestDialogOpen(false);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to send test');
        } finally {
            setSendingTest(false);
        }
    };

    const stats = {
        messagesToday: notificationStats.length > 0
            ? notificationStats.filter(s => s.date === notificationStats[0]?.date).reduce((sum, s) => sum + s.total_sent, 0)
            : 0,
        costToday: costStats.length > 0 ? (costStats[0]?.total_cost_usd || 0) : 0,
        avgOpenRate: notificationStats.length > 0
            ? (notificationStats.reduce((sum, s) => sum + s.total_sent, 0) > 0
                ? (notificationStats.reduce((sum, s) => sum + s.total_opened, 0) / notificationStats.reduce((sum, s) => sum + s.total_sent, 0) * 100).toFixed(1)
                : "0")
            : "0",
        activeTemplates: `${templates.filter(t => t.enabled).length}/${templates.length}`
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">AI & Notifications Control Center</h1>
                <p className="text-muted-foreground">Monitor and manage all automated engagement touchpoints.</p>
            </div>

            <Alert variant="default" className="bg-primary border-primary dark:bg-primary/20 dark:border-primary">
                <Info className="h-4 w-4 text-primary dark:text-primary" />
                <AlertTitle className="text-primary dark:text-primary font-semibold">Admin Oversight Active</AlertTitle>
                <AlertDescription className="text-primary dark:text-primary">
                    Every AI message and push notification is governed by these rules. Disabling a rule or template takes effect immediately.
                </AlertDescription>
            </Alert>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="relative overflow-hidden group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Messages Sent (Today)</CardTitle>
                        {/* Absolute icon container for dashboard consistency */}
                        <div className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-foreground/20 shadow-md">
                            <Zap className="h-3.5 w-3.5 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.messagesToday}</div>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">AI Cost (Today)</CardTitle>
                        {/* Absolute icon container for dashboard consistency */}
                        <div className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-foreground/20 shadow-md">
                            <TrendingUp className="h-3.5 w-3.5 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${stats.costToday.toFixed(4)}</div>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Avg Open Rate</CardTitle>
                        {/* Absolute icon container for dashboard consistency */}
                        <div className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-foreground/20 shadow-md">
                            <BarChart3 className="h-3.5 w-3.5 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.avgOpenRate}%</div>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Templates</CardTitle>
                        {/* Absolute icon container for dashboard consistency */}
                        <div className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-foreground/20 shadow-md">
                            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeTemplates}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
                    <TabsTrigger value="templates" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" /> Templates
                    </TabsTrigger>
                    <TabsTrigger value="rules" className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4" /> Rules
                    </TabsTrigger>
                    <TabsTrigger value="stats" className="flex items-center gap-2">
                        <History className="h-4 w-4" /> Statistics
                    </TabsTrigger>
                </TabsList>

                {/* Tab Content: Templates */}
                <TabsContent value="templates" className="mt-4 border rounded-xl overflow-hidden bg-card">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Key</TableHead>
                                <TableHead>Channel</TableHead>
                                <TableHead className="w-[30%]">Content Preview</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {templates.map((template) => (
                                <TableRow key={template.id}>
                                    <TableCell><Badge variant="outline">{template.category}</Badge></TableCell>
                                    <TableCell className="font-medium text-xs font-mono">{template.template_key}</TableCell>
                                    <TableCell>
                                        <Badge variant={template.channel === 'ai_chat' ? 'default' : 'secondary'} className="capitalize">
                                            {template.channel.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground truncate max-w-0">
                                        {template.content.substring(0, 60)}...
                                    </TableCell>
                                    <TableCell>{template.priority}</TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={template.enabled}
                                            onCheckedChange={() => handleToggleTemplate(template.id, template.enabled)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenTestDialog(template)} title="Send test">
                                                <Play className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                {/* Tab Content: Rules */}
                <TabsContent value="rules" className="mt-4 border rounded-xl overflow-hidden bg-card">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Rule Name</TableHead>
                                <TableHead className="w-[40%]">Description</TableHead>
                                <TableHead>Trigger</TableHead>
                                <TableHead>Limits</TableHead>
                                <TableHead>Enabled</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rules.map((rule) => (
                                <TableRow key={rule.id}>
                                    <TableCell className="font-semibold">{rule.rule_name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{rule.description}</TableCell>
                                    <TableCell><Badge variant="outline">{rule.trigger_type}</Badge></TableCell>
                                    <TableCell className="text-xs">
                                        {rule.max_per_day}/day · {rule.max_per_week}/wk · {rule.min_hours_between}h gap
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={rule.enabled}
                                            onCheckedChange={() => handleToggleRule(rule.id, rule.enabled)}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                {/* Tab Content: Statistics */}
                <TabsContent value="stats" className="mt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader><CardTitle className="text-lg">Recent Engagement (Last 7 Days)</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Sent</TableHead>
                                            <TableHead>Opened</TableHead>
                                            <TableHead className="text-right">Rate</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {notificationStats.slice(0, 7).map((s, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-xs">{s.date}</TableCell>
                                                <TableCell>{s.total_sent}</TableCell>
                                                <TableCell>{s.total_opened}</TableCell>
                                                <TableCell className="text-right font-medium text-primary">{s.open_rate_percent}%</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle className="text-lg">AI Performance & Cost</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Msgs</TableHead>
                                            <TableHead>Latency</TableHead>
                                            <TableHead className="text-right">Cost</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {costStats.slice(0, 7).map((s, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-xs">{s.date}</TableCell>
                                                <TableCell>{s.ai_messages}</TableCell>
                                                <TableCell>{s.avg_generation_time?.toFixed(0)}ms</TableCell>
                                                <TableCell className="text-right font-medium text-green-600">${s.total_cost_usd?.toFixed(4)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

            </Tabs>

            {/* Test Send Dialog */}
            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                <DialogContent className="sm:max-w-[480px] rounded-xl border-border/50 shadow-xl">
                    <DialogHeader className="space-y-1.5 pb-2">
                        <DialogTitle className="text-lg font-semibold">Send Test Notification</DialogTitle>
                        {testTemplate && (
                            <DialogDescription className="text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
                                    {testTemplate.template_key}
                                </span>
                                <span className="mx-1.5">·</span>
                                <span className="capitalize">{testTemplate.channel.replace('_', ' ')}</span>
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    {testTemplate && (
                        <div className="space-y-5 py-2">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Choose member</Label>
                                <Select value={testMemberId} onValueChange={(v) => { setTestMemberId(v); setTestManualUserId(''); }}>
                                    <SelectTrigger className="h-10 rounded-lg border bg-background">
                                        <SelectValue placeholder={members.length === 0 ? 'No members in your gym' : 'Select a member'} />
                                    </SelectTrigger>
                                    <SelectContent className="z-[200] max-h-[200px] rounded-lg">
                                        {members.map((m) => (
                                            <SelectItem key={m.id} value={m.id} className="cursor-pointer">
                                                {m.name || m.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase tracking-wider text-muted-foreground">
                                    <span className="bg-background px-2">or</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Paste User ID</Label>
                                <Input
                                    value={testManualUserId}
                                    onChange={(e) => { setTestManualUserId(e.target.value); if (e.target.value) setTestMemberId(''); }}
                                    placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                                    className="h-10 rounded-lg font-mono text-xs"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 pt-4 border-t">
                        <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSendTest} disabled={sendingTest}>
                            {sendingTest ? 'Sending...' : 'Send Test'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Notification Template</DialogTitle>
                        <DialogDescription>
                            Update the message content. Changes are saved to the master template.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedTemplate && (
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Template Key</Label>
                                <Input value={selectedTemplate.template_key} disabled className="bg-muted" />
                            </div>
                            <div className="space-y-2">
                                <Label>Message Content</Label>
                                <Textarea
                                    value={selectedTemplate.content}
                                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate!, content: e.target.value })}
                                    rows={5}
                                />
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider pt-1">
                                    Variables: &#123;first_name&#125; · &#123;streak&#125; · &#123;gym_visits_week&#125; · &#123;day&#125; · &#123;time&#125;
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Priority (1-Highest, 5-Lowest)</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={selectedTemplate.priority}
                                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate!, priority: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTemplate}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

const CardFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={`mt-4 ${className}`}>{children}</div>
);
