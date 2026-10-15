"use client";

import { useRef, useEffect } from "react";
import type { ChatMessage } from "@/features/conversations/types";
import { MessageBubble } from "./message-bubble";

interface MessageListProps {
  messages: ChatMessage[];
  onRetry: () => void;
}

export function MessageList({ messages, onRetry }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  const lastMessageStatus = messages[messages.length - 1]?.status;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, lastMessageStatus]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
    >
      <div className="mx-auto max-w-3xl">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            onRetry={
              message.role === "assistant" && index === messages.length - 1
                ? onRetry
                : undefined
            }
          />
        ))}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  );
}
