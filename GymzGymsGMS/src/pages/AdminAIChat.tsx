import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Send,
  MessageSquare,
  Plus,
  Users,
  Filter,
  Bot,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getOrCreateThreadId,
  getOrCreateChatId,
  sendToMakeAI,
  storeMessage,
  fetchConversations,
  generateChatId,
} from "@/services/aiChat";
import { format } from "date-fns";

const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

interface Message {
  id: string;
  sender: "user" | "admin" | "ai";
  message: string;
  timestamp: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  thread_id: string | null;
}

export default function AdminAIChat() {
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [adminChatId, setAdminChatId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"current" | "all">("current");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all users and AI settings
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Limit to 500 users for performance (most gyms won't have more)
        // If needed, we can add pagination later
        const { data, error } = await db
          .from("users")
          .select("id, name, email, thread_id")
          .order("name", { ascending: true })
          .limit(500);

        if (error) {
          throw new Error(`Failed to fetch users: ${error.message}`);
        }

        setUsers(data || []);
      } catch (error: any) {
        console.error("Error fetching users:", error);
        toast.error("Failed to load users");
      }
    };

    const fetchAISettings = async () => {
      try {
        const { data, error } = await db
          .from("ai_settings")
          .select("auto_reply_enabled")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setAutoReplyEnabled(data.auto_reply_enabled || false);
        }
      } catch (error: any) {
        console.error("Error fetching AI settings:", error);
      }
    };

    fetchUsers();
    fetchAISettings();
  }, []);

  // Initialize when user is selected
  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null);
      setThreadId(null);
      setChatId(null);
      setAdminChatId(null);
      setMessages([]);
      return;
    }

    const initialize = async () => {
      try {
        setLoading(true);
        const user = users.find((u) => u.id === selectedUserId);
        if (!user) return;

        setSelectedUser(user);

        // Get or create thread_id for selected user
        const userThreadId = await getOrCreateThreadId(user.id);
        setThreadId(userThreadId);

        // Generate new admin chat_id (separate from user chat_id)
        const newAdminChatId = await generateChatId();
        setAdminChatId(newAdminChatId);
        setChatId(newAdminChatId);

        // Load recent conversations for this user (via thread_id, limit to 200 for performance)
        const allMessages = await fetchConversations(
          user.id,
          userThreadId,
          undefined,
          200
        );

        setMessages(
          allMessages.map((msg: any) => ({
            id: msg.id,
            sender: msg.sender,
            message: msg.message,
            timestamp: msg.timestamp,
          }))
        );
      } catch (error: any) {
        console.error("Error initializing admin chat:", error);
        toast.error("Failed to initialize chat");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [selectedUserId, users]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleStartNewAdminChat = async () => {
    if (!selectedUserId || !threadId) return;

    try {
      const newChatId = await generateChatId();
      setAdminChatId(newChatId);
      setChatId(newChatId);
      setMessages([]);
      toast.success("New admin chat session started");
    } catch (error: any) {
      console.error("Error starting new admin chat:", error);
      toast.error("Failed to start new chat");
    }
  };

  const handleSendMessage = async () => {
    if (
      !inputMessage.trim() ||
      !selectedUserId ||
      !threadId ||
      !adminChatId ||
      sending
    ) {
      return;
    }

    const adminMessage = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    // Add admin message to UI immediately
    const tempAdminMessage: Message = {
      id: `temp-${Date.now()}`,
      sender: "admin",
      message: adminMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempAdminMessage]);

    try {
      // Store admin message
      await storeMessage(
        selectedUserId,
        threadId,
        adminChatId,
        "admin",
        adminMessage
      );

      // Send to Make.ai and get response
      const response = await sendToMakeAI(
        "admin",
        selectedUserId,
        threadId,
        adminChatId,
        adminMessage
      );

      // Store AI response
      await storeMessage(
        selectedUserId,
        threadId,
        response.chat_id,
        "ai",
        response.reply
      );

      // Update chat_id if Make.ai returned a different one
      if (response.chat_id !== adminChatId) {
        setAdminChatId(response.chat_id);
        setChatId(response.chat_id);
      }

      // Replace temp message with real one and add AI response
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== tempAdminMessage.id);
        return [
          ...filtered,
          {
            id: `admin-${Date.now()}`,
            sender: "admin",
            message: adminMessage,
            timestamp: new Date().toISOString(),
          },
          {
            id: `ai-${Date.now()}`,
            sender: "ai",
            message: response.reply,
            timestamp: new Date().toISOString(),
          },
        ];
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message. Please try again.");

      // Remove temp message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempAdminMessage.id));
    } finally {
      setSending(false);
    }
  };

  const handleViewModeChange = async (mode: "current" | "all") => {
    if (!selectedUserId || !threadId) return;

    setViewMode(mode);
    setLoading(true);

    try {
      let fetchedMessages;

      if (mode === "current" && adminChatId) {
        // View only current admin chat (limit to 100 messages)
        fetchedMessages = await fetchConversations(
          selectedUserId,
          threadId,
          adminChatId,
          100
        );
      } else {
        // View all conversations via thread_id (limit to 200 messages)
        fetchedMessages = await fetchConversations(selectedUserId, threadId, undefined, 200);
      }

      setMessages(
        fetchedMessages.map((msg: any) => ({
          id: msg.id,
          sender: msg.sender,
          message: msg.message,
          timestamp: msg.timestamp,
        }))
      );
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleToggleAutoReply = async (enabled: boolean) => {
    try {
      // Update the active AI settings
      const { error } = await db
        .from("ai_settings")
        .update({ auto_reply_enabled: enabled })
        .eq("is_active", true);

      if (error) {
        throw new Error(`Failed to update auto-reply setting: ${error.message}`);
      }

      setAutoReplyEnabled(enabled);
      toast.success(enabled ? "AI auto-reply enabled" : "AI auto-reply disabled");
    } catch (error: any) {
      console.error("Error updating auto-reply setting:", error);
      toast.error(error.message || "Failed to update auto-reply setting");
    }
  };

  const getSenderLabel = (sender: string) => {
    if (sender === "admin") return "Admin";
    if (sender === "ai") return "AI Assistant";
    return selectedUser?.name || "User";
  };

  const getSenderColor = (sender: string) => {
    if (sender === "admin") return "bg-primary text-white";
    if (sender === "ai") return "bg-muted";
    return "bg-primary text-primary-foreground";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-6xl mx-auto gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Admin AI Chat
              </CardTitle>
              <CardDescription>
                View and interact with user AI conversations
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="auto-reply-toggle" className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI Auto-Reply
                </Label>
                <Switch
                  id="auto-reply-toggle"
                  checked={autoReplyEnabled}
                  onCheckedChange={handleToggleAutoReply}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Select User
              </label>
              <Select
                value={selectedUserId || ""}
                onValueChange={setSelectedUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedUserId && (
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartNewAdminChat}
                  disabled={sending || loading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Admin Chat
                </Button>
              </div>
            )}
          </div>
          {selectedUserId && (
            <div className="flex gap-2">
              <Button
                variant={viewMode === "current" ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewModeChange("current")}
              >
                Current Chat
              </Button>
              <Button
                variant={viewMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewModeChange("all")}
              >
                All History
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUserId && selectedUser ? (
        <Card className="flex-1 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>{selectedUser.name}</CardTitle>
              <CardDescription>{selectedUser.email}</CardDescription>
            </div>
            <Badge variant="outline">Thread: {threadId?.slice(0, 8)}...</Badge>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 px-4">
              {loading ? (
                <div className="flex items-center justify-center h-full py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-lg">
                    No messages in this conversation
                  </p>
                  <p className="text-muted-foreground text-sm mt-2">
                    Start a new admin chat or view all history
                  </p>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.sender === "admin"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {msg.sender !== "admin" && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            className={
                              msg.sender === "ai"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary"
                            }
                          >
                            {msg.sender === "ai"
                              ? "AI"
                              : selectedUser.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`flex flex-col max-w-[80%] ${
                          msg.sender === "admin"
                            ? "items-end"
                            : "items-start"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {getSenderLabel(msg.sender)}
                          </span>
                        </div>
                        <div
                          className={`rounded-lg px-4 py-2 ${getSenderColor(
                            msg.sender
                          )}`}
                        >
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.message}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {format(new Date(msg.timestamp), "MMM d, HH:mm")}
                        </span>
                      </div>
                      {msg.sender === "admin" && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-white">
                            {adminUser?.name?.charAt(0).toUpperCase() || "A"}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {sending && (
                    <div className="flex gap-3 justify-start">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          AI
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message as admin..."
                  disabled={sending || loading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || sending || loading}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="flex-1 flex items-center justify-center">
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">
              Select a user to view their AI conversations
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

