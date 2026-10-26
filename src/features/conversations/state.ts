"use client";

import { useReducer, useCallback, useRef, useEffect } from "react";
import type { Conversation, ChatMessage, ResponseMode } from "./types";
import { generateId, now } from "@/lib/utils";
import { sendDemoRequest, generateTitle } from "@/lib/demo-responder";
import { sendLocalStreamingRequest } from "@/lib/local-api";
import { loadConversations, saveConversations } from "@/lib/storage";
import { DEFAULT_MODEL_ID, isLocalModel } from "./models";

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
  | { type: "LOAD_CONVERSATIONS"; payload: Conversation[] }
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
        mode?: ResponseMode;
        durationMs?: number;
        modelName?: string;
      };
    }
  | { type: "UPDATE_TITLE"; payload: { conversationId: string; title: string } }
  | { type: "SET_GENERATING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "REMOVE_LAST_ASSISTANT"; payload: string }
  | { type: "UPDATE_MODEL"; payload: { conversationId: string; modelId: string } };

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
    case "LOAD_CONVERSATIONS": {
      const convs = action.payload;
      return {
        ...state,
        conversations: convs,
        activeConversationId:
          state.activeConversationId && convs.some((c) => c.id === state.activeConversationId)
            ? state.activeConversationId
            : (convs[0]?.id ?? null),
      };
    }

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
                    ...(action.payload.mode !== undefined
                      ? { mode: action.payload.mode }
                      : {}),
                    ...(action.payload.durationMs !== undefined
                      ? { durationMs: action.payload.durationMs }
                      : {}),
                    ...(action.payload.modelName !== undefined
                      ? { modelName: action.payload.modelName }
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

    case "UPDATE_MODEL":
      return {
        ...state,
        conversations: updateConversation(
          state.conversations,
          action.payload.conversationId,
          (c) => ({ ...c, modelId: action.payload.modelId }),
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
  const isLoadedRef = useRef(false);

  // Load persisted conversations on client mount
  useEffect(() => {
    const loaded = loadConversations();
    if (loaded.length > 0) {
      dispatch({ type: "LOAD_CONVERSATIONS", payload: loaded });
    }
    isLoadedRef.current = true;
  }, []);

  // Save conversations to localStorage after state updates
  useEffect(() => {
    if (!isLoadedRef.current) return;
    saveConversations(state.conversations);
  }, [state.conversations]);

  const activeConversation =
    state.conversations.find((c) => c.id === state.activeConversationId) ?? null;

  const createConversation = useCallback(
    (modelId: string = DEFAULT_MODEL_ID) => {
      // If current active conversation is already brand new and empty, reuse it
      if (activeConversation && activeConversation.messages.length === 0) {
        return activeConversation.id;
      }
      const id = generateId();
      dispatch({
        type: "NEW_CONVERSATION",
        payload: { id, modelId, timestamp: now() },
      });
      return id;
    },
    [activeConversation],
  );

  const setActive = useCallback((id: string | null) => {
    dispatch({ type: "SET_ACTIVE", payload: id });
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    dispatch({ type: "UPDATE_TITLE", payload: { conversationId: id, title: trimmed } });
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      if (state.activeConversationId === id && state.isGenerating) {
        abortRef.current?.abort();
      }
      dispatch({ type: "DELETE_CONVERSATION", payload: id });
    },
    [state.activeConversationId, state.isGenerating],
  );

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

      const targetConvId = conversationId;

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
        payload: { conversationId: targetConvId, message: userMessage },
      });
      dispatch({
        type: "UPDATE_MODEL",
        payload: { conversationId: targetConvId, modelId },
      });

      // Set title from first message
      const conv = state.conversations.find((c) => c.id === targetConvId);
      if (!conv || conv.messages.length === 0) {
        dispatch({
          type: "UPDATE_TITLE",
          payload: { conversationId: targetConvId, title: generateTitle(trimmed) },
        });
      }

      const isLocal = isLocalModel(modelId);

      // Pending assistant placeholder
      const assistantId = generateId();
      const pendingMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: now(),
        status: "pending",
        mode: isLocal ? "local" : "mock",
      };
      dispatch({
        type: "ADD_ASSISTANT_MESSAGE",
        payload: { conversationId: targetConvId, message: pendingMessage },
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
      let streamedContent = "";

      try {
        if (isLocal) {
          const response = await sendLocalStreamingRequest(
            { conversationId: targetConvId, messages: existingMessages, modelId },
            (chunk) => {
              streamedContent = chunk.accumulatedContent;
              dispatch({
                type: "UPDATE_MESSAGE_STATUS",
                payload: {
                  conversationId: targetConvId,
                  messageId: assistantId,
                  status: "streaming",
                  content: chunk.accumulatedContent,
                  mode: "local",
                  durationMs: chunk.durationMs,
                  modelName: chunk.model,
                },
              });
            },
            controller.signal,
          );
          dispatch({
            type: "UPDATE_MESSAGE_STATUS",
            payload: {
              conversationId: targetConvId,
              messageId: assistantId,
              status: "complete",
              content: response.message.content,
              mode: "local",
              durationMs: response.durationMs,
              modelName: response.modelName,
            },
          });
        } else {
          const response = await sendDemoRequest(
            { conversationId: targetConvId, messages: existingMessages, modelId },
            controller.signal,
          );
          dispatch({
            type: "UPDATE_MESSAGE_STATUS",
            payload: {
              conversationId: targetConvId,
              messageId: assistantId,
              status: "complete",
              content: response.message.content,
              mode: "mock",
            },
          });
        }
      } catch (err: unknown) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        if (isAbort && streamedContent.trim().length > 0) {
          // If stopped after partial response was generated, retain streamed text as complete
          dispatch({
            type: "UPDATE_MESSAGE_STATUS",
            payload: {
              conversationId: targetConvId,
              messageId: assistantId,
              status: "complete",
              content: streamedContent,
              mode: isLocal ? "local" : "mock",
            },
          });
        } else {
          const errorMessage = isAbort
            ? "Response was cancelled."
            : (err instanceof Error ? err.message : "An error occurred while generating a response.");

          dispatch({
            type: "UPDATE_MESSAGE_STATUS",
            payload: {
              conversationId: targetConvId,
              messageId: assistantId,
              status: "error",
              content: errorMessage,
              mode: isLocal ? "local" : "mock",
            },
          });
          if (!isAbort) {
            dispatch({
              type: "SET_ERROR",
              payload: isLocal ? "Local inference error" : "Failed to generate response",
            });
          }
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
      const targetConvId = activeConversation.id;

      const lastUserMsg = [...activeConversation.messages]
        .reverse()
        .find((m) => m.role === "user");
      if (!lastUserMsg) return;

      dispatch({ type: "REMOVE_LAST_ASSISTANT", payload: targetConvId });

      const isLocal = isLocalModel(modelId);

      const assistantId = generateId();
      const pendingMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: now(),
        status: "pending",
        mode: isLocal ? "local" : "mock",
      };
      dispatch({
        type: "ADD_ASSISTANT_MESSAGE",
        payload: { conversationId: targetConvId, message: pendingMessage },
      });
      dispatch({ type: "SET_GENERATING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      const msgList = activeConversation.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(0, -1) // exclude the last assistant message we just removed
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const controller = new AbortController();
      abortRef.current = controller;
      let streamedContent = "";

      try {
        if (isLocal) {
          const response = await sendLocalStreamingRequest(
            { conversationId: targetConvId, messages: msgList, modelId },
            (chunk) => {
              streamedContent = chunk.accumulatedContent;
              dispatch({
                type: "UPDATE_MESSAGE_STATUS",
                payload: {
                  conversationId: targetConvId,
                  messageId: assistantId,
                  status: "streaming",
                  content: chunk.accumulatedContent,
                  mode: "local",
                  durationMs: chunk.durationMs,
                  modelName: chunk.model,
                },
              });
            },
            controller.signal,
          );
          dispatch({
            type: "UPDATE_MESSAGE_STATUS",
            payload: {
              conversationId: targetConvId,
              messageId: assistantId,
              status: "complete",
              content: response.message.content,
              mode: "local",
              durationMs: response.durationMs,
              modelName: response.modelName,
            },
          });
        } else {
          const response = await sendDemoRequest(
            { conversationId: targetConvId, messages: msgList, modelId },
            controller.signal,
          );
          dispatch({
            type: "UPDATE_MESSAGE_STATUS",
            payload: {
              conversationId: targetConvId,
              messageId: assistantId,
              status: "complete",
              content: response.message.content,
              mode: "mock",
            },
          });
        }
      } catch (err: unknown) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        if (isAbort && streamedContent.trim().length > 0) {
          // If stopped after partial response was generated, retain streamed text as complete
          dispatch({
            type: "UPDATE_MESSAGE_STATUS",
            payload: {
              conversationId: targetConvId,
              messageId: assistantId,
              status: "complete",
              content: streamedContent,
              mode: isLocal ? "local" : "mock",
            },
          });
        } else {
          const errorMessage = isAbort
            ? "Response was cancelled."
            : (err instanceof Error ? err.message : "An error occurred while retrying.");

          dispatch({
            type: "UPDATE_MESSAGE_STATUS",
            payload: {
              conversationId: targetConvId,
              messageId: assistantId,
              status: "error",
              content: errorMessage,
              mode: isLocal ? "local" : "mock",
            },
          });
          if (!isAbort) {
            dispatch({
              type: "SET_ERROR",
              payload: isLocal ? "Local inference error" : "Failed to generate response",
            });
          }
        }
      } finally {
        dispatch({ type: "SET_GENERATING", payload: false });
        abortRef.current = null;
      }
    },
    [activeConversation],
  );

  const setConversationModel = useCallback((conversationId: string, modelId: string) => {
    dispatch({ type: "UPDATE_MODEL", payload: { conversationId, modelId } });
  }, []);

  return {
    ...state,
    activeConversation,
    createConversation,
    setActive,
    renameConversation,
    deleteConversation,
    setConversationModel,
    sendMessage,
    stopGeneration,
    retryLastMessage,
  };
}
