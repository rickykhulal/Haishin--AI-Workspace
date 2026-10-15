"use client";

import { useReducer, useCallback, useRef } from "react";
import type { Conversation, ChatMessage } from "./types";
import { generateId, now } from "@/lib/utils";
import { sendDemoRequest, generateTitle } from "@/lib/demo-responder";
import { DEFAULT_MODEL_ID } from "./models";

// ────────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────────

export interface ConversationsState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isGenerating: boolean;
  error: string | null;
}

const initialState: ConversationsState = {
  conversations: [],
  activeConversationId: null,
  isGenerating: false,
  error: null,
};

// ────────────────────────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────────────────────────

type Action =
  | { type: "NEW_CONVERSATION"; payload: { id: string; modelId: string; timestamp: string } }
  | { type: "SET_ACTIVE"; payload: string | null }
  | { type: "DELETE_CONVERSATION"; payload: string }
  | { type: "ADD_USER_MESSAGE"; payload: { conversationId: string; message: ChatMessage } }
  | { type: "ADD_ASSISTANT_MESSAGE"; payload: { conversationId: string; message: ChatMessage } }
  | {
      type: "UPDATE_MESSAGE_STATUS";
      payload: {
        conversationId: string;
        messageId: string;
        status: ChatMessage["status"];
        content?: string;
      };
    }
  | { type: "UPDATE_TITLE"; payload: { conversationId: string; title: string } }
  | { type: "SET_GENERATING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "REMOVE_LAST_ASSISTANT"; payload: string };

// ────────────────────────────────────────────────────────────────────
// Reducer
// ────────────────────────────────────────────────────────────────────

function updateConversation(
  conversations: Conversation[],
  id: string,
  updater: (c: Conversation) => Conversation,
): Conversation[] {
  return conversations.map((c) => (c.id === id ? updater(c) : c));
}

function reducer(state: ConversationsState, action: Action): ConversationsState {
  switch (action.type) {
    case "NEW_CONVERSATION": {
      const newConv: Conversation = {
        id: action.payload.id,
        title: "New chat",
        createdAt: action.payload.timestamp,
        updatedAt: action.payload.timestamp,
        messages: [],
        modelId: action.payload.modelId,
      };
      return {
        ...state,
        conversations: [newConv, ...state.conversations],
        activeConversationId: newConv.id,
        error: null,
      };
    }

    case "SET_ACTIVE":
      return { ...state, activeConversationId: action.payload, error: null };

    case "DELETE_CONVERSATION": {
      const filtered = state.conversations.filter((c) => c.id !== action.payload);
      return {
        ...state,
        conversations: filtered,
        activeConversationId:
          state.activeConversationId === action.payload
            ? (filtered[0]?.id ?? null)
            : state.activeConversationId,
      };
    }

    case "ADD_USER_MESSAGE":
      return {
        ...state,
        conversations: updateConversation(
          state.conversations,
          action.payload.conversationId,
          (c) => ({
            ...c,
            messages: [...c.messages, action.payload.message],
            updatedAt: action.payload.message.createdAt,
          }),
        ),
      };

    case "ADD_ASSISTANT_MESSAGE":
      return {
        ...state,
        conversations: updateConversation(
          state.conversations,
          action.payload.conversationId,
          (c) => ({
            ...c,
            messages: [...c.messages, action.payload.message],
            updatedAt: action.payload.message.createdAt,
          }),
        ),
      };

    case "UPDATE_MESSAGE_STATUS":
      return {
        ...state,
        conversations: updateConversation(
          state.conversations,
          action.payload.conversationId,
          (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === action.payload.messageId
                ? {
                    ...m,
                    status: action.payload.status,
                    ...(action.payload.content !== undefined
                      ? { content: action.payload.content }
                      : {}),
                  }
                : m,
            ),
          }),
        ),
      };

    case "UPDATE_TITLE":
      return {
        ...state,
        conversations: updateConversation(
          state.conversations,
          action.payload.conversationId,
          (c) => ({ ...c, title: action.payload.title }),
        ),
      };

    case "SET_GENERATING":
      return { ...state, isGenerating: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "REMOVE_LAST_ASSISTANT":
      return {
        ...state,
        conversations: updateConversation(
          state.conversations,
          action.payload,
          (c) => {
            const lastIdx = findLastIndex(c.messages, (m) => m.role === "assistant");
            if (lastIdx === -1) return c;
            return { ...c, messages: c.messages.filter((_, i) => i !== lastIdx) };
          },
        ),
      };

    default:
      return state;
  }
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i]!)) return i;
  }
  return -1;
}

// ────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────

export function useConversations() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  const activeConversation =
    state.conversations.find((c) => c.id === state.activeConversationId) ?? null;

  const createConversation = useCallback(
    (modelId: string = DEFAULT_MODEL_ID) => {
      const id = generateId();
      dispatch({
        type: "NEW_CONVERSATION",
        payload: { id, modelId, timestamp: now() },
      });
      return id;
    },
    [],
  );

  const setActive = useCallback((id: string | null) => {
    dispatch({ type: "SET_ACTIVE", payload: id });
  }, []);

  const deleteConversation = useCallback((id: string) => {
    dispatch({ type: "DELETE_CONVERSATION", payload: id });
  }, []);

  const sendMessage = useCallback(
    async (content: string, modelId: string = DEFAULT_MODEL_ID) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      let conversationId = state.activeConversationId;

      if (!conversationId) {
        conversationId = generateId();
        dispatch({
          type: "NEW_CONVERSATION",
          payload: { id: conversationId, modelId, timestamp: now() },
        });
      }

      // User message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        createdAt: now(),
        status: "complete",
      };
      dispatch({
        type: "ADD_USER_MESSAGE",
        payload: { conversationId, message: userMessage },
      });

      // Set title from first message
      const conv = state.conversations.find((c) => c.id === conversationId);
      if (!conv || conv.messages.length === 0) {
        dispatch({
          type: "UPDATE_TITLE",
          payload: { conversationId, title: generateTitle(trimmed) },
        });
      }

      // Pending assistant placeholder
      const assistantId = generateId();
      const pendingMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: now(),
        status: "pending",
      };
      dispatch({
        type: "ADD_ASSISTANT_MESSAGE",
        payload: { conversationId, message: pendingMessage },
      });
      dispatch({ type: "SET_GENERATING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      // Build messages for the request
      const existingMessages = (conv?.messages ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      existingMessages.push({ role: "user", content: trimmed });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await sendDemoRequest(
          { conversationId, messages: existingMessages, modelId },
          controller.signal,
        );
        dispatch({
          type: "UPDATE_MESSAGE_STATUS",
          payload: {
            conversationId,
            messageId: assistantId,
            status: "complete",
            content: response.message.content,
          },
        });
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        dispatch({
          type: "UPDATE_MESSAGE_STATUS",
          payload: {
            conversationId,
            messageId: assistantId,
            status: "error",
            content: isAbort
              ? "Response was cancelled."
              : "An error occurred while generating a response.",
          },
        });
        if (!isAbort) {
          dispatch({ type: "SET_ERROR", payload: "Failed to generate response" });
        }
      } finally {
        dispatch({ type: "SET_GENERATING", payload: false });
        abortRef.current = null;
      }
    },
    [state.activeConversationId, state.conversations],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retryLastMessage = useCallback(
    async (modelId: string = DEFAULT_MODEL_ID) => {
      if (!activeConversation) return;

      const lastUserMsg = [...activeConversation.messages]
        .reverse()
        .find((m) => m.role === "user");
      if (!lastUserMsg) return;

      dispatch({ type: "REMOVE_LAST_ASSISTANT", payload: activeConversation.id });

      const assistantId = generateId();
      const pendingMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: now(),
        status: "pending",
      };
      dispatch({
        type: "ADD_ASSISTANT_MESSAGE",
        payload: { conversationId: activeConversation.id, message: pendingMessage },
      });
      dispatch({ type: "SET_GENERATING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      const msgList = activeConversation.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(0, -1) // exclude the last assistant message we just removed
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await sendDemoRequest(
          { conversationId: activeConversation.id, messages: msgList, modelId },
          controller.signal,
        );
        dispatch({
          type: "UPDATE_MESSAGE_STATUS",
          payload: {
            conversationId: activeConversation.id,
            messageId: assistantId,
            status: "complete",
            content: response.message.content,
          },
        });
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        dispatch({
          type: "UPDATE_MESSAGE_STATUS",
          payload: {
            conversationId: activeConversation.id,
            messageId: assistantId,
            status: "error",
            content: isAbort ? "Response was cancelled." : "An error occurred while retrying.",
          },
        });
      } finally {
        dispatch({ type: "SET_GENERATING", payload: false });
        abortRef.current = null;
      }
    },
    [activeConversation],
  );

  return {
    ...state,
    activeConversation,
    createConversation,
    setActive,
    deleteConversation,
    sendMessage,
    stopGeneration,
    retryLastMessage,
  };
}
