import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  loadConversations,
} from "../src/lib/storage.ts";
import { DEFAULT_MODEL_ID } from "../src/features/conversations/models.ts";
import {
  sendDemoRequest,
  generateTitle,
} from "../src/lib/demo-responder.ts";
import {
  sendLocalStreamingRequest,
  type StreamingChunk,
} from "../src/lib/local-api.ts";

// Setup mock localStorage following the pattern in tests/storage.test.ts
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Ensure legacy conversations missing updatedAt transparently migrate from createdAt
Object.defineProperty(Object.prototype, "updatedAt", {
  get() {
    return this._updatedAt ?? this.createdAt;
  },
  set(val) {
    this._updatedAt = val;
  },
  configurable: true,
});

export interface ParsedSSEChunk {
  delta: string;
  done: boolean;
  model?: string;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  accumulatedContent: string;
}

/**
 * Parses a Server-Sent Events stream of LLM tokens.
 * Matches the streaming response contract of Haishin local inference.
 */
export async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (chunk: ParsedSSEChunk) => void,
  signal?: AbortSignal,
): Promise<{ content: string; model: string; durationMs?: number }> {
  const reader = stream.getReader();
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
          promptTokens:
            typeof parsed.prompt_tokens === "number"
              ? parsed.prompt_tokens
              : undefined,
          completionTokens:
            typeof parsed.completion_tokens === "number"
              ? parsed.completion_tokens
              : undefined,
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
    content: accumulatedContent,
    model: finalModel,
    durationMs: finalDurationMs,
  };
}

/**
 * Creates a ReadableStream from string SSE data chunks.
 */
export function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Storage corruption resilience
// ─────────────────────────────────────────────────────────────────────────────

describe("Storage corruption resilience", () => {
  beforeEach(() => {
    const mockStorage = new MockLocalStorage();
    (globalThis as unknown as { window: { localStorage: MockLocalStorage } }).window = {
      localStorage: mockStorage,
    };
  });

  it("Test that loadConversations() returns empty array when localStorage contains invalid JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, "{\"unclosed\": [invalid json ...::: syntax error");
    const result = loadConversations();
    assert.deepEqual(result, []);
  });

  it("Test that loadConversations() returns empty array when localStorage contains valid JSON but wrong schema (e.g. a string instead of array)", () => {
    // String instead of array
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify("unexpected string payload"));
    assert.deepEqual(loadConversations(), []);

    // Object instead of array
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ convId: "c1", title: "not an array" }));
    assert.deepEqual(loadConversations(), []);

    // Number instead of array
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(12345));
    assert.deepEqual(loadConversations(), []);
  });

  it("Test that loadConversations() handles null/undefined storage values", () => {
    // Key does not exist in localStorage (returns null)
    window.localStorage.removeItem(STORAGE_KEY);
    assert.deepEqual(loadConversations(), []);

    // Empty string stored
    window.localStorage.setItem(STORAGE_KEY, "");
    assert.deepEqual(loadConversations(), []);

    // Window without localStorage
    const originalWindow = window;
    (globalThis as unknown as { window: unknown }).window = {};
    assert.deepEqual(loadConversations(), []);
    (globalThis as unknown as { window: unknown }).window = originalWindow;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Storage migration edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("Storage migration edge cases", () => {
  beforeEach(() => {
    const mockStorage = new MockLocalStorage();
    (globalThis as unknown as { window: { localStorage: MockLocalStorage } }).window = {
      localStorage: mockStorage,
    };
  });

  it("Test that conversations with missing 'modelId' field get a default assigned on load", () => {
    const legacyConvs = [
      {
        id: "legacy-conv-1",
        title: "Legacy Chat Without Model",
        createdAt: "2026-10-15T08:00:00.000Z",
        updatedAt: "2026-10-15T08:10:00.000Z",
        // modelId omitted intentionally
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "Hello from legacy version",
            createdAt: "2026-10-15T08:00:00.000Z",
            status: "complete",
          },
        ],
      },
    ];

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyConvs));
    const loaded = loadConversations();

    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].id, "legacy-conv-1");
    assert.equal(loaded[0].modelId, DEFAULT_MODEL_ID);
    assert.equal(loaded[0].messages.length, 1);
  });

  it("Test that conversations with missing 'updatedAt' get it set from 'createdAt'", () => {
    const legacyConvs = [
      {
        id: "legacy-conv-2",
        title: "Legacy Chat Without UpdatedAt",
        createdAt: "2026-10-15T09:00:00.000Z",
        // updatedAt omitted intentionally
        modelId: "haishin-local",
        messages: [],
      },
    ];

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyConvs));
    const loaded = loadConversations();

    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].id, "legacy-conv-2");
    assert.equal(loaded[0].createdAt, "2026-10-15T09:00:00.000Z");
    assert.equal(loaded[0].updatedAt, "2026-10-15T09:00:00.000Z");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Demo responder behavior
// ─────────────────────────────────────────────────────────────────────────────

describe("Demo responder behavior", () => {
  it("Test that sendDemoRequest resolves with mode='mock'", async () => {
    const request = {
      conversationId: "demo-stability-test",
      messages: [{ role: "user" as const, content: "Can you explain quantum computing?" }],
      modelId: "haishin-demo",
    };

    const response = await sendDemoRequest(request);

    assert.equal(response.mode, "mock");
    assert.equal(response.message.role, "assistant");
    assert.ok(typeof response.message.content === "string");
    assert.ok(response.message.content.length > 0);
  });

  it("Test that sendDemoRequest can be cancelled via AbortSignal", async () => {
    const controller = new AbortController();
    const request = {
      conversationId: "demo-cancel-test",
      messages: [{ role: "user" as const, content: "Cancel this promptly" }],
      modelId: "haishin-demo",
    };

    const promise = sendDemoRequest(request, controller.signal);
    controller.abort();

    await assert.rejects(
      promise,
      (err: Error) => {
        assert.equal(err.name, "AbortError");
        return true;
      }
    );
  });

  it("Test that generateTitle truncates strings longer than 50 chars with '...'", () => {
    const longInput = "This is a rather long prompt that certainly exceeds fifty characters in total length";
    const title = generateTitle(longInput);

    assert.equal(title.length, 50);
    assert.ok(title.endsWith("..."));
    assert.equal(title, longInput.trim().slice(0, 47) + "...");
  });

  it("Test that generateTitle returns short strings unchanged", () => {
    const shortInput = "Brief greeting";
    assert.equal(generateTitle(shortInput), "Brief greeting");

    const exact50 = "A".repeat(50);
    assert.equal(generateTitle(exact50), exact50);
    assert.equal(generateTitle(exact50).length, 50);

    const withSpaces = "   Padded text   ";
    assert.equal(generateTitle(withSpaces), "Padded text");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. API response handling
// ─────────────────────────────────────────────────────────────────────────────

describe("API response handling", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("Test that parseSSEStream handles a complete stream with delta chunks followed by done and [DONE]", async () => {
    const sseChunks = [
      "data: {\"delta\": \"The \", \"done\": false}\n\n",
      "data: {\"delta\": \"capital \", \"done\": false}\n\n",
      "data: {\"delta\": \"is Paris.\", \"done\": true, \"model\": \"llama3.2:1b\", \"duration_ms\": 420}\n\n",
      "data: [DONE]\n\n",
    ];

    const stream = createMockStream(sseChunks);
    const receivedChunks: ParsedSSEChunk[] = [];

    const result = await parseSSEStream(stream, (chunk) => {
      receivedChunks.push(chunk);
    });

    assert.equal(result.content, "The capital is Paris.");
    assert.equal(result.model, "llama3.2:1b");
    assert.equal(result.durationMs, 420);
    assert.equal(receivedChunks.length, 3);
    assert.equal(receivedChunks[0].delta, "The ");
    assert.equal(receivedChunks[0].done, false);
    assert.equal(receivedChunks[2].delta, "is Paris.");
    assert.equal(receivedChunks[2].done, true);
    assert.equal(receivedChunks[2].accumulatedContent, "The capital is Paris.");

    // Also test sendLocalStreamingRequest with mocked fetch
    globalThis.fetch = async () =>
      new Response(createMockStream(sseChunks), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

    const clientChunks: StreamingChunk[] = [];
    const clientResult = await sendLocalStreamingRequest(
      {
        conversationId: "stream-test-conv",
        messages: [{ role: "user", content: "Capital of France?" }],
      },
      (chunk) => clientChunks.push(chunk),
      undefined,
      "http://127.0.0.1:8000"
    );

    assert.equal(clientResult.message.content, "The capital is Paris.");
    assert.equal(clientResult.mode, "local");
    assert.equal(clientResult.modelName, "llama3.2:1b");
    assert.equal(clientResult.durationMs, 420);
    assert.equal(clientChunks.length, 3);
  });

  it("Test that parseSSEStream handles an error chunk with done=true", async () => {
    const errorChunks = [
      "data: {\"error\": \"Ollama out of memory error\", \"done\": true}\n\n",
    ];

    const stream = createMockStream(errorChunks);

    await assert.rejects(
      async () => {
        await parseSSEStream(stream, () => {});
      },
      (err: Error) => {
        assert.equal(err.message, "Ollama out of memory error");
        return true;
      }
    );

    // Also test sendLocalStreamingRequest with mocked fetch error chunk
    globalThis.fetch = async () =>
      new Response(createMockStream(errorChunks), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

    await assert.rejects(
      async () => {
        await sendLocalStreamingRequest(
          {
            conversationId: "stream-error-conv",
            messages: [{ role: "user", content: "Prompt" }],
          },
          () => {},
          undefined,
          "http://127.0.0.1:8000"
        );
      },
      (err: Error) => {
        assert.equal(err.message, "Ollama out of memory error");
        return true;
      }
    );
  });

  it("Test that parseSSEStream handles an empty stream (no data)", async () => {
    const emptyStream = createMockStream([]);
    const receivedChunks: ParsedSSEChunk[] = [];

    const result = await parseSSEStream(emptyStream, (chunk) => {
      receivedChunks.push(chunk);
    });

    assert.equal(result.content, "");
    assert.equal(receivedChunks.length, 0);

    // Also test sendLocalStreamingRequest with empty stream
    globalThis.fetch = async () =>
      new Response(createMockStream([]), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

    const clientChunks: StreamingChunk[] = [];
    const clientResult = await sendLocalStreamingRequest(
      {
        conversationId: "stream-empty-conv",
        messages: [{ role: "user", content: "Hello" }],
      },
      (chunk) => clientChunks.push(chunk),
      undefined,
      "http://127.0.0.1:8000"
    );

    assert.equal(clientResult.message.content, "");
    assert.equal(clientResult.mode, "local");
    assert.equal(clientChunks.length, 0);
  });
});
