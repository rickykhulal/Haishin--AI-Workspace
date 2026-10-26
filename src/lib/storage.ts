/**
 * Storage adapter for Haishin conversation persistence.
 * Uses browser localStorage with schema validation and corruption protection.
 * Never stores secrets or API keys.
 */

import type { Conversation, ChatMessage } from "../features/conversations/types.ts";
import { DEFAULT_MODEL_ID } from "../features/conversations/models.ts";

export const STORAGE_KEY = "haishin_conversations_v1";

/**
 * Validates and sanitizes a single chat message object loaded from storage.
 * Drops invalid or corrupt message objects.
 */
function sanitizeMessage(raw: unknown): ChatMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as Record<string, unknown>;

  if (typeof msg.id !== "string" || !msg.id) return null;
  if (msg.role !== "user" && msg.role !== "assistant" && msg.role !== "system") return null;
  if (typeof msg.content !== "string") return null;
  if (typeof msg.createdAt !== "string") return null;

  // Never persist messages stuck in pending or streaming status;
  // if found (e.g., from an abrupt crash/refresh mid-generation), mark as error or complete.
  let status = msg.status;
  let content = msg.content as string;
  if (status === "pending" || status === "streaming") {
    if (content.trim()) {
      status = "complete";
    } else {
      status = "error";
      content = "Response was interrupted before completion.";
    }
  }

  if (status !== "pending" && status !== "streaming" && status !== "complete" && status !== "error") {
    status = "complete";
  }

  const sanitized: ChatMessage = {
    id: msg.id as string,
    role: msg.role as ChatMessage["role"],
    content,
    createdAt: msg.createdAt as string,
    status: status as ChatMessage["status"],
  };

  if (msg.mode === "mock" || msg.mode === "local" || msg.mode === "external") {
    sanitized.mode = msg.mode;
  }
  if (typeof msg.durationMs === "number" && !Number.isNaN(msg.durationMs)) {
    sanitized.durationMs = msg.durationMs;
  }
  if (typeof msg.modelName === "string") {
    sanitized.modelName = msg.modelName;
  }

  return sanitized;
}

/**
 * Validates and sanitizes a conversation object loaded from storage.
 */
export function sanitizeConversation(raw: unknown): Conversation | null {
  if (!raw || typeof raw !== "object") return null;
  const conv = raw as Record<string, unknown>;

  if (typeof conv.id !== "string" || !conv.id) return null;
  if (typeof conv.title !== "string") return null;
  if (typeof conv.createdAt !== "string") return null;
  if (typeof conv.updatedAt !== "string") return null;

  const rawMessages = Array.isArray(conv.messages) ? conv.messages : [];
  const validMessages: ChatMessage[] = [];

  for (const m of rawMessages) {
    const sanitized = sanitizeMessage(m);
    if (sanitized) {
      validMessages.push(sanitized);
    }
  }

  const modelId = typeof conv.modelId === "string" && conv.modelId ? conv.modelId : DEFAULT_MODEL_ID;

  return {
    id: conv.id,
    title: conv.title || "Untitled chat",
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messages: validMessages,
    modelId,
  };
}

/**
 * Load conversations from localStorage safely.
 * Returns empty array if localStorage is unavailable or corrupt.
 */
export function loadConversations(): Conversation[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn("[Haishin Storage] Corrupted storage format: expected array, clearing");
      return [];
    }

    const conversations: Conversation[] = [];
    for (const item of parsed) {
      const sanitized = sanitizeConversation(item);
      if (sanitized) {
        conversations.push(sanitized);
      }
    }

    return conversations;
  } catch (err) {
    console.error("[Haishin Storage] Failed to load conversations from localStorage:", err);
    return [];
  }
}

/**
 * Save conversations to localStorage.
 * Filters out pending / empty generation messages before saving.
 */
export function saveConversations(conversations: Conversation[]): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    // Clean before saving: don't persist active streaming/pending placeholders without content
    const sanitizedToSave = conversations.map((conv) => ({
      ...conv,
      messages: conv.messages
        .filter((m) => !(m.status === "pending" && !m.content.trim()))
        .map((m) => {
          if (m.status === "streaming") {
            return { ...m, status: "complete" as const };
          }
          return m;
        }),
    }));

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedToSave));
    return true;
  } catch (err) {
    console.error("[Haishin Storage] Failed to save conversations to localStorage:", err);
    return false;
  }
}

/**
 * Clear stored conversations from localStorage.
 */
export function clearStoredConversations(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("[Haishin Storage] Failed to clear localStorage:", err);
  }
}
