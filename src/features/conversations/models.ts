import type { ModelOption } from "./types";

/**
 * Model registry for the Haishin workspace.
 * Only the demo model is available in v0.1.
 * Future models are listed but disabled.
 */
export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "haishin-demo",
    label: "Haishin Demo (mock)",
    provider: "demo",
    status: "available",
    description:
      "Local demo responder — not a trained model. Responses are pre-written examples.",
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

export const DEFAULT_MODEL_ID = "haishin-demo";

export function getModelById(id: string): ModelOption | undefined {
  return MODEL_OPTIONS.find((m) => m.id === id);
}
