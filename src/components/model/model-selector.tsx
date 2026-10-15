"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Clock } from "lucide-react";
import { MODEL_OPTIONS } from "@/features/conversations/models";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  selectedId: string;
  onChange: (id: string) => void;
}

export function ModelSelector({ selectedId, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = MODEL_OPTIONS.find((m) => m.id === selectedId) ?? MODEL_OPTIONS[0]!;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg border border-[#273040] bg-[#151A23] px-3 py-1.5 text-sm text-[#F3F5F9] transition-colors hover:border-[#8AB4F8]/30 hover:bg-[#1a2235] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select model"
      >
        <span className="max-w-[140px] truncate sm:max-w-[200px]">{selected.label}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 opacity-60 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-[#273040] bg-[#10141C] p-1 shadow-2xl"
          role="listbox"
          aria-label="Available models"
        >
          {MODEL_OPTIONS.map((model) => {
            const isSelected = model.id === selectedId;
            const isDisabled = model.status === "coming_soon";

            return (
              <button
                key={model.id}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled}
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    onChange(model.id);
                    setOpen(false);
                  }
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8] focus-visible:ring-inset",
                  isDisabled
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-[#151A23]",
                  isSelected && !isDisabled && "bg-[#151A23]",
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", isDisabled ? "text-[#9AA6B8]" : "text-[#F3F5F9]")}>
                      {model.label}
                    </span>
                    {isDisabled && (
                      <span className="flex items-center gap-1 rounded-full bg-[#273040]/50 px-2 py-0.5 text-[10px] text-[#9AA6B8]">
                        <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                        Coming later
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#9AA6B8]">{model.description}</p>
                </div>
                {isSelected && !isDisabled && (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8AB4F8]" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
