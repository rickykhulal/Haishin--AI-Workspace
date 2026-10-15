"use client";

import { Plus, PanelLeftClose, Settings } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { ConversationList } from "./conversation-list";
import type { Conversation } from "@/features/conversations/types";
import { cn } from "@/lib/utils";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onOpenSettings,
  isOpen,
  onToggle,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#273040] bg-[#10141C] transition-transform duration-200 ease-in-out lg:relative lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden lg:border-0",
        )}
        aria-label="Sidebar navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#273040]/50 px-4 py-4">
          <BrandMark />
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 text-[#9AA6B8] transition-colors hover:bg-[#1a2235] hover:text-[#F3F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* New Chat button */}
        <div className="px-3 pt-3">
          <button
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#273040] bg-[#151A23] px-4 py-2.5 text-sm font-medium text-[#F3F5F9] transition-colors hover:border-[#8AB4F8]/30 hover:bg-[#1a2235] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        </div>

        {/* Bottom section */}
        <div className="border-t border-[#273040]/50 px-3 py-3">
          <button
            onClick={onOpenSettings}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#9AA6B8] transition-colors hover:bg-[#151A23] hover:text-[#F3F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </button>
        </div>
      </aside>
    </>
  );
}
