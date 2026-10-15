"use client";

import { Copy, RotateCcw, Check, AlertCircle } from "lucide-react";
import { useState, useCallback } from "react";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface MessageActionsProps {
  content: string;
  role: "user" | "assistant" | "system";
  status: "pending" | "streaming" | "complete" | "error";
  onRetry?: () => void;
}

export function MessageActions({ content, role, status, onRetry }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopied(true);
      addToast("Copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } else {
      addToast("Failed to copy to clipboard", "error");
    }
  }, [content, addToast]);

  if (status === "pending" || status === "streaming") return null;
  if (!content) return null;

  return (
    <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <button
        onClick={handleCopy}
        className="rounded p-1 text-[#9AA6B8] transition-colors hover:bg-[#273040]/50 hover:text-[#F3F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
        aria-label={copied ? "Copied" : "Copy message"}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>

      {role === "assistant" && onRetry && (
        <button
          onClick={onRetry}
          className="rounded p-1 text-[#9AA6B8] transition-colors hover:bg-[#273040]/50 hover:text-[#F3F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
          aria-label="Retry response"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}

      {status === "error" && (
        <span className="ml-1 flex items-center gap-1 text-xs text-red-400">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          Error
        </span>
      )}
    </div>
  );
}
