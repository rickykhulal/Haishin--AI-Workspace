import type { ModelOption } from "./types";

/**
 * Model registry for the Haishin workspace.
 * Supports dual local models:
 * - llama3.2:1b (default fast model)
 * - richardyoung/qwythos-9b-abliterated:Q4_K_M (larger 9B model with CPU offloading)
 * Preserves demo mock mode as an explicitly labeled fallback.
 */
export const DEFAULT_MODEL_ID = "llama3.2:1b";
export const SECONDARY_MODEL_ID = "richardyoung/qwythos-9b-abliterated:Q4_K_M";
export const LEGACY_DEFAULT_MODEL_ID = "haishin-local";

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "llama3.2:1b",
    label: "llama3.2:1b (Default)",
    provider: "local",
    status: "available",
    description: "1.2B parameters (Q8_0). Fast local inference on NVIDIA GPU.",
  },
  {
    id: "richardyoung/qwythos-9b-abliterated:Q4_K_M",
    label: "richardyoung/qwythos-9b-abliterated:Q4_K_M",
    provider: "local",
    status: "available",
    description: "9.0B parameters (Q4_K_M). Offloads to CPU RAM (4GB VRAM limit).",
  },
  {
    id: "haishin-local",
    label: "Haishin Local (Ollama)",
    provider: "local",
    status: "available",
    description: "Default local model alias (llama3.2:1b).",
  },
  {
    id: "haishin-demo",
    label: "Haishin Demo (mock)",
    provider: "demo",
    status: "available",
    description: "Local mock responder — not a trained model. Pre-written examples.",
  },
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
  },
];

export function getModelById(id: string): ModelOption | undefined {
  if (id === "haishin-local") {
    return (
      MODEL_OPTIONS.find((m) => m.id === "haishin-local") ??
      MODEL_OPTIONS.find((m) => m.id === "llama3.2:1b")
    );
  }
  const found = MODEL_OPTIONS.find((m) => m.id === id);
  if (found) return found;

  // Match dynamic Ollama model IDs
  if (id && (id.includes(":") || id.startsWith("llama") || id.startsWith("richardyoung/"))) {
    return {
      id,
      label: id,
      provider: "local",
      status: "available",
      description: "Locally installed Ollama model.",
    };
  }

  return undefined;
}

export function isLocalModel(id: string): boolean {
  if (!id) return false;
  if (id === "haishin-demo") return false;
  if (id === "haishin-1" || id === "haishin-1-mini") return false;
  if (id === "unknown-model") return false;
  if (
    id === "haishin-local" ||
    id === "llama3.2:1b" ||
    id === "richardyoung/qwythos-9b-abliterated:Q4_K_M" ||
    id.includes(":")
  ) {
    return true;
  }
  return getModelById(id)?.provider === "local";
}
