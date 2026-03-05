import { supabase } from "@/integrations/supabase/client";
import { DataMapper } from "@/utils/dataMapper";

export type VisitorChatSession = {
  id: string;
  visitorName?: string | null;
  visitorEmail?: string | null;
  visitorPhone?: string | null;
  preferredChannel?: string | null;
  status: string;
  lastMessageAt: string;
  createdAt: string;
};

export type VisitorChatMessage = {
  id: string;
  sessionId: string;
  sender: "visitor" | "admin";
  message: string;
  createdAt: string;
};

export async function createVisitorSession(payload: {
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  preferredChannel?: string;
}): Promise<VisitorChatSession> {
  const { data, error } = await supabase
    .from("visitor_chat_sessions")
    .insert(DataMapper.toDb(payload))
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return DataMapper.fromDb(data) as VisitorChatSession;
}

export async function fetchVisitorSession(sessionId: string) {
  const { data, error } = await supabase
    .from("visitor_chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return DataMapper.fromDb(data) as VisitorChatSession;
}

export async function listVisitorMessages(sessionId: string) {
  const { data, error } = await supabase
    .from("visitor_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (DataMapper.fromDb(data) || []) as VisitorChatMessage[];
}

export async function postVisitorMessage(sessionId: string, message: string) {
  const { data, error } = await supabase
    .from("visitor_chat_messages")
    .insert(DataMapper.toDb({
      sessionId: sessionId,
      sender: "visitor",
      message,
    }))
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return DataMapper.fromDb(data) as VisitorChatMessage;
}

export function subscribeToVisitorMessages(sessionId: string, onMessage: (message: VisitorChatMessage) => void) {
  const channel = supabase
    .channel(`public:visitor_chat_messages:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "visitor_chat_messages",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        onMessage(DataMapper.fromDb(payload.new) as VisitorChatMessage);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}


