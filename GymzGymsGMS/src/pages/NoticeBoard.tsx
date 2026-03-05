import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Trash2, Edit2, MessageSquare, Reply, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DataMapper } from "@/utils/dataMapper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface NoticePost {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  senderType?: "user" | "admin" | "ai" | "admin_assist";
  replyTo?: string | null;
  user?: {
    name: string;
    email: string;
    role: string;
    avatarUrl?: string | null;
  };
  replies?: NoticePost[];
}

export default function NoticeBoard() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<NoticePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; postId: string | null }>({
    open: false,
    postId: null,
  });
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const postsEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "admin";

  // Pagination state
  const [loadLimit, setLoadLimit] = useState(50);
  const [hasMore, setHasMore] = useState(false);

  // Fetch posts when component mounts or limit changes
  useEffect(() => {
    if (user?.gymId) {
      fetchPosts();
    }
  }, [loadLimit, user?.gymId]);

  // AI conversation processor disabled - only using immediate message sending

  // Scroll to bottom when posts change or on initial load
  useEffect(() => {
    if (postsEndRef.current && !loading) {
      // Use a small timeout to ensure DOM has updated
      setTimeout(() => {
        postsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [posts, loading]);

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("notice-board-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notice_board",
        },
        (payload) => {
          console.log("📨 Real-time update received:", {
            event: payload.eventType,
            id: payload.new?.id || payload.old?.id,
            sender_type: payload.new?.sender_type,
            reply_to: payload.new?.reply_to,
            content_preview: payload.new?.content?.substring(0, 50)
          });

          if (payload.eventType === "INSERT") {
            // If it's a reply, add it to the parent post's replies
            if (payload.new.reply_to) {
              console.log("📨 Real-time: Adding reply to parent message", {
                reply_id: payload.new.id,
                parent_id: payload.new.reply_to,
                sender_type: payload.new.sender_type
              });

              if (payload.new.sender_type === "ai" || payload.new.sender_type === "admin_assist") {
                console.log("🤖 AI reply detected, adding to parent message:", {
                  reply_id: payload.new.id,
                  parent_id: payload.new.reply_to,
                  content_preview: payload.new.content?.substring(0, 50)
                });

                setPosts((prev) => {
                  const parentExists = prev.find((post) => post.id === payload.new.reply_to);
                  if (!parentExists) {
                    console.warn("⚠️ Parent message not found for AI reply:", payload.new.reply_to);
                    console.log("Current posts:", prev.map(p => ({ id: p.id, content: p.content.substring(0, 30) })));
                    // If parent doesn't exist, fetch all posts to ensure we have it
                    // This can happen if the AI response arrives before the parent is loaded
                    fetchPosts();
                    return prev;
                  }

                  // Check if reply already exists (avoid duplicates)
                  const hasReply = parentExists.replies?.some((r) => r.id === payload.new.id);
                  if (hasReply) {
                    console.log("AI reply already exists, skipping duplicate");
                    return prev;
                  }

                  console.log("✅ Adding AI reply to parent message in UI");
                  const updated = prev.map((post) =>
                    post.id === payload.new.reply_to
                      ? {
                        ...post,
                        replies: [
                          ...(post.replies || []),
                          {
                            ...payload.new,
                            user: null,
                          } as NoticePost,
                        ],
                      }
                      : post
                  );

                  console.log("Updated posts with AI reply:", {
                    parent_id: payload.new.reply_to,
                    replies_count: updated.find(p => p.id === payload.new.reply_to)?.replies?.length
                  });

                  return updated;
                });
              } else {
                fetchUserDetails(payload.new.user_id).then((userDetails) => {
                  setPosts((prev) =>
                    prev.map((post) =>
                      post.id === payload.new.reply_to
                        ? {
                          ...post,
                          replies: [
                            ...(post.replies || []),
                            {
                              ...payload.new,
                              user: userDetails,
                            } as NoticePost,
                          ],
                        }
                        : post
                    )
                  );
                });
              }
            } else {
              // It's a new parent message
              setPosts((prev) => {
                // Check if this message is already in our state (optimistic or otherwise)
                // We check by ID AND by content/user pair for optimistic matches
                const existingIndex = prev.findIndex((post) =>
                  post.id === payload.new.id ||
                  (post.id.startsWith("temp-") &&
                    post.content === payload.new.content &&
                    post.userId === payload.new.user_id)
                );

                if (existingIndex !== -1) {
                  console.log("📍 Real-time: Matching existing/optimistic message, updating ID", {
                    old_id: prev[existingIndex].id,
                    new_id: payload.new.id
                  });
                  const updated = [...prev];
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    ...payload.new,
                    // Preserve existing replies if any
                    replies: updated[existingIndex].replies || []
                  };
                  return updated;
                }

                // New message - add it
                console.log("🆕 Real-time: Adding truly new message");
                if (payload.new.sender_type === "ai" || payload.new.sender_type === "admin_assist") {
                  return [
                    ...prev,
                    {
                      ...payload.new,
                      user: null,
                      replies: [],
                    } as NoticePost,
                  ];
                } else {
                  // Fetch user details for the new message
                  fetchUserDetails(payload.new.user_id).then((userDetails) => {
                    setPosts((prevPosts) => {
                      // Check again inside the async callback
                      if (prevPosts.some(p => p.id === payload.new.id)) return prevPosts;
                      return [
                        ...prevPosts,
                        {
                          ...payload.new,
                          user: userDetails,
                          replies: [],
                        } as NoticePost,
                      ];
                    });
                  });
                  return prev;
                }
              });
            }
          } else if (payload.eventType === "UPDATE") {
            setPosts((prev) =>
              prev.map((post) =>
                post.id === payload.new.id
                  ? { ...post, ...payload.new }
                  : post
              )
            );
          } else if (payload.eventType === "DELETE") {
            // Check if it's a reply or a parent message
            if (payload.old.reply_to) {
              // Remove reply from parent's replies
              setPosts((prev) =>
                prev.map((post) =>
                  post.id === payload.old.reply_to
                    ? {
                      ...post,
                      replies: (post.replies || []).filter(
                        (reply) => reply.id !== payload.old.id
                      ),
                    }
                    : post
                )
              );
            } else {
              // Remove parent message
              setPosts((prev) => prev.filter((post) => post.id !== payload.old.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchUserDetails(userId: string) {
    const { data } = await supabase
      .from("users")
      .select("name, email, role, avatar_url")
      .eq("id", userId)
      .single();
    return DataMapper.fromDb(data) || null;
  }

  async function fetchPosts() {
    if (!user?.gymId) return;
    try {
      setLoading(true);

      // 1. Fetch latest parent posts (threads)
      const { data: parents, error: parentError } = await supabase
        .from("notice_board")
        .select("*")
        .eq("gym_id", user.gymId)
        .is("reply_to", null)
        .order("created_at", { ascending: false })
        .limit(loadLimit);

      if (parentError) throw parentError;

      setHasMore(parents.length === loadLimit);

      // 2. Extract IDs for fetching replies
      const parentIds = parents.map(p => p.id);

      // 3. Fetch all replies belonging to THESE parents
      let allReplies: any[] = [];
      if (parentIds.length > 0) {
        const { data: replies, error: replyError } = await supabase
          .from("notice_board")
          .select("*")
          .eq("gym_id", user.gymId)
          .in("reply_to", parentIds)
          .order("created_at", { ascending: true });

        if (replyError) throw replyError;
        allReplies = replies || [];
      }

      // Combine parents and replies
      const allFetched = [...parents, ...allReplies];

      // Fetch user details for each post (skip for AI)
      const postsWithUsers = await Promise.all(
        allFetched.map(async (post) => {
          if (post.sender_type === "ai" || post.sender_type === "admin_assist") {
            return { ...post, user: null, replies: [] };
          }
          const userDetails = await fetchUserDetails(post.user_id);
          return { ...post, user: userDetails, replies: [] };
        })
      );

      // Organize into threads
      const parentPosts = DataMapper.fromDb(postsWithUsers)
        .filter((post: any) => !post.replyTo)
        // Sort parents by created_at ASCending so newest is at the bottom
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const replyPosts = DataMapper.fromDb(postsWithUsers).filter((post: any) => post.replyTo);

      const organizedPosts = parentPosts.map((parent: any) => {
        const replies = replyPosts
          .filter((reply: any) => reply.replyTo === parent.id)
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return { ...parent, replies };
      });

      setPosts(organizedPosts);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newPost.trim() || !user?.id) return;

    try {
      setSending(true);
      const senderType = user.role === "admin" ? "admin" : "user";
      const messageContent = newPost.trim();

      // Optimistic update - add message immediately to UI before database confirms
      const tempId = `temp-${Date.now()}`;
      const optimisticPost: NoticePost = {
        id: tempId,
        userId: user.id,
        content: messageContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        senderType: senderType,
        replyTo: null,
        user: {
          name: user.name || "You",
          email: user.email || "",
          role: user.role || "user",
          avatarUrl: null,
        },
        replies: [],
      };

      // Add message immediately to UI
      setPosts((prev) => [...prev, optimisticPost]);
      setNewPost("");
      toast.success("Message sent!");

      // Now insert to database
      const { data: insertedData, error } = await supabase
        .from("notice_board")
        .insert({
          user_id: user.id,
          gym_id: user.gymId,
          content: messageContent,
          sender_type: senderType,
        })
        .select("id, created_at")
        .single();

      if (error) {
        // Remove optimistic update on error
        setPosts((prev) => prev.filter((post) => post.id !== tempId));
        throw error;
      }

      // Replace temporary post with real one from database
      if (insertedData) {
        setPosts((prev) =>
          prev.map((post) =>
            post.id === tempId
              ? {
                ...post,
                id: insertedData.id,
                created_at: insertedData.created_at,
              }
              : post
          )
        );
      }

      // ALWAYS send message to webhook (AI) immediately - bypass auto-reply setting
      // THE WEBHOOK IS THE AI - messages are always sent to webhook for AI processing
      // Only for non-admin users
      if (insertedData) {
        // Process immediately without any delay - CRITICAL: AI needs the message immediately
        (async () => {
          try {
            const {
              sendMessageToWebhookImmediately
            } = await import("@/services/aiChat");

            console.log("🚀 Sending message to webhook (AI) immediately (bypassing auto-reply setting)...");

            // ALWAYS send message directly to webhook immediately
            // THIS IS THE AI - the webhook processes the message and returns the AI response
            // Auto-reply setting is bypassed - AI will always respond
            await sendMessageToWebhookImmediately(
              insertedData.id,
              user.id,
              messageContent,
              senderType,
              insertedData.created_at
            );
          } catch (err: any) {
            console.error("❌ Error sending message to webhook (AI):", err);
            const errorMessage = err?.message || err?.toString() || "Unknown error";
            console.error("Full error details:", {
              error: err,
              message: errorMessage,
              stack: err?.stack
            });

            // Show more specific error message to user
            if (errorMessage.includes("Webhook URL not configured")) {
              toast.error("AI webhook not configured. Please configure it in AI Settings.");
            } else if (errorMessage.includes("Webhook request failed")) {
              toast.error(`AI webhook error: ${errorMessage}`);
            } else {
              toast.error(`Failed to send message to AI: ${errorMessage}`);
            }
          }
        })(); // Execute immediately - no delay
      }
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleReply(postId: string) {
    if (!replyContent.trim() || !user?.id) return;

    try {
      setSendingReply(postId);
      const senderType = user.role === "admin" ? "admin" : "user";
      const contentToSend = replyContent.trim();

      // Optimistic update - add reply immediately to UI
      const tempId = `temp-reply-${Date.now()}`;
      const optimisticReply: NoticePost = {
        id: tempId,
        userId: user.id,
        content: contentToSend,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        senderType: senderType,
        replyTo: postId,
        user: {
          name: user.name || "You",
          email: user.email || "",
          role: user.role || "user",
          avatarUrl: null,
        },
      };

      // Add reply immediately to UI
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
              ...post,
              replies: [...(post.replies || []), optimisticReply],
            }
            : post
        )
      );

      // Clear the reply content immediately for better UX
      setReplyContent("");
      setReplyingTo(null);
      toast.success("Reply sent!");

      // Now insert to database
      const { data: insertedData, error } = await supabase
        .from("notice_board")
        .insert({
          user_id: user.id,
          gym_id: user.gymId,
          content: contentToSend,
          sender_type: senderType,
          reply_to: postId,
        })
        .select("id, created_at")
        .single();

      if (error) {
        // Remove optimistic update on error
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? {
                ...post,
                replies: (post.replies || []).filter(
                  (reply) => reply.id !== tempId
                ),
              }
              : post
          )
        );
        throw error;
      }

      // Replace temporary reply with real one from database
      if (insertedData) {
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? {
                ...post,
                replies: (post.replies || []).map((reply) =>
                  reply.id === tempId
                    ? {
                      ...reply,
                      id: insertedData.id,
                      created_at: insertedData.created_at,
                    }
                    : reply
                ),
              }
              : post
          )
        );
      }
    } catch (error: any) {
      console.error("Error creating reply:", error);
      toast.error(error.message || "Failed to send reply");
      // Restore content on error
      setReplyContent(replyContent);
    } finally {
      setSendingReply(null);
    }
  }

  async function handleEdit() {
    if (!editingPost || !editContent.trim()) return;

    try {
      const { error } = await supabase
        .from("notice_board")
        .update({ content: editContent.trim() })
        .eq("id", editingPost);

      if (error) throw error;

      setEditingPost(null);
      setEditContent("");
      toast.success("Message updated!");
    } catch (error: any) {
      console.error("Error updating post:", error);
      toast.error(error.message || "Failed to update message");
    }
  }

  async function handleDelete() {
    if (!deleteDialog.postId) return;

    try {
      const { error } = await supabase
        .from("notice_board")
        .delete()
        .eq("id", deleteDialog.postId);

      if (error) throw error;

      setDeleteDialog({ open: false, postId: null });
      toast.success("Message deleted!");
    } catch (error: any) {
      console.error("Error deleting post:", error);
      toast.error(error.message || "Failed to delete message");
    }
  }

  function startEdit(post: NoticePost) {
    setEditingPost(post.id);
    setEditContent(post.content);
  }

  function cancelEdit() {
    setEditingPost(null);
    setEditContent("");
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  const canEditOrDelete = (post: NoticePost) => {
    // AI and admin_assist messages can only be deleted by admins, not edited
    if (post.senderType === "ai" || post.senderType === "admin_assist") {
      return isAdmin;
    }
    // Regular messages: users can edit/delete their own, admins can delete any
    return post.userId === user?.id || isAdmin;
  };

  function getSenderName(post: NoticePost) {
    // Check if it's an AI or admin_assist message first
    if (post.senderType === "ai" || post.senderType === "admin_assist") {
      return "Admin Assistant";
    }
    // Then check if it's an admin
    if (post.user?.role === "admin" || post.senderType === "admin") {
      return "Admin";
    }
    // Otherwise it's a member
    return post.user?.name || "Unknown";
  }

  const isMyMessage = (post: NoticePost) => {
    return post.userId === user?.id;
  };

  const isAIMessage = (post: NoticePost) => {
    return post.senderType === "ai" || post.senderType === "admin_assist";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b">
        <MessageSquare className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Community Chat Room</h1>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Loading messages...
          </div>
        ) : posts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg">No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
            <div className="space-y-6 pb-4 pt-4">
              {hasMore && (
                <div className="flex justify-center pb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setLoadLimit(prev => prev + 50)}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <MessageSquare className="h-3 w-3 mr-1" />
                    )}
                    Load older messages
                  </Button>
                </div>
              )}
              {posts.map((post) => {
                const isMine = isMyMessage(post);
                const senderName = getSenderName(post);

                return (
                  <div
                    key={post.id}
                    className={`group flex gap-3 ${isMine ? "flex-row-reverse" : ""}`}
                  >
                    {editingPost === post.id ? (
                      <div className={`flex-1 ${isMine ? "flex justify-end" : ""}`}>
                        <div className="max-w-[80%] space-y-2">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={3}
                            className="resize-none"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleEdit}>
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          {isAIMessage(post) ? (
                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                              AA
                            </AvatarFallback>
                          ) : post.user?.avatarUrl ? (
                            <AvatarImage
                              src={post.user.avatarUrl}
                              alt={senderName}
                            />
                          ) : (
                            <AvatarFallback className="text-xs">
                              {post.user?.name
                                ? getInitials(post.user.name)
                                : "U"}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className={`flex-1 ${isMine ? "flex flex-col items-end" : ""}`}>
                          <div className={`flex items-center gap-2 mb-1 ${isMine ? "flex-row-reverse" : ""}`}>
                            <span className="text-xs font-semibold text-foreground">
                              {senderName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(post.createdAt)}
                            </span>
                            {post.updatedAt !== post.createdAt && (
                              <span className="text-xs text-muted-foreground italic">
                                (edited)
                              </span>
                            )}
                          </div>
                          <div
                            className={`inline-block rounded-lg px-4 py-2 max-w-[80%] ${isAIMessage(post)
                              ? "bg-primary/10 border border-primary/20"
                              : isMine
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                              }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {post.content}
                            </p>
                          </div>
                          <div className={`flex gap-1 mt-1 items-center ${isMine ? "flex-row-reverse" : ""}`}>
                            {/* Reply button - everyone can reply */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (replyingTo === post.id) {
                                  setReplyingTo(null);
                                  setReplyContent("");
                                } else {
                                  setReplyingTo(post.id);
                                  setReplyContent("");
                                }
                              }}
                              className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Reply className="h-3 w-3 mr-1" />
                              Reply
                            </Button>
                            {canEditOrDelete(post) && (
                              <>
                                {/* Only show edit button for user's own messages (not AI messages) */}
                                {post.userId === user?.id && post.senderType !== "ai" && post.senderType !== "admin_assist" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEdit(post)}
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setDeleteDialog({ open: true, postId: post.id })
                                  }
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                          {/* Reply form */}
                          {replyingTo === post.id && (
                            <div className="mt-2 ml-11 space-y-2">
                              <Textarea
                                key={`reply-textarea-${post.id}-${replyingTo === post.id ? 'open' : 'closed'}`}
                                placeholder={`Reply to ${senderName}...`}
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                rows={2}
                                className="resize-none text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey && replyContent.trim() && sendingReply !== post.id) {
                                    e.preventDefault();
                                    handleReply(post.id);
                                  }
                                }}
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyContent("");
                                  }}
                                  disabled={sendingReply === post.id}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleReply(post.id)}
                                  disabled={!replyContent || replyContent.trim().length === 0 || sendingReply === post.id}
                                >
                                  {sendingReply === post.id ? "Sending..." : "Send Reply"}
                                </Button>
                              </div>
                            </div>
                          )}
                          {/* Display replies */}
                          {post.replies && post.replies.length > 0 && (
                            <div className="mt-2 ml-11 space-y-2 border-l-2 border-muted pl-3">
                              {post.replies.map((reply: any) => {
                                const replyIsMine = reply.userId === user?.id;
                                const replySenderName = getSenderName(reply);
                                const replyIsAI = isAIMessage(reply);

                                return (
                                  <div key={reply.id} className="flex gap-2 group">
                                    <Avatar className="h-6 w-6 flex-shrink-0">
                                      {replyIsAI ? (
                                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                          AA
                                        </AvatarFallback>
                                      ) : reply.user?.avatarUrl ? (
                                        <AvatarImage
                                          src={reply.user.avatarUrl}
                                          alt={replySenderName}
                                        />
                                      ) : (
                                        <AvatarFallback className="text-xs">
                                          {reply.user?.name
                                            ? getInitials(reply.user.name)
                                            : "U"}
                                        </AvatarFallback>
                                      )}
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-semibold">
                                          {replySenderName}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {formatDate(reply.createdAt)}
                                        </span>
                                      </div>
                                      <div className="bg-muted/50 rounded-lg px-3 py-1.5 text-sm">
                                        <p className="whitespace-pre-wrap break-words">
                                          {reply.content}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              <div ref={postsEndRef} />
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Message Input */}
      <div className="mt-4 pt-4 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            placeholder="Type your message..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            rows={2}
            className="resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (newPost.trim() && !sending) {
                  const form = e.currentTarget.closest("form");
                  if (form) {
                    form.requestSubmit();
                  }
                }
              }
            }}
          />
          <Button type="submit" disabled={!newPost.trim() || sending} size="lg">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, postId: open ? deleteDialog.postId : null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

