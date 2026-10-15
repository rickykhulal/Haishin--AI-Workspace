"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        className="mx-4 w-full max-w-lg rounded-xl border border-[#273040] bg-[#10141C] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#273040]/50 px-6 py-4">
          <h2 id="settings-title" className="text-lg font-semibold text-[#F3F5F9]">
            Settings
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9AA6B8] transition-colors hover:bg-[#151A23] hover:text-[#F3F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* General section */}
          <section>
            <h3 className="text-sm font-medium text-[#F3F5F9]">General</h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-[#273040]/50 bg-[#151A23] px-4 py-3">
                <div>
                  <p className="text-sm text-[#F3F5F9]">Theme</p>
                  <p className="text-xs text-[#9AA6B8]">Dark mode only for now</p>
                </div>
                <span className="rounded-full bg-[#273040]/50 px-3 py-1 text-xs text-[#9AA6B8]">
                  Dark
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#273040]/50 bg-[#151A23] px-4 py-3">
                <div>
                  <p className="text-sm text-[#F3F5F9]">Language</p>
                  <p className="text-xs text-[#9AA6B8]">Interface language</p>
                </div>
                <span className="rounded-full bg-[#273040]/50 px-3 py-1 text-xs text-[#9AA6B8]">
                  English
                </span>
              </div>
            </div>
          </section>

          {/* Account section */}
          <section>
            <h3 className="text-sm font-medium text-[#F3F5F9]">Account</h3>
            <div className="mt-3 rounded-lg border border-[#273040]/50 bg-[#151A23] px-4 py-3">
              <p className="text-sm text-[#9AA6B8]">
                Authentication is not implemented yet. This will be available in a future update.
              </p>
            </div>
          </section>

          {/* About section */}
          <section>
            <h3 className="text-sm font-medium text-[#F3F5F9]">About</h3>
            <div className="mt-3 space-y-2 text-sm text-[#9AA6B8]">
              <p>
                <span className="text-[#F3F5F9]">Haishin</span> v0.1.0 — Frontend Demo
              </p>
              <p>
                Built by{" "}
                <span className="text-[#F3F5F9]">Haitian (H-Y-C-E-A-N)</span>
              </p>
              <p className="text-xs text-[#9AA6B8]/60">
                This is a development preview. No trained model is running.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
