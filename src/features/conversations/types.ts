/**
 * Core type definitions for the Haishin conversation system.
 */

export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus = "pending" | "streaming" | "complete" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  status: MessageStatus;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  modelId: string;
}

export type ModelProvider = "demo" | "haishin" | "external";
export type ModelStatus = "available" | "coming_soon";

export interface ModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
  status: ModelStatus;
  description: string;
}
