import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Settings, Webhook, CheckCircle, AlertCircle, Bot, RefreshCcw, Code, Plus, Trash2, Key, Sparkles, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

const DEFAULT_PAYLOAD = {
  source: "gms_webhook_test_structure_definition",
  sender_type: "test_admin",
  user_id: "test-user-id-550e8400-e29b-41d4-a716-446655440000",
  thread_id: "test-thread-id-thread_abc123xyz",
  chat_id: "test-chat-id-chat_xyz789abc",
  message: "Test message for Structure Definition. This payload contains ALL variables from App, Website, and GMS to allow full mapping in Make.com.",
  timestamp: new Date().toISOString(),
  context: {
    // Shared
    platform: "gms_test_all_variables",
    is_test: true,
    note: "This payload contains ALL possible variables for Make.com data structure definition",

    // Mobile App - Personal AI
    user_name: "Test User",
    user_email: "test@example.com",
    membership_status: "Active",
    membership_due_date: "2026-12-31",
    payment_status: "Paid",
    goal: "Hypertrophy",
    nutrition_preferences: "High Protein",
    workout_history: "Last workout: Chest Day (Yesterday)",
    class_schedule: "Mon/Wed/Fri 6AM",
    local_time: "10:00 AM",
    user_timezone: "Africa/Johannesburg",

    // Mobile App / GMS / Website - Community Chat
    message_id: "msg_test_123",
    reply_to: "msg_test_122", // ID of message being replied to
    is_reply: false,
    conversation_context: "User A asked about protein. User B suggested whey.",
    topic_keywords: "nutrition, supplements",
    thread_messages_count: 5,
    last_user_message_id: "msg_test_123",
    message_created_at: new Date().toISOString(),
    minutes_since_message: 0.5,
    thread_participants: ["user", "admin", "ai"],
    actual_user_message: "Does anyone recommend creatine?",
    source: "community_chat_test"
  }
};

export default function AISettings() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [scannerModel, setScannerModel] = useState("gpt-4o");
  const [currentWebhookUrl, setCurrentWebhookUrl] = useState<string | null>(null);
  const [allSettings, setAllSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [growthAutoPilot, setGrowthAutoPilot] = useState(false);
  const [growthFrequency, setGrowthFrequency] = useState(7);
  const [payloadJson, setPayloadJson] = useState(JSON.stringify(DEFAULT_PAYLOAD, null, 2));
  const [activeTab, setActiveTab] = useState("simple");
  const [mainTab, setMainTab] = useState("webhook"); // webhook or system-prompt
  const [systemPrompt, setSystemPrompt] = useState("");
  const [capabilities, setCapabilities] = useState({
    goals: true,
    nutrition: true,
    workouts: true,
    tracking: true,
    coaching: true,
    rooms: true
  });
  const [aiProvider, setAiProvider] = useState("make"); // make or openai

  // Helper to safely parse JSON
  const safeParse = (json: string) => {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  // Derived state for simple mode fields
  const parsed = safeParse(payloadJson) || DEFAULT_PAYLOAD;
  const contextEntries = parsed.context ? Object.entries(parsed.context) : [];

  useEffect(() => {
    fetchCurrentSettings();
  }, []);

  const fetchCurrentSettings = async () => {
    try {
      setLoading(true);
      const { data: allRows } = await db
        .from("ai_settings")
        .select("id, webhook_url, description, is_active, created_at, ai_provider")
        .order("created_at", { ascending: false });
      setAllSettings(allRows || []);

      const { data, error } = await db
        .from("ai_settings")
        .select("webhook_url, description, auto_reply_enabled, openai_api_key, scanner_model, growth_auto_pilot, growth_frequency_days, system_prompt, capabilities_enabled, ai_provider")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to fetch settings: ${error.message}`);
      }

      if (data) {
        setCurrentWebhookUrl(data.webhook_url);
        setWebhookUrl(data.webhook_url);
        setOpenaiKey(data.openai_api_key || "");
        setScannerModel(data.scanner_model || "gpt-4o");
        setDescription(data.description || "");
        setAutoReplyEnabled(data.auto_reply_enabled || false);
        setGrowthAutoPilot(data.growth_auto_pilot || false);
        setGrowthFrequency(data.growth_frequency_days || 7);
        setSystemPrompt(data.system_prompt || "");
        setAiProvider(data.ai_provider || "make");
        setCapabilities(data.capabilities_enabled || {
          goals: true,
          nutrition: true,
          workouts: true,
          tracking: true,
          coaching: true,
          rooms: true
        });
      }
    } catch (error: any) {
      console.error("Error fetching AI settings:", error);
      toast.error("Failed to load AI settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!webhookUrl.trim()) {
      toast.error("Webhook URL is required");
      return;
    }

    try {
      new URL(webhookUrl);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    try {
      setSaving(true);

      const { data: existing } = await db
        .from("ai_settings")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();

      if (existing) {
        const { error } = await db
          .from("ai_settings")
          .update({
            webhook_url: webhookUrl.trim(),
            openai_api_key: openaiKey.trim() || null,
            scanner_model: scannerModel,
            description: description.trim() || null,
            auto_reply_enabled: autoReplyEnabled,
            growth_auto_pilot: growthAutoPilot,
            growth_frequency_days: growthFrequency,
            system_prompt: systemPrompt || null,
            ai_provider: aiProvider,
            capabilities_enabled: capabilities,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) {
          throw new Error(`Failed to update settings: ${error.message}`);
        }
      } else {
        await db
          .from("ai_settings")
          .update({ is_active: false })
          .eq("is_active", true);

        const { error } = await db.from("ai_settings").insert({
          webhook_url: webhookUrl.trim(),
          openai_api_key: openaiKey.trim() || null,
          scanner_model: scannerModel,
          description: description.trim() || null,
          is_active: true,
          auto_reply_enabled: autoReplyEnabled,
          growth_auto_pilot: growthAutoPilot,
          growth_frequency_days: growthFrequency,
          system_prompt: systemPrompt || null,
          ai_provider: aiProvider,
          capabilities_enabled: capabilities,
        });

        if (error) {
          throw new Error(`Failed to save settings: ${error.message}`);
        }
      }

      setCurrentWebhookUrl(webhookUrl.trim());
      toast.success("AI settings saved successfully!");
    } catch (error: any) {
      console.error("Error saving AI settings:", error);
      toast.error(error.message || "Failed to save AI settings");
    } finally {
      setSaving(false);
    }
  };

  // Explicit control: activate a specific saved config row (controls which webhook/provider is actually used)
  const activateConfig = async (id: string) => {
    try {
      setSaving(true);
      const { error: deactErr } = await db
        .from("ai_settings")
        .update({ is_active: false })
        .eq("is_active", true);
      if (deactErr) throw new Error(deactErr.message);

      const { error: actErr } = await db
        .from("ai_settings")
        .update({ is_active: true })
        .eq("id", id);
      if (actErr) throw new Error(actErr.message);

      toast.success("Activated AI configuration");
      await fetchCurrentSettings();
    } catch (e: any) {
      console.error("Error activating config:", e);
      toast.error(e?.message || "Failed to activate configuration");
    } finally {
      setSaving(false);
    }
  };

  // Save current form as a NEW row and activate it (lets you switch between multiple webhooks without guessing)
  const handleSaveAsNew = async () => {
    if (!webhookUrl.trim()) {
      toast.error("Webhook URL is required");
      return;
    }

    try {
      new URL(webhookUrl);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    try {
      setSaving(true);

      await db.from("ai_settings").update({ is_active: false }).eq("is_active", true);

      const { error } = await db.from("ai_settings").insert({
        webhook_url: webhookUrl.trim(),
        openai_api_key: openaiKey.trim() || null,
        scanner_model: scannerModel,
        description: description.trim() || null,
        is_active: true,
        auto_reply_enabled: autoReplyEnabled,
        growth_auto_pilot: growthAutoPilot,
        growth_frequency_days: growthFrequency,
        system_prompt: systemPrompt || null,
        ai_provider: aiProvider,
        capabilities_enabled: capabilities,
      });

      if (error) throw new Error(error.message);

      toast.success("Saved new AI configuration and activated it");
      await fetchCurrentSettings();
    } catch (e: any) {
      console.error("Error saving new config:", e);
      toast.error(e?.message || "Failed to save new configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAutoReply = async (enabled: boolean) => {
    try {
      const { error } = await db
        .from("ai_settings")
        .update({ auto_reply_enabled: enabled })
        .eq("is_active", true);

      if (error) {
        if (error.code === "PGRST116" || error.message.includes("does not exist")) {
          setAutoReplyEnabled(enabled);
          return;
        }
        throw new Error(`Failed to update auto-reply setting: ${error.message}`);
      }

      setAutoReplyEnabled(enabled);
      toast.success(enabled ? "AI auto-reply enabled" : "AI auto-reply disabled");
    } catch (error: any) {
      console.error("Error updating auto-reply setting:", error);
      toast.error(error.message || "Failed to update auto-reply setting");
    }
  };

  const resetPayload = () => {
    const freshPayload = {
      ...DEFAULT_PAYLOAD,
      timestamp: new Date().toISOString()
    };
    setPayloadJson(JSON.stringify(freshPayload, null, 2));
    toast.info("Unsaved test payload reset to default");
  };

  // Visual Editor Handlers
  const handleSimpleFieldChange = (key: string, value: string) => {
    const newPayload = { ...parsed, [key]: value };
    setPayloadJson(JSON.stringify(newPayload, null, 2));
  };

  const updateContextVariable = (key: string, value: any) => {
    const newContext = { ...parsed.context, [key]: value };
    const newPayload = { ...parsed, context: newContext };
    setPayloadJson(JSON.stringify(newPayload, null, 2));
  };

  const addContextVariable = () => {
    const newKey = `new_variable_${contextEntries.length + 1}`;
    updateContextVariable(newKey, "value");
  };

  const removeContextVariable = (key: string) => {
    const newContext = { ...parsed.context };
    delete newContext[key];
    const newPayload = { ...parsed, context: newContext };
    setPayloadJson(JSON.stringify(newPayload, null, 2));
  };

  const handleContextKeyChange = (oldKey: string, newKey: string, value: any) => {
    if (!newKey) return;
    const newContext = { ...parsed.context };
    delete newContext[oldKey];
    newContext[newKey] = value;
    const newPayload = { ...parsed, context: newContext };
    setPayloadJson(JSON.stringify(newPayload, null, 2));
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast.error("Please enter a webhook URL first");
      return;
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payloadJson);
    } catch (e) {
      toast.error("Invalid JSON format in test payload. Please fix syntax errors.");
      return;
    }

    parsedPayload.timestamp = new Date().toISOString();

    try {
      console.log("Sending webhook test payload:", parsedPayload);

      const response = await fetch(webhookUrl.trim(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedPayload),
      });

      console.log("Webhook response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Webhook error body:", errorText);
        throw new Error(`Webhook test failed: ${response.status} ${errorText}`);
      }

      const responseText = await response.text();
      console.log("Webhook response text:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        if (responseText.trim().toLowerCase() === "accepted") {
          toast.success("Webhook test successful! Make.com received (Accepted).");
          return;
        }
        throw new Error(`Invalid JSON response. Expected JSON.`);
      }

      console.log("Webhook response data:", data);

      if (data.reply) {
        toast.success("Webhook test successful! AI responded.");
      } else {
        toast.warning("Webhook responded but format may be incorrect.");
      }
    } catch (error: any) {
      console.error("Error testing webhook:", error);
      if (error.name === "TypeError" && error.message === "Failed to fetch") {
        toast.error("Network Error: Check URL and CORS.");
      } else {
        toast.error(error.message || "Failed to test webhook");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading AI settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Settings className="h-8 w-8" />
          AI Integration Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure webhook, system prompt, and AI capabilities
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Active AI Configuration (No Guessing)
          </CardTitle>
          <CardDescription>
            The app uses exactly one row in <span className="font-mono">ai_settings</span>: the one with <span className="font-mono">is_active = true</span>.
            Activate the exact webhook/provider you want here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allSettings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI configurations found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="py-2 text-left">Active</th>
                    <th className="py-2 text-left">Provider</th>
                    <th className="py-2 text-left">Description</th>
                    <th className="py-2 text-left">Webhook URL</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allSettings.slice(0, 10).map((row) => (
                    <tr key={row.id}>
                      <td className="py-2">{row.is_active ? "✅" : ""}</td>
                      <td className="py-2 font-mono">{row.ai_provider || "make"}</td>
                      <td className="py-2">{row.description || "—"}</td>
                      <td className="py-2 font-mono max-w-[520px] truncate" title={row.webhook_url}>
                        {row.webhook_url}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant={row.is_active ? "secondary" : "default"}
                          disabled={saving || row.is_active}
                          onClick={() => activateConfig(row.id)}
                        >
                          {row.is_active ? "Active" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-2">
                Showing latest 10 configs. Use “Save as new config” below to create another selectable webhook.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="webhook">Webhook Config</TabsTrigger>
          <TabsTrigger value="system-prompt">System Prompt</TabsTrigger>
        </TabsList>

        {/* WEBHOOK CONFIG TAB */}
        <TabsContent value="webhook">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    Make.ai Webhook Configuration
                  </CardTitle>
                  <CardDescription>
                    Enter the webhook URL provided by Make.ai and select the primary AI provider.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="ai-provider">Primary AI Provider</Label>
                    <select
                      id="ai-provider"
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value)}
                      className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none"
                    >
                      <option value="make">Make.com Webhook (Balanced)</option>
                      <option value="openai">Direct OpenAI API (Fastest / Recommended for Users)</option>
                    </select>
                    <p className="text-[10px] text-muted-foreground">
                      Direct OpenAI is recommended for personal coach chats to reduce latency.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Webhook URL *</Label>
                    <Input
                      id="webhook-url"
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://hook.us1.make.com/..."
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scanner-model">Calorie Scanner AI Model</Label>
                    <select
                      id="scanner-model"
                      value={scannerModel}
                      onChange={(e) => setScannerModel(e.target.value)}
                      className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none"
                    >
                      <option value="gpt-4o">GPT-4o (Most Powerful / Recommended)</option>
                      <option value="gpt-4o-mini">GPT-4o-mini (Faster / Cheaper)</option>
                    </select>
                    <p className="text-[10px] text-muted-foreground">
                      The model used specifically for image analysis in the mobile app scanner.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openai-key">OpenAI API Key (for Vision/Scanning)</Label>
                    <div className="relative">
                      <Input
                        id="openai-key"
                        type="password"
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                        placeholder="sk-..."
                        className="font-mono text-sm pr-8"
                      />
                      <Key className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Used by the mobile app's Calorie Scanner to analyze food images.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g., Production webhook..."
                    />
                  </div>

                  {currentWebhookUrl ? (
                    <div className="flex items-start gap-2 p-4 bg-muted rounded-lg">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Current Active Webhook</p>
                        <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
                          {currentWebhookUrl}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          No webhook configured
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="auto-reply" className="text-base flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          AI Auto-Reply in Community Chat
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Enable automatic AI replies.
                        </p>
                      </div>
                      <Switch
                        id="auto-reply"
                        checked={autoReplyEnabled}
                        onCheckedChange={handleToggleAutoReply}
                        disabled={!currentWebhookUrl}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSave} disabled={saving || !webhookUrl.trim()}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Settings"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    Autonomous Growth Agent (Level 3)
                  </CardTitle>
                  <CardDescription>
                    Configure how the AI manages your outreach autonomously.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        Full Auto-Pilot
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically send high-confidence drafts.
                      </p>
                    </div>
                    <Switch
                      checked={growthAutoPilot}
                      onCheckedChange={setGrowthAutoPilot}
                    />
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="growth-freq" className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Frequency Capping (Days)
                    </Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="growth-freq"
                        type="number"
                        value={growthFrequency}
                        onChange={(e) => setGrowthFrequency(parseInt(e.target.value))}
                        className="w-24"
                        min={1}
                        max={30}
                      />
                      <p className="text-xs text-muted-foreground">
                        Prevent spamming. Min days between outreach to same member.
                      </p>
                    </div>
                  </div>

                  <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Autonomy Heuristics</h4>
                    <ul className="text-[10px] space-y-1 text-muted-foreground">
                      <li className="flex items-start gap-1">
                        <CheckCircle className="h-3 w-3 text-primary mt-0.5" />
                        Confidence {'>'} 0.85 required for Auto-Pilot delivery.
                      </li>
                      <li className="flex items-start gap-1">
                        <CheckCircle className="h-3 w-3 text-primary mt-0.5" />
                        Templates used if AI generation fails.
                      </li>
                      <li className="flex items-start gap-1">
                        <CheckCircle className="h-3 w-3 text-primary mt-0.5" />
                        Batch size limited to 50 recipients per scan.
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      Test Payload
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetPayload} className="h-8 px-2">
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Configure the payload sent for testing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="simple">Simple Builder</TabsTrigger>
                      <TabsTrigger value="json">JSON Editor</TabsTrigger>
                    </TabsList>

                    <TabsContent value="simple" className="flex-1 flex flex-col gap-4 mt-4">
                      <div className="space-y-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor="p-source">Source</Label>
                          <Input
                            id="p-source"
                            value={parsed.source || ""}
                            onChange={(e) => handleSimpleFieldChange("source", e.target.value)}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="p-sender">Sender Type</Label>
                          <Input
                            id="p-sender"
                            value={parsed.sender_type || ""}
                            onChange={(e) => handleSimpleFieldChange("sender_type", e.target.value)}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="p-message">Message</Label>
                          <Textarea
                            id="p-message"
                            value={parsed.message || ""}
                            onChange={(e) => handleSimpleFieldChange("message", e.target.value)}
                            className="h-20"
                          />
                        </div>

                        <div className="pt-2">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="font-semibold">Context Variables</Label>
                            <Button variant="outline" size="sm" onClick={addContextVariable} className="h-7 text-xs">
                              <Plus className="h-3 w-3 mr-1" /> Add Variable
                            </Button>
                          </div>

                          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                            {contextEntries.map(([key, value], idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <Input
                                  value={key}
                                  onChange={(e) => handleContextKeyChange(key, e.target.value, value)}
                                  placeholder="Key"
                                  className="h-8 text-xs font-mono w-1/3"
                                />
                                <Input
                                  value={String(value)}
                                  onChange={(e) => updateContextVariable(key, e.target.value)}
                                  placeholder="Value"
                                  className="h-8 text-xs flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => removeContextVariable(key)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            {contextEntries.length === 0 && (
                              <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-md">
                                No context variables. Click "Add Variable" to create one.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="json" className="flex-1 min-h-[400px]">
                      <Textarea
                        value={payloadJson}
                        onChange={(e) => setPayloadJson(e.target.value)}
                        className="font-mono text-sm h-full resize-none p-4"
                        spellCheck={false}
                      />
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={handleTestWebhook}
                      disabled={!webhookUrl.trim() || saving}
                    >
                      <Webhook className="h-4 w-4 mr-2" />
                      Send Test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* SYSTEM PROMPT TAB */}
        <TabsContent value="system-prompt" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                AI System Prompt
              </CardTitle>
              <CardDescription>
                Define the AI's behavior, personality, and action capabilities. This prompt is sent with every AI request.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Enter AI system instructions..."
                  className="min-h-[400px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This prompt is included in every AI request. Update it to change the AI's behavior. Supports markdown.
                </p>
              </div>

              <div className="space-y-4 border-t pt-4">
                <div>
                  <Label className="text-base font-semibold mb-3 block">Action Capabilities</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Control which capabilities the AI can execute via conversation.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="font-medium">Goal Management</Label>
                      <p className="text-xs text-muted-foreground">Update goals, weight, height</p>
                    </div>
                    <Switch
                      checked={capabilities.goals}
                      onCheckedChange={(checked) => setCapabilities({ ...capabilities, goals: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="font-medium">Nutrition Adjustments</Label>
                      <p className="text-xs text-muted-foreground">Calories, macros, diet</p>
                    </div>
                    <Switch
                      checked={capabilities.nutrition}
                      onCheckedChange={(checked) => setCapabilities({ ...capabilities, nutrition: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="font-medium">Workout Preferences</Label>
                      <p className="text-xs text-muted-foreground">Timing, intensity, focus</p>
                    </div>
                    <Switch
                      checked={capabilities.workouts}
                      onCheckedChange={(checked) => setCapabilities({ ...capabilities, workouts: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="font-medium">Tracking Preferences</Label>
                      <p className="text-xs text-muted-foreground">Water, steps, sleep goals</p>
                    </div>
                    <Switch
                      checked={capabilities.tracking}
                      onCheckedChange={(checked) => setCapabilities({ ...capabilities, tracking: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="font-medium">Coaching Style</Label>
                      <p className="text-xs text-muted-foreground">Tone, frequency, privacy</p>
                    </div>
                    <Switch
                      checked={capabilities.coaching}
                      onCheckedChange={(checked) => setCapabilities({ ...capabilities, coaching: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="font-medium">Room Actions</Label>
                      <p className="text-xs text-muted-foreground">Join, create, leave rooms</p>
                    </div>
                    <Switch
                      checked={capabilities.rooms}
                      onCheckedChange={(checked) => setCapabilities({ ...capabilities, rooms: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save System Prompt"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
