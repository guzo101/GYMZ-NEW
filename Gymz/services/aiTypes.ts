/**
 * Shared types for AI services to break circular dependencies
 */

export interface ChatCredentials {
    userId: string;
    threadId: string;
    chatId: string;
}

export interface WebhookResponse {
    reply: string;
    thread_id: string;
    chat_id: string;
}
