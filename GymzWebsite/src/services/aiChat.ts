import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";

const db = {
  from: (...args: any[]) => (supabase as any).from(...args),
};

/**
 * Generate a unique thread_id for a user
 * Thread_id is permanent and never changes
 */
export async function generateThreadId(): Promise<string> {
  // Use UUID v4 for thread_id
  return crypto.randomUUID();
}

/**
 * Generate a unique chat_id for a conversation session
 * Chat_id changes for new sessions
 */
export async function generateChatId(): Promise<string> {
  // Use UUID v4 for chat_id
  return crypto.randomUUID();
}

/**
 * Get or create thread_id for a user
 * Ensures every user has a permanent thread_id
 * Optimized to check users table first (faster than scanning conversations)
 */
export async function getOrCreateThreadId(userId: string): Promise<string> {
  try {
    // First check if user has thread_id in users table (faster lookup)
    const { data: rawUserData, error: userError } = await db
      .from("users")
      .select("thread_id")
      .eq("id", userId)
      .maybeSingle();

    const userData: any = DataMapper.fromDb(rawUserData);

    if (!userError && userData?.threadId) {
      return userData.threadId;
    }

    // If not in users table, check conversations table (fallback)
    const { data: rawLastConversation, error: fetchError } = await db
      .from("conversations")
      .select("thread_id")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastConversation: any = DataMapper.fromDb(rawLastConversation);

    if (fetchError && fetchError.code !== "PGRST116") {
      console.warn("Error fetching thread_id from conversations:", fetchError);
    }

    // If user has a thread_id from previous conversations, return it
    if (lastConversation?.threadId) {
      // Optionally update users table for faster future lookups (non-blocking)
      db.from("users")
        .update(DataMapper.toDb({ threadId: lastConversation.threadId }))
        .eq("id", userId)
        .catch(err => console.warn("Failed to update users.thread_id:", err));

      return lastConversation.threadId;
    }

    // Generate new thread_id
    const newThreadId = await generateThreadId();

    // Optionally store in users table for faster future lookups (non-blocking)
    db.from("users")
      .update(DataMapper.toDb({ threadId: newThreadId }))
      .eq("id", userId)
      .catch(err => console.warn("Failed to store thread_id in users table:", err));

    return newThreadId;
  } catch (error) {
    console.error("Error in getOrCreateThreadId:", error);
    // Return a generated thread_id even on error to prevent blocking
    return await generateThreadId();
  }
}

/**
 * Get the most recent active chat_id for a user
 * Returns null if no active chat exists
 */
export async function getActiveChatId(
  userId: string,
  threadId: string
): Promise<string | null> {
  try {
    // Get the most recent message for this user/thread
    const { data: rawLastMessage, error } = await db
      .from("conversations")
      .select("chat_id, timestamp")
      .eq("user_id", userId)
      .eq("thread_id", threadId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch last message: ${error.message}`);
    }

    const lastMessage: any = DataMapper.fromDb(rawLastMessage);

    if (!lastMessage) {
      return null;
    }

    // Check if last message is within 24 hours
    const lastMessageTime = new Date(lastMessage.timestamp);
    const now = new Date();
    const hoursSinceLastMessage =
      (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastMessage < 24) {
      return lastMessage.chatId;
    }

    // Chat is inactive (older than 24 hours)
    return null;
  } catch (error) {
    console.error("Error in getActiveChatId:", error);
    return null;
  }
}

/**
 * Get or create a chat_id for the current session
 * Creates new chat_id if none exists or if last chat is > 24h old
 */
export async function getOrCreateChatId(
  userId: string,
  threadId: string
): Promise<string> {
  const activeChatId = await getActiveChatId(userId, threadId);
  if (activeChatId) {
    return activeChatId;
  }
  // Generate new chat_id if no active chat
  return await generateChatId();
}

/**
 * Fetch the active webhook URL from ai_settings
 */
export async function fetchWebhookUrl(): Promise<string | null> {
  try {
    const { data, error } = await db
      .from("ai_settings")
      .select("webhook_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch webhook URL: ${error.message}`);
    }

    return (DataMapper.fromDb(data) as any)?.webhookUrl || null;
  } catch (error) {
    console.error("Error fetching webhook URL:", error);
    return null;
  }
}

/**
 * Check if AI auto-reply is enabled
 */
export async function isAutoReplyEnabled(): Promise<boolean> {
  try {
    const { data, error } = await db
      .from("ai_settings")
      .select("auto_reply_enabled")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching auto-reply setting:", error);
      return false; // Default to false if error
    }

    return (DataMapper.fromDb(data) as any)?.autoReplyEnabled || false;
  } catch (error) {
    console.error("Error checking auto-reply setting:", error);
    return false; // Default to false on error
  }
}

/**
 * Fetch user data for AI context metadata
 */
export async function fetchUserData(userId: string): Promise<any> {
  try {
    const { data, error } = await db
      .from("users")
      .select(
        "id, name, email, membership_status, membership_due_date, goal, nutrition_preferences, class_schedule, workout_history, payment_status, payment_history"
      )
      .eq("id", userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch user data: ${error.message}`);
    }

    return DataMapper.fromDb(data);
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
}

/**
 * Build metadata object for Make.ai webhook payload
 */
function buildMetadata(userData: any): any {
  return DataMapper.toDb({
    membershipStatus: userData?.membershipStatus || null,
    membershipDueDate: userData?.membershipDueDate || null,
    goal: userData?.goal || null,
    paymentStatus: userData?.paymentStatus || null,
    nutritionPreferences: userData?.nutritionPreferences || null,
    classSchedule: userData?.classSchedule || null,
    workoutHistory: userData?.workoutHistory || null,
  });
}

/**
 * Ultra-robust helper to clean AI responses from any JSON wrappers or artifacts.
 * Handles: full JSON, truncated JSON, stringified JSON, and escaped quotes.
 */
function cleanAIResponse(text: string): string {
  if (!text) return "";

  let cleaned = text.trim();

  // 1. Handle common JSON wrapper prefixes/suffixes (even if truncated)
  const artifacts = [
    /^{"response"\s*:\s*"/i,
    /^{"reply"\s*:\s*"/i,
    /^"response"\s*:\s*"/i,
    /^"reply"\s*:\s*"/i,
    /^{"/i,
    /^"/,
    /"}$/i,
    /}$/,
    /"$/
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of artifacts) {
      const newCleaned = cleaned.replace(pattern, "");
      if (newCleaned !== cleaned) {
        cleaned = newCleaned;
        changed = true;
      }
    }
  }

  // 2. Handle escaped characters that might remain
  cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

  // 3. If it's still a full JSON string, try one last parse
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.response) return parsed.response;
      if (parsed.reply) return parsed.reply;
    } catch (e) {
      // Ignore
    }
  }

  return cleaned.trim();
}

/**
 * Send message to Make.ai webhook
 */
export async function sendToMakeAI(
  senderType: "user" | "admin",
  userId: string,
  threadId: string,
  chatId: string,
  message: string
): Promise<{ reply: string; thread_id: string; chat_id: string }> {
  const webhookUrl = await fetchWebhookUrl();

  if (!webhookUrl) {
    throw new Error(
      "Webhook URL not configured. Please configure it in AI Settings."
    );
  }

  // Build unified payload
  const payload = {
    source: "website_query",
    sender_type: senderType,
    user_id: userId,
    thread_id: `website_${userId}`, // Distinct thread for website
    chat_id: chatId,
    message: message,
    timestamp: new Date().toISOString(),
    context: {
      platform: "website"
    }
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Webhook error response:", responseText);
      throw new Error(
        `Webhook request failed: ${response.status} ${responseText}`
      );
    }

    let data;
    try {
      data = DataMapper.fromDb(JSON.parse(responseText)) as any;
    } catch (parseError) {
      console.error("Failed to parse AI JSON response, attempting dirty parse:", responseText);

      if (responseText.trim().toLowerCase() === "accepted") {
        throw new Error("Webhook accepted the request but returned no data. Check if your Make.com scenario has a 'Webhook Response' module.");
      }

      const replyMatch = responseText.match(/"reply"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*})/);
      const threadMatch = responseText.match(/"thread_id"\s*:\s*"([^"]*)"/);
      const chatMatch = responseText.match(/"chat_id"\s*:\s*"([^"]*)"/);

      if (replyMatch || threadMatch || chatMatch) {
        data = DataMapper.fromDb({
          reply: replyMatch ? replyMatch[1] : "",
          thread_id: threadMatch ? threadMatch[1] : threadId,
          chat_id: chatMatch ? chatMatch[1] : chatId
        }) as any;
      } else {
        throw new Error(`Invalid JSON response from webhook. Expected JSON, got: "${responseText.substring(0, 100)}..."`);
      }
    }

    // Use the ultra-robust cleaner for the final reply
    const finalReply = cleanAIResponse(data.reply || responseText);

    return {
      reply: finalReply,
      thread_id: data.threadId || threadId,
      chat_id: data.chatId || chatId,
    };
  } catch (error) {
    console.error("Error sending to Make.ai:", error);
    throw error;
  }
}

/**
 * Send message to Make.ai webhook with Community Chat Room data
 */
export async function sendToMakeAIWithCommunityChat(
  senderType: "user" | "admin",
  userId: string,
  threadId: string,
  chatId: string,
  contextPrompt: string,
  actualUserMessage: string,
  communityChatData: any
): Promise<{ reply: string; thread_id: string; chat_id: string }> {
  const webhookUrl = await fetchWebhookUrl();

  if (!webhookUrl) {
    throw new Error(
      "Webhook URL not configured. Please configure it in AI Settings."
    );
  }

  // Build unified payload
  const payload = {
    source: "website_community", // Assuming website might also have community
    sender_type: senderType,
    user_id: userId,
    thread_id: `community_web_${userId}`,
    chat_id: chatId,
    message: actualUserMessage,
    timestamp: new Date().toISOString(),
    context: {
      ...communityChatData,
      platform: "website"
    }
  };

  console.log("📤 Sending message to webhook (AI):", {
    webhook_url: webhookUrl.substring(0, 50) + "...",
    has_community_chat: true,
    actual_message: actualUserMessage.substring(0, 100) + "...",
    community_chat_keys: Object.keys(communityChatData),
    note: "THE WEBHOOK IS THE AI - This call triggers AI processing"
  });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Webhook error response:", responseText);
      throw new Error(
        `Webhook request failed: ${response.status} ${responseText}`
      );
    }

    let data: any;
    try {
      data = DataMapper.fromDb(JSON.parse(responseText));
    } catch (parseError) {
      console.error("Failed to parse webhook JSON:", responseText);
      if (responseText.trim().toLowerCase() === "accepted") {
        throw new Error("Webhook accepted the request but returned no data. Check if your Make.com scenario has a 'Webhook Response' module.");
      }
      throw new Error(`Invalid JSON response from webhook. Expected JSON, got: "${responseText.substring(0, 100)}..."`);
    }

    // Validate response structure
    if (!data.reply || !data.threadId || !data.chatId) {
      throw new Error("Invalid response format from Make.ai webhook");
    }

    // Use the ultra-robust cleaner for the final reply
    const finalReply = cleanAIResponse(data.reply || responseText);

    console.log("✅ Successfully received AI response from webhook:", {
      reply_preview: finalReply.substring(0, 100) + "...",
      thread_id: data.threadId,
      chat_id: data.chatId
    });
    return {
      reply: finalReply,
      thread_id: data.threadId,
      chat_id: data.chatId,
    };
  } catch (error: any) {
    console.error("❌ Error sending message to webhook (AI):", error);
    console.error("Error details:", {
      message: error?.message,
      response: error?.response,
      status: error?.status,
      statusText: error?.statusText,
      url: webhookUrl
    });

    // Provide more helpful error messages
    if (error?.message?.includes("fetch") || error?.message?.includes("NetworkError")) {
      throw new Error(`Network error: Unable to reach webhook. Check your internet connection and webhook URL.`);
    } else if (error?.message?.includes("Invalid response format")) {
      throw new Error(`Webhook returned invalid format. Expected: {reply, thread_id, chat_id}`);
    } else if (error?.message?.includes("Webhook request failed")) {
      throw new Error(`Webhook request failed: ${error.message}`);
    } else {
      throw error;
    }
  }
}

/**
 * Store a message in the conversations table
 */
export async function storeMessage(
  userId: string,
  threadId: string,
  chatId: string,
  sender: "user" | "admin" | "ai",
  message: string
): Promise<void> {
  try {
    const { error } = await db.from("conversations").insert(DataMapper.toDb({
      userId: userId,
      threadId: threadId,
      chatId: chatId,
      sender: sender,
      message: message,
      timestamp: new Date().toISOString(),
    }));

    if (error) {
      throw new Error(`Failed to store message: ${error.message}`);
    }
  } catch (error) {
    console.error("Error storing message:", error);
    throw error;
  }
}

/**
 * Fetch conversations for a user
 * Can filter by chat_id or fetch all via thread_id
 * @param limit - Maximum number of messages to fetch (default: 100, max: 500)
 */
export async function fetchConversations(
  userId: string,
  threadId?: string,
  chatId?: string,
  limit: number = 100
): Promise<any[]> {
  try {
    // Cap the limit to prevent excessive data loading
    const safeLimit = Math.min(Math.max(limit, 1), 500);

    let query = db.from("conversations").select("*").eq("user_id", userId);

    if (chatId) {
      query = query.eq("chat_id", chatId);
    } else if (threadId) {
      query = query.eq("thread_id", threadId);
    }

    // Order by timestamp descending, then limit, then reverse to get chronological order
    const { data, error } = await query
      .order("timestamp", { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    // Reverse to get chronological order (oldest first)
    return (data || []).reverse();
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
}

/**
 * Check if a chat has been inactive for 24 hours
 */
export async function checkChatInactivity(chatId: string): Promise<boolean> {
  try {
    const { data, error } = await db
      .from("conversations")
      .select("timestamp")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to check chat inactivity: ${error.message}`);
    }

    if (!data) {
      return true; // No messages, consider inactive
    }

    const lastMessageTime = new Date(data.timestamp);
    const now = new Date();
    const hoursSinceLastMessage =
      (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastMessage >= 24;
  } catch (error) {
    console.error("Error checking chat inactivity:", error);
    return false;
  }
}

/**
 * Send a message to webhook immediately when posted to community chat
 * THE WEBHOOK IS THE AI - This function sends the message directly to the webhook (AI)
 * Bypasses auto-reply setting - messages are ALWAYS sent to webhook
 * If the message is not sent to the webhook, the AI will not respond
 */
export async function sendMessageToWebhookImmediately(
  messageId: string,
  userId: string,
  messageContent: string,
  senderType: "user" | "admin",
  messageCreatedAt: string
): Promise<void> {
  try {
    const webhookUrl = await fetchWebhookUrl();
    if (!webhookUrl) {
      const error = new Error("Webhook URL not configured. Please configure it in AI Settings.");
      console.error("❌ Webhook URL not configured! AI cannot respond without webhook.");
      throw error;
    }

    // BYPASS auto-reply setting - always send to webhook
    // The webhook is the AI, so we always send messages to it
    console.log("🚀 Sending message to webhook (AI) immediately (bypassing auto-reply setting)...", {
      message_id: messageId,
      user_id: userId,
      message_preview: messageContent.substring(0, 50)
    });

    // Fetch user data for metadata
    const userData = await fetchUserData(userId);

    // Get or create thread_id
    const threadId = await getOrCreateThreadId(userId);
    const chatId = await generateChatId();

    // Fetch recent messages for context (last 10)
    const recentMessages = await getRecentNoticeBoardMessages(10);
    const currentThread = recentMessages.filter(msg =>
      !msg.reply_to || msg.reply_to === messageId
    ).slice(-10);

    // Build conversation context
    const context = buildConversationContext(currentThread);
    const topic = extractTopic(currentThread);

    // Create context prompt
    const contextPrompt = `You are an Admin Assistant for a gym community chat. You're participating in a community notice board where members share ideas and ask questions.

Conversation context:
${context}

Topic keywords: ${topic}

The user's latest message: "${messageContent}"

Please provide a helpful, friendly, and relevant response that:
- Stays on topic and continues the conversation naturally
- Is concise (2-3 sentences max)
- Adds value to the discussion
- Uses a friendly, supportive tone appropriate for a gym community

Respond as if you're part of the community conversation:`;

    // Calculate time since message
    const messageTime = new Date(messageCreatedAt).getTime();
    const now = new Date().getTime();
    const minutesSinceMessage = (now - messageTime) / (1000 * 60);

    // Build community chat metadata
    const communityChatData = {
      message_id: messageId,
      reply_to: null,
      is_reply: false,
      conversation_context: context,
      topic_keywords: topic,
      thread_messages_count: currentThread.length,
      last_user_message_id: messageId,
      message_created_at: messageCreatedAt,
      minutes_since_message: minutesSinceMessage,
      thread_participants: currentThread.map(msg => msg.sender_type),
      actual_user_message: messageContent,
    };

    // Send to webhook immediately - THE WEBHOOK IS THE AI
    // This is the critical call - without this, the AI will not process the message
    const response = await sendToMakeAIWithCommunityChat(
      senderType,
      userId,
      threadId,
      chatId,
      contextPrompt,
      messageContent,
      communityChatData
    );

    // Post AI response to notice board as a reply to the user's message
    try {
      const postedMessage = await postAIMessageToNoticeBoard(response.reply, userId, messageId);
      console.log("✅ Successfully posted AI response to notice board:", {
        message_id: postedMessage?.id,
        reply_to: messageId,
        content_preview: response.reply.substring(0, 50) + "..."
      });
    } catch (postError: any) {
      console.error("❌ Failed to post AI response to notice board:", postError);
      // Don't throw - we don't want to break the webhook flow
      // The error is logged for debugging
    }

    console.log("✅ Successfully sent message to webhook (AI) and received response");
  } catch (error: any) {
    console.error("❌ Error sending message to webhook immediately:", error);
    console.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    // Re-throw with more context
    const enhancedError = new Error(
      error?.message || "Failed to send message to webhook (AI)"
    );
    (enhancedError as any).originalError = error;
    throw enhancedError;
  }
}

/**
 * Post an AI message to the notice board as admin_assist
 * This allows the AI to participate in the community chat
 * @param content - The AI response content
 * @param userId - The user ID the AI is responding to (for reference)
 * @param replyTo - The message ID to reply to (makes AI response a reply, not a new message)
 */
export async function postAIMessageToNoticeBoard(
  content: string,
  userId?: string, // Optional: if AI is responding to a specific user's message
  replyTo?: string // Optional: if AI is replying to a specific message - THIS MAKES IT A REPLY
): Promise<any> {
  try {
    // Get the first admin user's ID to use as the user_id for AI messages
    // This ensures referential integrity while marking it as an AI message
    const { data: adminUser, error: adminError } = await db
      .from("users")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (adminError && adminError.code !== "PGRST116") {
      throw new Error(`Failed to find admin user: ${adminError.message}`);
    }

    // Use provided userId or admin user ID as fallback
    const aiUserId = userId || adminUser?.id;

    if (!aiUserId) {
      throw new Error("No admin user found to associate AI message with");
    }

    // If replyTo is provided, the AI response will be a reply to that message
    // Otherwise, it will be a new top-level message
    console.log(`📝 Posting AI response to notice board:`, {
      content_preview: content.substring(0, 50) + "...",
      reply_to: replyTo || "null (new message)",
      user_id: aiUserId,
      sender_type: "admin_assist"
    });

    const { data: insertedData, error } = await db
      .from("notice_board")
      .insert({
        user_id: aiUserId,
        content: content.trim(),
        sender_type: "admin_assist",
        reply_to: replyTo || null, // This makes it a reply if replyTo is provided
      })
      .select("id")
      .single();

    if (error) {
      console.error("❌ Error posting AI message:", error);
      console.error("Error details:", {
        error_code: error.code,
        error_message: error.message,
        error_details: error.details,
        reply_to: replyTo,
        content_length: content.length
      });
      throw new Error(`Failed to post AI message: ${error.message}`);
    }

    console.log(`✅ Posted AI response${replyTo ? ` as reply to message ${replyTo}` : ' as new message'}, ID: ${insertedData?.id}`);

    // Return the inserted data for debugging
    return insertedData;
  } catch (error: any) {
    console.error("❌ Error posting AI message to notice board:", error);
    console.error("Full error:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    throw error;
  }
}

/**
 * Get recent notice board messages for context analysis
 */
async function getRecentNoticeBoardMessages(limit: number = 50): Promise<any[]> {
  try {
    const { data, error } = await db
      .from("notice_board")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return (DataMapper.fromDb(data) || []).reverse(); // Reverse to get chronological order
  } catch (error) {
    console.error("Error fetching notice board messages:", error);
    return [];
  }
}

/**
 * Group messages into conversation threads based on time gaps and topic similarity
 */
function groupMessagesIntoThreads(messages: any[]): any[][] {
  if (messages.length === 0) return [];

  const threads: any[][] = [];
  const TIME_GAP_MINUTES = 30; // Messages within 30 minutes are considered same thread

  let currentThread: any[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prevMessage = messages[i - 1];
    const currentMessage = messages[i];

    const prevTime = new Date(prevMessage.createdAt).getTime();
    const currentTime = new Date(currentMessage.createdAt).getTime();
    const minutesDiff = (currentTime - prevTime) / (1000 * 60);

    // If gap is too large, start a new thread
    if (minutesDiff > TIME_GAP_MINUTES) {
      threads.push(currentThread);
      currentThread = [currentMessage];
    } else {
      currentThread.push(currentMessage);
    }
  }

  // Add the last thread
  if (currentThread.length > 0) {
    threads.push(currentThread);
  }

  return threads;
}

/**
 * Determine if AI should respond to a conversation thread
 * Returns true if:
 * - Last message is from a user (not admin or AI)
 * - AI hasn't responded to the last user message
 * - For immediate processing: respond immediately (when called right after message is sent)
 * - For background processing: message is older than 1 minute OR there's quick back-and-forth
 * Note: Auto-reply enabled check is done at the processNoticeBoardConversations level
 */
async function shouldAIReplyToThread(thread: any[], immediate: boolean = false): Promise<boolean> {
  if (thread.length === 0) return false;

  const lastMessage = thread[thread.length - 1];

  // Don't respond if last message is from admin or AI
  if (lastMessage.senderType === "admin" ||
    lastMessage.senderType === "ai" ||
    lastMessage.senderType === "admin_assist") {
    return false;
  }

  // Check if AI has already responded to this message
  const lastUserMessage = lastMessage;
  const messagesAfterLastUser = thread.slice(thread.findIndex(msg => msg.id === lastUserMessage.id) + 1);
  const hasAIResponseToLastMessage = messagesAfterLastUser.some(
    (msg) => msg.senderType === "ai" || msg.senderType === "admin_assist"
  );

  if (hasAIResponseToLastMessage) {
    return false; // AI already responded to this message
  }

  // If this is an immediate call (right after message is sent), respond immediately
  if (immediate) {
    return true;
  }

  // For background processing, check message age
  const messageTime = new Date(lastUserMessage.createdAt).getTime();
  const now = new Date().getTime();
  const minutesSinceMessage = (now - messageTime) / (1000 * 60);

  // If message is older than 1 minute, always respond
  if (minutesSinceMessage >= 1) {
    return true;
  }

  // For messages less than 1 minute old, check for quick back-and-forth
  // If there are multiple messages in quick succession (within last 2 minutes), respond immediately
  const recentMessages = thread.filter(msg => {
    const msgTime = new Date(msg.createdAt).getTime();
    const minutesAgo = (now - msgTime) / (1000 * 60);
    return minutesAgo <= 2;
  });

  // If there are 3+ messages in the last 2 minutes, it's an active conversation - respond immediately
  if (recentMessages.length >= 3) {
    return true;
  }

  // Otherwise, wait for the 1 minute mark
  return false;
}

/**
 * Build context for AI response based on conversation thread
 */
function buildConversationContext(thread: any[]): string {
  // Get the last 10 messages for context (to avoid too long prompts)
  const contextMessages = thread.slice(-10);

  const contextParts = contextMessages.map((msg) => {
    let sender = "Member";
    if (msg.senderType === "admin") sender = "Admin";
    else if (msg.senderType === "ai" || msg.senderType === "admin_assist") sender = "Admin Assistant";

    return `${sender}: ${msg.content}`;
  });

  return contextParts.join("\n");
}

/**
 * Extract topic/keywords from a conversation thread
 */
function extractTopic(thread: any[]): string {
  // Get all user messages (not AI/admin)
  const userMessages = thread
    .filter((msg) => msg.senderType === "user" || msg.senderType === "admin")
    .map((msg) => msg.content.toLowerCase())
    .join(" ");

  // Simple keyword extraction (can be enhanced with NLP)
  const commonWords = [
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "are", "was", "were", "be", "been", "have",
    "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they"
  ];

  const words = userMessages
    .split(/\s+/)
    .filter((word) => word.length > 3 && !commonWords.includes(word))
    .slice(0, 10); // Top 10 keywords

  return words.join(", ");
}

/**
 * Generate AI response for a notice board message with context
 * This function sends the user's message to Make.ai with conversation context
 * @param userMessage - The user's message content
 * @param userId - The user ID
 * @param messageId - Optional: The message ID to reply to (if AI should reply to a specific message)
 */
export async function generateAIResponseForNoticeBoard(
  userMessage: string,
  userId: string,
  messageId?: string
): Promise<void> {
  try {
    // Get or create thread_id for the user
    const threadId = await getOrCreateThreadId(userId);

    // Generate a new chat_id for this notice board interaction
    const chatId = await generateChatId();

    // Send to Make.ai with sender_type as "user"
    const response = await sendToMakeAI(
      "user",
      userId,
      threadId,
      chatId,
      userMessage
    );

    // Post AI response to notice board as admin_assist
    // If messageId is provided, reply to that message; otherwise post as new message
    await postAIMessageToNoticeBoard(response.reply, userId, messageId);
  } catch (error) {
    console.error("Error generating AI response for notice board:", error);
    // Don't throw - we don't want to break the user's message posting
    // The error is already logged
  }
}

/**
 * Smart AI response system that analyzes conversations and responds intelligently
 * This function:
 * 1. Fetches recent messages
 * 2. Groups them into conversation threads
 * 3. Determines which threads need AI responses
 * 4. Generates context-aware responses
 * @param immediate - If true, AI will respond immediately to new messages. If false, follows normal timing rules.
 */
export async function processNoticeBoardConversations(immediate: boolean = false): Promise<void> {
  try {
    // Check if auto-reply is enabled first
    const autoReplyEnabled = await isAutoReplyEnabled();
    if (!autoReplyEnabled) {
      console.log("Auto-reply is disabled, skipping AI processing");
      return; // Don't process if auto-reply is disabled
    }

    console.log("Processing notice board conversations, immediate:", immediate);

    // Fetch recent messages - get the latest ones first
    const messages = await getRecentNoticeBoardMessages(100);

    if (messages.length === 0) {
      console.log("No messages found to process");
      return;
    }

    console.log(`Found ${messages.length} messages to process`);

    // If immediate processing, add a tiny delay to ensure database write is complete
    if (immediate) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms to ensure DB write completes
      // Re-fetch to get the latest message
      const updatedMessages = await getRecentNoticeBoardMessages(100);
      if (updatedMessages.length > messages.length) {
        console.log("New message detected, using updated messages");
        messages.push(...updatedMessages.slice(messages.length));
      }
    }

    // Group messages into conversation threads
    const threads = groupMessagesIntoThreads(messages);

    console.log(`Grouped into ${threads.length} conversation threads`);

    // Process each thread
    for (const thread of threads) {
      const shouldReply = await shouldAIReplyToThread(thread, immediate);
      if (!shouldReply) {
        console.log("Skipping thread - should not reply");
        continue; // Skip this thread
      }

      console.log("Processing thread for AI response");

      // Get the last user message in the thread
      const lastUserMessage = thread
        .slice()
        .reverse()
        .find(
          (msg) =>
            msg.senderType === "user" || msg.senderType === "admin"
        );

      if (!lastUserMessage) continue;

      // Build conversation context
      const context = buildConversationContext(thread);
      const topic = extractTopic(thread);

      // Get the actual user message content (last user message)
      const actualUserMessage = lastUserMessage.content;

      // Create a context-aware prompt for the AI
      const contextPrompt = `You are an Admin Assistant for a gym community chat. You're participating in a community notice board where members share ideas and ask questions.

Conversation context:
${context}

Topic keywords: ${topic}

The user's latest message: "${actualUserMessage}"

Please provide a helpful, friendly, and relevant response that:
- Stays on topic and continues the conversation naturally
- Is concise (2-3 sentences max)
- Adds value to the discussion
- Uses a friendly, supportive tone appropriate for a gym community

Respond as if you're part of the community conversation:`;

      try {
        // Get or create thread_id for the user who sent the last message
        const threadId = await getOrCreateThreadId(lastUserMessage.userId);
        const chatId = await generateChatId();

        // Calculate time since message
        const messageTime = new Date(lastUserMessage.createdAt).getTime();
        const now = new Date().getTime();
        const minutesSinceMessage = (now - messageTime) / (1000 * 60);

        // Build community chat metadata
        const communityChatData = DataMapper.toDb({
          messageId: lastUserMessage.id,
          replyTo: lastUserMessage.replyTo || null,
          isReply: !!lastUserMessage.replyTo,
          conversationContext: context,
          topicKeywords: topic,
          threadMessagesCount: thread.length,
          lastUserMessageId: lastUserMessage.id,
          messageCreatedAt: lastUserMessage.createdAt,
          minutesSinceMessage: minutesSinceMessage,
          threadParticipants: thread.map(msg => msg.senderType),
          actualUserMessage: actualUserMessage, // The actual message content
        });

        // Send to Make.ai with context and community chat data
        const response = await sendToMakeAIWithCommunityChat(
          "user",
          lastUserMessage.userId,
          threadId,
          chatId,
          contextPrompt,
          actualUserMessage,
          communityChatData
        );

        // Post AI response to notice board as a reply to the user's message
        await postAIMessageToNoticeBoard(response.reply, lastUserMessage.userId, lastUserMessage.id);

        // Add a small delay to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(
          `Error processing thread for user ${lastUserMessage.userId}:`,
          error
        );
        // Continue with other threads even if one fails
      }
    }
  } catch (error) {
    console.error("Error processing notice board conversations:", error);
  }
}

/**
 * Start the background AI conversation processor
 * This runs periodically to check for conversations that need AI responses
 */
export function startAIConversationProcessor(intervalMinutes: number = 5): () => void {
  let intervalId: NodeJS.Timeout | null = null;

  const process = async () => {
    try {
      // Check if auto-reply is enabled before processing
      const autoReplyEnabled = await isAutoReplyEnabled();
      if (autoReplyEnabled) {
        await processNoticeBoardConversations();
      }
    } catch (error) {
      console.error("Error in AI conversation processor:", error);
    }
  };

  // Run immediately on start
  process();

  // Then run periodically (check every 30 seconds when auto-reply is enabled to catch 1+ minute old messages)
  intervalId = setInterval(process, 30 * 1000); // 30 seconds

  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

