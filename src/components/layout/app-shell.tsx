"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { ChatView } from "@/components/chat/chat-view";
import { SettingsDialog } from "./settings-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConversations } from "@/features/conversations/state";
import { DEFAULT_MODEL_ID } from "@/features/conversations/models";

export function AppShell() {
  const {
    conversations,
    activeConversationId,
    activeConversation,
    isGenerating,
    error,
    createConversation,
    setActive,
    deleteConversation,
    sendMessage,
    stopGeneration,
    retryLastMessage,
  } = useConversations();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleNewChat = useCallback(() => {
    createConversation(selectedModelId);
    // Close mobile sidebar after creating
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [createConversation, selectedModelId]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActive(id);
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    },
    [setActive],
  );

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content, selectedModelId);
    },
    [sendMessage, selectedModelId],
  );

  const handleRetry = useCallback(() => {
    retryLastMessage(selectedModelId);
  }, [retryLastMessage, selectedModelId]);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteConversation(deleteTarget);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteConversation]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0D12]">
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onDelete={setDeleteTarget}
        onOpenSettings={() => setSettingsOpen(true)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          selectedModelId={selectedModelId}
          onModelChange={setSelectedModelId}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          sidebarOpen={sidebarOpen}
        />

        <ChatView
          conversation={activeConversation}
          isGenerating={isGenerating}
          onSend={handleSend}
          onStop={stopGeneration}
          onRetry={handleRetry}
        />

        {/* Global error */}
        {error && (
          <div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg border border-red-800/30 bg-red-950/80 px-4 py-2 text-sm text-red-300 shadow-lg"
            role="alert"
          >
            {error}
          </div>
        )}
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete conversation"
        message="This conversation will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
