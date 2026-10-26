"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, Check, Clock, RotateCw, AlertTriangle, Layers } from "lucide-react";
import {
  DEFAULT_MODEL_ID,
  getModelById,
} from "@/features/conversations/models";
import {
  fetchInstalledModels,
  refreshInstalledModels,
  type ModelsCatalogResponse,
} from "@/lib/local-api";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  selectedId: string;
  onChange: (id: string) => void;
}

export function ModelSelector({ selectedId, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<ModelsCatalogResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadModels = useCallback(async (forceRefresh = false) => {
    setIsRefreshing(true);
    try {
      const data = forceRefresh
        ? await refreshInstalledModels()
        : await fetchInstalledModels();
      if (data) {
        setCatalog(data);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Fetch installed models on initial mount
  useEffect(() => {
    let active = true;
    fetchInstalledModels().then((data) => {
      if (active && data) {
        setCatalog(data);
      }
    });
    return () => {
      active = false;
    };
  }, []);

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

  // Build the list of selectable models merging dynamic Ollama catalog with static entries
  const modelList = useMemo(() => {
    const list: Array<{
      id: string;
      label: string;
      provider: "local" | "demo" | "haishin";
      status: "available" | "coming_soon";
      description: string;
      isDefault?: boolean;
      isLoaded?: boolean;
      paramSize?: string;
      quant?: string;
      needsCpuOffload?: boolean;
    }> = [];

    const installed = catalog?.models ?? [];
    const seenIds = new Set<string>();

    if (installed.length > 0) {
      for (const m of installed) {
        seenIds.add(m.id);
        const isDefault = m.is_default || m.id === DEFAULT_MODEL_ID;
        const needsCpuOffload =
          Boolean(m.size_bytes && m.size_bytes > 3.8 * 1024 * 1024 * 1024) ||
          m.id.includes("9b");

        let desc = "";
        if (m.id === "llama3.2:1b") {
          desc = "1.2B parameters (Q8_0). Fast local GPU inference. Recommended default.";
        } else if (m.id === "richardyoung/qwythos-9b-abliterated:Q4_K_M") {
          desc = "9.0B parameters (Q4_K_M). Offloads to CPU RAM (4GB VRAM limit).";
        } else {
          desc = `${m.parameter_size || ""} ${m.quantization ? `(${m.quantization})` : ""} local Ollama model.`.trim();
        }

        list.push({
          id: m.id,
          label: m.id,
          provider: "local",
          status: "available",
          description: desc,
          isDefault,
          isLoaded: m.is_loaded,
          paramSize: m.parameter_size || undefined,
          quant: m.quantization || undefined,
          needsCpuOffload,
        });
      }
    } else {
      // Fallback baseline when Ollama is offline or catalog is loading
      list.push(
        {
          id: "llama3.2:1b",
          label: "llama3.2:1b",
          provider: "local",
          status: "available",
          description: "1.2B parameters (Q8_0). Fast local GPU inference. (Offline fallback)",
          isDefault: true,
          paramSize: "1.2B",
          quant: "Q8_0",
        },
        {
          id: "richardyoung/qwythos-9b-abliterated:Q4_K_M",
          label: "richardyoung/qwythos-9b-abliterated:Q4_K_M",
          provider: "local",
          status: "available",
          description: "9.0B parameters (Q4_K_M). Offloads to CPU RAM (4GB VRAM limit).",
          isDefault: false,
          paramSize: "9.0B",
          quant: "Q4_K_M",
          needsCpuOffload: true,
        }
      );
      seenIds.add("llama3.2:1b");
      seenIds.add("richardyoung/qwythos-9b-abliterated:Q4_K_M");
    }

    // Add Demo mode
    list.push({
      id: "haishin-demo",
      label: "Haishin Demo (mock)",
      provider: "demo",
      status: "available",
      description: "Local mock responder — not a trained model. Pre-written examples.",
    });

    // Add Coming soon placeholders to preserve UI
    list.push(
      {
        id: "haishin-1",
        label: "Haishin-1",
        provider: "haishin",
        status: "coming_soon",
        description: "Coming later — Haishin's first trained model.",
      },
      {
        id: "haishin-1-mini",
        label: "Haishin-1 Mini",
        provider: "haishin",
        status: "coming_soon",
        description: "Coming later — a smaller, faster variant.",
      }
    );

    return list;
  }, [catalog]);

  // Selected item display info
  const selectedDisplay = useMemo(() => {
    // Normalization for legacy 'haishin-local'
    const targetId = selectedId === "haishin-local" ? DEFAULT_MODEL_ID : selectedId;
    const match = modelList.find((m) => m.id === targetId);
    if (match) {
      return match;
    }
    const fallback = getModelById(targetId);
    return {
      id: targetId,
      label: fallback?.label || targetId,
      provider: fallback?.provider || "local",
      status: "available" as const,
      description: fallback?.description || "Selected model",
    };
  }, [selectedId, modelList]);

  const shortSelectedLabel = useMemo(() => {
    const raw = selectedDisplay.label;
    if (raw === "llama3.2:1b") return "llama3.2:1b";
    if (raw.includes("qwythos-9b")) return "qwythos-9b (4GB offload)";
    if (raw.length > 24) return raw.split("/").pop() || raw;
    return raw;
  }, [selectedDisplay]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg border border-[#273040] bg-[#151A23] px-3 py-1.5 text-sm text-[#F3F5F9] transition-colors hover:border-[#8AB4F8]/30 hover:bg-[#1a2235] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select model"
      >
        <span className="max-w-[150px] truncate sm:max-w-[240px] font-mono text-xs font-medium text-[#F3F5F9]">
          {shortSelectedLabel}
        </span>
        {selectedDisplay.id === DEFAULT_MODEL_ID && (
          <span className="hidden sm:inline-block rounded bg-[#8AB4F8]/15 border border-[#8AB4F8]/30 px-1 py-0.2 text-[9px] font-medium text-[#8AB4F8]">
            default
          </span>
        )}
        <ChevronDown
          className={cn("h-3.5 w-3.5 opacity-60 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-80 sm:w-96 rounded-xl border border-[#273040] bg-[#10141C] p-1.5 shadow-2xl max-h-[85vh] overflow-y-auto"
          role="listbox"
          aria-label="Available models"
        >
          {/* Header with status and refresh */}
          <div className="flex items-center justify-between border-b border-[#273040]/60 px-3 py-2 mb-1 text-xs text-[#9AA6B8]">
            <span className="font-semibold text-[#F3F5F9]">Installed Local Models</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                loadModels(true);
              }}
              disabled={isRefreshing}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[#1A202C] hover:text-[#F3F5F9] transition-colors disabled:opacity-50"
              title="Refresh installed models from Ollama"
              aria-label="Refresh model catalog"
            >
              <RotateCw className={cn("h-3 w-3", isRefreshing && "animate-spin text-[#8AB4F8]")} />
              <span className="text-[10px]">Refresh</span>
            </button>
          </div>

          {/* Offline warning if Ollama is unreachable */}
          {catalog && !catalog.runtime_available && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-950/30 border border-amber-800/40 p-2 mx-1 mb-2 text-xs text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-medium text-[11px]">Ollama runtime offline</p>
                <p className="text-[10px] text-amber-300/80 mt-0.5">
                  Start Ollama on port 11434 to enable live inference.
                </p>
              </div>
            </div>
          )}

          {/* Model options list */}
          <div className="space-y-1">
            {modelList.map((model) => {
              const isSelected =
                model.id === selectedId ||
                (selectedId === "haishin-local" && model.id === DEFAULT_MODEL_ID);
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
                    "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AB4F8] focus-visible:ring-inset",
                    isDisabled
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-[#151A23]",
                    isSelected && !isDisabled && "bg-[#151A23] border border-[#273040]/70",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "font-mono font-medium text-xs truncate max-w-[200px]",
                          isDisabled ? "text-[#9AA6B8]" : "text-[#F3F5F9]"
                        )}
                        title={model.id}
                      >
                        {model.label}
                      </span>

                      {model.isDefault && (
                        <span className="rounded bg-[#8AB4F8]/15 border border-[#8AB4F8]/30 px-1.5 py-0.2 text-[9px] font-medium text-[#8AB4F8]">
                          Default
                        </span>
                      )}

                      {model.isLoaded && (
                        <span className="flex items-center gap-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 text-[9px] font-medium text-emerald-400">
                          <Layers className="h-2.5 w-2.5" />
                          Loaded
                        </span>
                      )}

                      {model.needsCpuOffload && (
                        <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1 py-0.2 text-[9px] text-amber-400">
                          CPU offload (4GB limit)
                        </span>
                      )}

                      {isDisabled && (
                        <span className="flex items-center gap-1 rounded-full bg-[#273040]/50 px-2 py-0.5 text-[9px] text-[#9AA6B8]">
                          <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                          Coming later
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-[11px] text-[#9AA6B8] leading-tight">
                      {model.description}
                    </p>

                    {(model.paramSize || model.quant) && (
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-[#9AA6B8]/70 font-mono">
                        {model.paramSize && <span>Params: {model.paramSize}</span>}
                        {model.quant && <span>Quant: {model.quant}</span>}
                      </div>
                    )}
                  </div>

                  {isSelected && !isDisabled && (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8AB4F8]" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
