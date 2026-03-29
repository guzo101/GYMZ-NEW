import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Send, MessageSquare, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  getOrCreateThreadId,
  getOrCreateChatId,
  sendMessageToAI,
  storeMessage,
  fetchConversations,
  checkChatInactivity,
  generateChatId,
} from "@/services/aiChat";
import { format } from "date-fns";

interface Message {
  id: string;
  sender: "user" | "admin" | "ai";
  message: string;
  timestamp: string;
}

export default function MemberAIChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize thread_id and chat_id
  useEffect(() => {
    if (!user?.id) return;

    const initialize = async () => {
      try {
        setInitializing(true);

        // Get or create thread_id
        const userThreadId = await getOrCreateThreadId(user.id);
        setThreadId(userThreadId);

        // Check for active chat or create new one
        const activeChatId = await getOrCreateChatId(user.id, userThreadId);
        setChatId(activeChatId);

        // Check if current chat is inactive
        const isInactive = await checkChatInactivity(activeChatId);
        if (isInactive) {
          // Generate new chat_id for inactive chat
          const newChatId = await generateChatId();
          setChatId(newChatId);
        } else {
          // Load existing messages (limit to last 100 messages for performance)
          const existingMessages = await fetchConversations(
            user.id,
            userThreadId,
            activeChatId,
            100
          );
          setMessages(
            existingMessages.map((msg: any) => ({
              id: msg.id,
              sender: msg.sender,
              message: msg.message,
              timestamp: msg.timestamp,
            }))
          );
        }
      } catch (error: any) {
        console.error("Error initializing chat:", error);
        toast.error("Failed to initialize chat. Please refresh the page.");
      } finally {
        setInitializing(false);
      }
    };

    initialize();
  }, [user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !user?.id || !threadId || !chatId || sending) {
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      sender: "user",
      message: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      // Store user message
      await storeMessage(user.id, threadId, chatId, "user", userMessage);

      // Send to AI (Make or OpenAI per settings); token limits and logging applied
      const response = await sendMessageToAI(
        "user",
        user.id,
        threadId,
        chatId,
        userMessage,
        { gymId: user.gym_id ?? undefined, featureType: "AI_CHAT" }
      );

      // Store AI response
      await storeMessage(
        user.id,
        threadId,
        response.chat_id,
        "ai",
        response.reply
      );

      // Update chat_id if Make.ai returned a different one
      if (response.chat_id !== chatId) {
        setChatId(response.chat_id);
      }

      // Replace temp message with real one and add AI response
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== tempUserMessage.id);
        return [
          ...filtered,
          {
            id: `user-${Date.now()}`,
            sender: "user",
            message: userMessage,
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
      setMessages((prev) => prev.filter((msg) => msg.id !== tempUserMessage.id));
    } finally {
      setSending(false);
    }
  };

  const handleNewChat = async () => {
    if (!user?.id || !threadId) return;

    try {
      const newChatId = await generateChatId();
      setChatId(newChatId);
      setMessages([]);
      toast.success("New chat started");
    } catch (error: any) {
      console.error("Error starting new chat:", error);
      toast.error("Failed to start new chat");
    }
  };

  const handleClearChat = async () => {
    if (!user?.id || !threadId) return;

    try {
      const newChatId = await generateChatId();
      setChatId(newChatId);
      setMessages([]);
      toast.success("Chat cleared");
    } catch (error: any) {
      console.error("Error clearing chat:", error);
      toast.error("Failed to clear chat");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (initializing) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Initializing chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            AI Assistant
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              disabled={sending}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              disabled={sending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
            <div className="space-y-4 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-lg">
                    Start a conversation with your AI assistant
                  </p>
                  <p className="text-muted-foreground text-sm mt-2">
                    Ask about workouts, nutrition, or your fitness goals
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.sender !== "user" && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          AI
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`flex flex-col max-w-[80%] ${
                        msg.sender === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          msg.sender === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        {format(new Date(msg.timestamp), "HH:mm")}
                      </span>
                    </div>
                    {msg.sender === "user" && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-secondary">
                          {user?.name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))
              )}
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
          </ScrollArea>
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
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
    </div>
  );
}

