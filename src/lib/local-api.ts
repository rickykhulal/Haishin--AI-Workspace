/**
 * Local AI Backend Client for Haishin v0.2.
 * Connects to the local FastAPI backend (default: http://localhost:8000).
 * Never uses cloud APIs or external API keys.
 */

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export interface LocalChatRequest {
  conversationId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  modelId?: string;
}

export interface LocalChatResponse {
  message: {
    role: "assistant";
    content: string;
  };
  mode: "local";
  modelName: string;
  durationMs?: number;
}

export interface BackendHealth {
  online: boolean;
  runtimeAvailable: boolean;
  modelReady: boolean;
  configuredId?: string;
  details: string;
}

/**
 * Check health of the local backend and Ollama runtime.
 */
export async function checkBackendHealth(): Promise<BackendHealth> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      // Fast timeout for health checks
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return {
        online: true,
        runtimeAvailable: false,
        modelReady: false,
        details: `Backend returned HTTP status ${res.status}.`,
      };
    }

    const data = await res.json();
    return {
      online: true,
      runtimeAvailable: Boolean(data?.runtime?.available),
      modelReady: Boolean(data?.model?.ready),
      configuredId: data?.model?.configured_id,
      details: data?.model?.details || "Backend online",
    };
  } catch {
    return {
      online: false,
      runtimeAvailable: false,
      modelReady: false,
      details: `Backend is unreachable at ${BACKEND_URL}. Run: 'python -m uvicorn backend.app.main:app --port 8000'`,
    };
  }
}

/**
 * Send chat request to local FastAPI backend.
 * Provides granular error diagnostics for offline backend, offline Ollama, or missing model.
 */
export async function sendLocalChatRequest(
  request: LocalChatRequest,
  signal?: AbortSignal,
): Promise<LocalChatResponse> {
  let res: Response;

  try {
    res = await fetch(`${BACKEND_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        conversation_id: request.conversationId,
        messages: request.messages,
        model: request.modelId === "haishin-local" ? undefined : request.modelId,
      }),
      signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    // Network or connection refused
    throw new Error(
      `Cannot connect to Haishin backend at ${BACKEND_URL}.\n\n` +
      `Ensure the Python backend is running:\n` +
      `python -m uvicorn backend.app.main:app --port 8000`
    );
  }

  if (!res.ok) {
    let errorDetail = "";
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || "";
    } catch {
      errorDetail = await res.text();
    }

    if (res.status === 503) {
      throw new Error(
        `Local runtime (Ollama) is unavailable.\n\n` +
        (errorDetail || "Ensure Ollama is running locally at http://127.0.0.1:11434.")
      );
    }
    if (res.status === 404) {
      throw new Error(
        `Model is not installed in Ollama.\n\n` +
        (errorDetail || "Download a compatible 1B model with: 'ollama pull llama3.2:1b'")
      );
    }
    if (res.status === 504) {
      throw new Error(
        `Inference timed out.\n\n` +
        (errorDetail || "The model may still be loading into RAM/VRAM or exceeds available GPU memory.")
      );
    }
    throw new Error(
      `Local inference error (HTTP ${res.status}):\n${errorDetail || res.statusText}`
    );
  }

  const data = await res.json();

  return {
    message: {
      role: "assistant",
      content: data.message.content,
    },
    mode: "local",
    modelName: data.model,
    durationMs: data.inference_duration_ms,
  };
}
