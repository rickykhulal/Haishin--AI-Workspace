"use client";

import type { Conversation } from "@/features/conversations/types";
import { isLocalModel } from "@/features/conversations/models";
import { MessageList } from "./message-list";
import { WelcomeScreen } from "./welcome-screen";
import { PromptComposer } from "./prompt-composer";

interface ChatViewProps {
  conversation: Conversation | null;
  isGenerating: boolean;
  selectedModelId: string;
  onSend: (message: string) => void;
  onStop: () => void;
  onRetry: () => void;
}

export function ChatView({
  conversation,
  isGenerating,
  selectedModelId,
  onSend,
  onStop,
  onRetry,
}: ChatViewProps) {
  const hasMessages = conversation && conversation.messages.length > 0;
  const isLocal = isLocalModel(selectedModelId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {hasMessages ? (
        <MessageList messages={conversation.messages} onRetry={onRetry} />
      ) : (
        <WelcomeScreen onSendPrompt={onSend} isLocal={isLocal} />
      )}

      <PromptComposer
        onSend={onSend}
        onStop={onStop}
        isGenerating={isGenerating}
        isLocal={isLocal}
      />
    </div>
  );
}
