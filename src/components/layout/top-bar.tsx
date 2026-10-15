"use client";

import { PanelLeft } from "lucide-react";
import { ModelSelector } from "@/components/model/model-selector";

interface TopBarProps {
  selectedModelId: string;
  onModelChange: (id: string) => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export function TopBar({
  selectedModelId,
  onModelChange,
  onToggleSidebar,
  sidebarOpen,
}: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#273040]/50 bg-[#0B0D12]/80 px-4 backdrop-blur">
      {/* Toggle sidebar (visible when sidebar is hidden) */}
      {!sidebarOpen && (
        <button
          onClick={onToggleSidebar}
          className="hidden rounded-lg p-1.5 text-[#9AA6B8] transition-colors hover:bg-[#1a2235] hover:text-[#F3F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8] lg:flex"
          aria-label="Open sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      )}

      {/* Mobile toggle (always visible on small screens) */}
      <button
        onClick={onToggleSidebar}
        className="rounded-lg p-1.5 text-[#9AA6B8] transition-colors hover:bg-[#1a2235] hover:text-[#F3F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8] lg:hidden"
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      {/* Model selector */}
      <ModelSelector selectedId={selectedModelId} onChange={onModelChange} />

      {/* Demo indicator */}
      <div className="hidden items-center gap-1.5 rounded-full border border-amber-800/40 bg-amber-950/30 px-2.5 py-1 sm:flex">
        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        <span className="text-xs text-amber-400">Demo</span>
      </div>
    </header>
  );
}
