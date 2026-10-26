/**
 * Local AI Backend Client for Haishin v0.2.
 * Connects to the local FastAPI backend (default: http://localhost:8000).
 * Never uses cloud APIs or external API keys.
 */

export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
}

export const BACKEND_URL = getBackendUrl();

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
  isLoaded?: boolean;
  lastCheckedAt?: string;
  lastError?: string;
}

/**
 * Check health of the local backend and Ollama runtime.
 */
export async function checkBackendHealth(
  baseUrl: string = getBackendUrl()
): Promise<BackendHealth> {
  try {
    const res = await fetch(`${baseUrl}/health`, {
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
      isLoaded: Boolean(data?.model?.is_loaded),
      lastCheckedAt: data?.runtime?.last_checked_at,
      lastError: data?.runtime?.last_error,
    };
  } catch {
    return {
      online: false,
      runtimeAvailable: false,
      modelReady: false,
      details: `Backend is unreachable at ${baseUrl}. Run: 'python -m uvicorn backend.app.main:app --port 8000'`,
      lastError: `Failed to connect to ${baseUrl}`,
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
  baseUrl: string = getBackendUrl()
): Promise<LocalChatResponse> {
  let res: Response;

  try {
    res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        conversation_id: request.conversationId,
        messages: request.messages,
        model: request.modelId === "haishin-local" ? "llama3.2:1b" : request.modelId,
      }),
      signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    // Network or connection refused
    throw new Error(
      `Cannot connect to Haishin backend at ${baseUrl}.\n\n` +
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

    throw formatHttpError(res.status, errorDetail);
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

function formatHttpError(status: number, errorDetail: string): Error {
  if (status === 503) {
    return new Error(
      `Local runtime (Ollama) is unavailable.\n\n` +
      (errorDetail || "Ensure Ollama is running locally at http://127.0.0.1:11434.")
    );
  }
  if (status === 404) {
    return new Error(
      `Model is not installed in Ollama.\n\n` +
      (errorDetail || "Download a compatible 1B model with: 'ollama pull llama3.2:1b'")
    );
  }
  if (status === 504) {
    return new Error(
      `Inference timed out.\n\n` +
      (errorDetail || "The model may still be loading into RAM/VRAM or exceeds available GPU memory.")
    );
  }
  return new Error(`Local inference error (HTTP ${status}):\n${errorDetail || "Unknown error"}`);
}

export interface StreamingChunk {
  delta: string;
  done: boolean;
  model?: string;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  accumulatedContent: string;
}

/**
 * Send streaming chat request to local FastAPI backend via Server-Sent Events (SSE).
 * Calls onChunk progressively as tokens arrive from Ollama.
 * Resolves with full LocalChatResponse upon stream completion.
 */
export async function sendLocalStreamingRequest(
  request: LocalChatRequest,
  onChunk: (chunk: StreamingChunk) => void,
  signal?: AbortSignal,
  baseUrl: string = getBackendUrl()
): Promise<LocalChatResponse> {
  let res: Response;

  try {
    res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        conversation_id: request.conversationId,
        messages: request.messages,
        model: request.modelId === "haishin-local" ? "llama3.2:1b" : request.modelId,
        stream: true,
      }),
      signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    throw new Error(
      `Cannot connect to Haishin backend at ${baseUrl}.\n\n` +
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
    throw formatHttpError(res.status, errorDetail);
  }

  if (!res.body) {
    throw new Error("Local inference returned empty stream body.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let accumulatedContent = "";
  let finalModel = "llama3.2:1b";
  let finalDurationMs: number | undefined;

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException("The user aborted a request.", "AbortError");
      }

      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const dataStr = trimmed.slice(6).trim();
        if (dataStr === "[DONE]") {
          break;
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          continue;
        }

        if (parsed.error && typeof parsed.error === "string") {
          throw new Error(parsed.error);
        }

        if (typeof parsed.model === "string") {
          finalModel = parsed.model;
        }
        if (typeof parsed.duration_ms === "number") {
          finalDurationMs = parsed.duration_ms;
        }

        const delta = typeof parsed.delta === "string" ? parsed.delta : "";
        accumulatedContent += delta;
        const isDone = Boolean(parsed.done);

        onChunk({
          delta,
          done: isDone,
          model: finalModel,
          durationMs: finalDurationMs,
          promptTokens: typeof parsed.prompt_tokens === "number" ? parsed.prompt_tokens : undefined,
          completionTokens: typeof parsed.completion_tokens === "number" ? parsed.completion_tokens : undefined,
          accumulatedContent,
        });

        if (isDone) {
          break;
        }
      }
    }
  } catch (err) {
    reader.cancel().catch(() => {});
    throw err;
  }

  return {
    message: {
      role: "assistant",
      content: accumulatedContent,
    },
    mode: "local",
    modelName: finalModel,
    durationMs: finalDurationMs,
  };
}

export interface SystemResources {
  cpu_percent: number;
  ram_total_mb: number;
  ram_used_mb: number;
  ram_percent: number;
  gpu_available: boolean;
  gpu_name?: string | null;
  vram_total_mb?: number | null;
  vram_used_mb?: number | null;
  vram_free_mb?: number | null;
  gpu_utilization_percent?: number | null;
  details: string;
}

export interface InstalledModelItem {
  id: string;
  name: string;
  provider: string;
  size_bytes?: number | null;
  parameter_size?: string | null;
  quantization?: string | null;
  family?: string | null;
  modified_at?: string | null;
  digest?: string | null;
  is_loaded: boolean;
  vram_bytes?: number | null;
  status: "available" | "coming_soon";
  is_default: boolean;
}

export interface ModelsCatalogResponse {
  models: InstalledModelItem[];
  default_model: string | null;
  runtime_available: boolean;
  last_checked_at?: string | null;
  last_error?: string | null;
}

export interface BenchmarkItemResult {
  id: string;
  category: string;
  prompt: string;
  evaluation_type: "deterministic" | "approximate";
  passed: boolean;
  score: number;
  reason: string;
  output: string;
  latency_ms: number;
  ttft_ms?: number | null;
  eval_tokens?: number | null;
  prompt_tokens?: number | null;
  tokens_per_sec?: number | null;
  error?: string | null;
}

export interface BenchmarkRunSummary {
  benchmark_version: string;
  run_id: string;
  timestamp: string;
  model_id: string;
  is_smoke: boolean;
  total_prompts: number;
  passed: number;
  failed: number;
  timed_out: number;
  errored: number;
  pass_rate_percent: number;
  total_duration_ms: number;
  avg_latency_ms: number;
  avg_ttft_ms?: number | null;
  avg_tokens_per_sec?: number | null;
  results: BenchmarkItemResult[];
  status?: string;
  message?: string;
}

export interface BenchmarkHistoryItem {
  run_id: string;
  timestamp: string;
  model_id: string;
  is_smoke: boolean;
  total_prompts: number;
  passed: number;
  failed: number;
  pass_rate_percent: number;
  avg_latency_ms: number;
  avg_ttft_ms?: number | null;
  avg_tokens_per_sec?: number | null;
  total_duration_ms: number;
}

/**
 * Fetch CPU, RAM, and GPU/VRAM hardware metrics from local backend.
 */
export async function fetchSystemResources(
  baseUrl: string = getBackendUrl()
): Promise<SystemResources | null> {
  try {
    const res = await fetch(`${baseUrl}/v1/system/resources`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch catalog of models from Ollama with loaded status.
 */
export async function fetchInstalledModels(
  baseUrl: string = getBackendUrl()
): Promise<ModelsCatalogResponse | null> {
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Request backend to refresh its model list from Ollama without restarting.
 */
export async function refreshInstalledModels(
  baseUrl: string = getBackendUrl()
): Promise<ModelsCatalogResponse | null> {
  try {
    const res = await fetch(`${baseUrl}/v1/models/refresh`, {
      method: "POST",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch the latest benchmark run summary from local backend.
 */
export async function fetchLatestBenchmark(
  baseUrl: string = getBackendUrl()
): Promise<BenchmarkRunSummary | null> {
  try {
    const res = await fetch(`${baseUrl}/v1/benchmarks/latest`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === "empty") return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch list of past benchmark runs.
 */
export async function fetchBenchmarkHistory(
  baseUrl: string = getBackendUrl()
): Promise<BenchmarkHistoryItem[]> {
  try {
    const res = await fetch(`${baseUrl}/v1/benchmarks/history`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Trigger an automated evaluation benchmark run on the backend.
 */
export async function triggerBenchmarkRun(
  smoke: boolean = false,
  baseUrl: string = getBackendUrl()
): Promise<BenchmarkRunSummary> {
  const url = `${baseUrl}/v1/benchmarks/run?smoke=${smoke ? "true" : "false"}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
    // Long timeout since benchmarks execute multiple LLM generations
    signal: AbortSignal.timeout(smoke ? 90000 : 300000),
  });

  if (!res.ok) {
    let errDetail = "";
    try {
      const errJson = await res.json();
      errDetail = errJson.detail || "";
    } catch {
      errDetail = await res.text();
    }
    throw new Error(`Benchmark failed (${res.status}): ${errDetail || res.statusText}`);
  }

  return await res.json();
}

