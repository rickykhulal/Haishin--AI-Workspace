"use client";

import { Bot, User, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/features/conversations/types";
import { MessageActions } from "./message-actions";
import { MarkdownRenderer } from "./markdown-renderer";

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isPending = message.status === "pending" || (message.status === "streaming" && !message.content);
  const isStreaming = message.status === "streaming" && Boolean(message.content);
  const isError = message.status === "error";
  const isLocal = message.mode === "local";

  const assistantName = isLocal ? "Haishin Local" : "Haishin Demo";

  return (
    <div
      className={cn("group flex gap-3 py-4", isUser ? "justify-end" : "justify-start")}
      role="article"
      aria-label={`${isUser ? "You" : assistantName}: ${isPending ? "Generating response…" : ""}`}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
            isLocal
              ? "bg-gradient-to-br from-[#8AB4F8]/30 to-[#5B8DEF]/30 ring-[#8AB4F8]/40"
              : "bg-gradient-to-br from-[#8AB4F8]/20 to-[#5B8DEF]/20 ring-[#8AB4F8]/20",
          )}
        >
          <Bot className="h-4 w-4 text-[#8AB4F8]" aria-hidden="true" />
        </div>
      )}

      <div
        className={cn(
          "flex max-w-[85%] flex-col sm:max-w-[75%]",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* Label and badges */}
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-[#9AA6B8]">
            {isUser ? "You" : assistantName}
          </span>
          {!isUser && (
            <>
              {isLocal ? (
                <span className="rounded border border-[#8AB4F8]/30 bg-[#8AB4F8]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#8AB4F8]">
                  local
                </span>
              ) : (
                <span className="rounded bg-[#273040]/50 px-1.5 py-0.5 text-[10px] text-[#9AA6B8]">
                  mock
                </span>
              )}
              {message.modelName && !isPending && !isStreaming && (
                <span className="rounded border border-[#273040] bg-[#10141C] px-1.5 py-0.5 font-mono text-[10px] text-[#9AA6B8]">
                  {message.modelName}
                </span>
              )}
              {message.durationMs && !isPending && !isStreaming && (
                <span className="text-[10px] text-[#9AA6B8]/60">
                  {(message.durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </>
          )}
        </div>

        {/* Message content */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "rounded-br-md bg-[#8AB4F8] text-[#0B0D12]"
              : "rounded-bl-md border border-[#273040]/50 bg-[#151A23] text-[#F3F5F9]",
            isError && !isUser && "border-red-800/40 bg-red-950/30 text-red-200",
          )}
        >
          {isPending ? (
            <div className="flex items-center gap-2 text-[#9AA6B8]" role="status">
              <Loader2 className="h-4 w-4 animate-spin text-[#8AB4F8]" aria-hidden="true" />
              <span>{isLocal ? "Running local model…" : "Generating response…"}</span>
            </div>
          ) : isError ? (
            <div className="flex items-start gap-2.5 text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
              <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                {message.content || "An error occurred."}
              </div>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div>
              <MarkdownRenderer content={message.content} />
              {isStreaming && (
                <span
                  className="inline-block h-3.5 w-1.5 ml-1 bg-[#8AB4F8] animate-pulse align-middle"
                  aria-hidden="true"
                />
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <MessageActions
          content={message.content}
          role={message.role as "user" | "assistant"}
          status={message.status}
          onRetry={!isUser ? onRetry : undefined}
        />
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#273040] ring-1 ring-[#273040]">
          <User className="h-4 w-4 text-[#9AA6B8]" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
