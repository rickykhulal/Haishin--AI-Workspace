"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { Conversation } from "@/features/conversations/types";

interface ConversationListItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationListItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: ConversationListItemProps) {
  return (
    <div
      className={cn(
        "group flex w-full items-center gap-1 rounded-lg px-2 py-1 transition-colors",
        isActive
          ? "bg-[#1a2235] text-[#F3F5F9]"
          : "text-[#9AA6B8] hover:bg-[#151A23] hover:text-[#F3F5F9]",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded py-1.5 pl-1 pr-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
        aria-current={isActive ? "page" : undefined}
      >
        <MessageSquare className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-snug">{conversation.title}</p>
          <p className="text-[11px] opacity-60">{formatTime(conversation.updatedAt)}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onDelete(conversation.id)}
        className="shrink-0 rounded p-1.5 opacity-0 transition-opacity hover:bg-red-900/30 hover:text-red-400 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
        aria-label={`Delete conversation: ${conversation.title}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-[#9AA6B8]/60">
        <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" aria-hidden="true" />
        <p>No conversations yet</p>
        <p className="mt-1 text-xs">Start a new chat to begin</p>
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Conversation history">
      {conversations.map((conv) => (
        <ConversationListItem
          key={conv.id}
          conversation={conv}
          isActive={conv.id === activeId}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </nav>
  );
}
