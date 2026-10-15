import type { ModelOption } from "./types";

/**
 * Model registry for the Haishin workspace.
 * v0.2 introduces real local offline inference via Ollama + FastAPI backend,
 * while preserving the demo mock mode as an explicitly labeled fallback.
 */
export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "haishin-local",
    label: "Haishin Local (Ollama)",
    provider: "local",
    status: "available",
    description:
      "Real offline inference executed locally on your hardware via local backend and Ollama.",
  },
  {
    id: "haishin-demo",
    label: "Haishin Demo (mock)",
    provider: "demo",
    status: "available",
    description:
      "Local mock responder — not a trained model. Responses are pre-written examples.",
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

export const DEFAULT_MODEL_ID = "haishin-local";

export function getModelById(id: string): ModelOption | undefined {
  return MODEL_OPTIONS.find((m) => m.id === id);
}

export function isLocalModel(id: string): boolean {
  return id === "haishin-local" || getModelById(id)?.provider === "local";
}
