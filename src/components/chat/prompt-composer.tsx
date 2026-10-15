"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Send, Square, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptComposerProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export function PromptComposer({ onSend, onStop, isGenerating, disabled = false }: PromptComposerProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  const canSend = input.trim().length > 0 && !isGenerating && !disabled;

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating || disabled) return;
    onSend(trimmed);
    setInput("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isGenerating, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Don't intercept during IME composition
      if (isComposingRef.current) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  return (
    <div className="border-t border-[#273040]/50 bg-[#0B0D12]/80 px-4 pb-4 pt-3 backdrop-blur">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-xl border border-[#273040] bg-[#151A23] px-3 py-2 transition-colors focus-within:border-[#8AB4F8]/40">
          {/* Attachment button (disabled) */}
          <button
            disabled
            className="mb-0.5 shrink-0 rounded-lg p-2 text-[#9AA6B8]/40 cursor-not-allowed"
            aria-label="Attach file (coming later)"
            title="Attachments — coming later"
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            placeholder="Send a message…"
            rows={1}
            disabled={disabled}
            className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent text-sm text-[#F3F5F9] placeholder-[#9AA6B8]/50 focus:outline-none disabled:opacity-50"
            aria-label="Message input"
          />

          {/* Send / Stop button */}
          {isGenerating ? (
            <button
              onClick={onStop}
              className="mb-0.5 shrink-0 rounded-lg bg-red-600/80 p-2 text-white transition-colors hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
              aria-label="Stop generating"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className={cn(
                "mb-0.5 shrink-0 rounded-lg p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]",
                canSend
                  ? "bg-[#8AB4F8] text-[#0B0D12] hover:bg-[#a0c4fa]"
                  : "bg-[#273040]/50 text-[#9AA6B8]/40 cursor-not-allowed",
              )}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="mt-2 text-center text-[10px] text-[#9AA6B8]/40">
          Haishin Demo — responses are mock data, not from a trained model
        </p>
      </div>
    </div>
  );
}
