"use client";

import type { Conversation } from "@/features/conversations/types";
import { MessageList } from "./message-list";
import { WelcomeScreen } from "./welcome-screen";
import { PromptComposer } from "./prompt-composer";

interface ChatViewProps {
  conversation: Conversation | null;
  isGenerating: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
  onRetry: () => void;
}

export function ChatView({
  conversation,
  isGenerating,
  onSend,
  onStop,
  onRetry,
}: ChatViewProps) {
  const hasMessages = conversation && conversation.messages.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {hasMessages ? (
        <MessageList messages={conversation.messages} onRetry={onRetry} />
      ) : (
        <WelcomeScreen onSendPrompt={onSend} />
      )}

      <PromptComposer
        onSend={onSend}
        onStop={onStop}
        isGenerating={isGenerating}
      />
    </div>
  );
}
