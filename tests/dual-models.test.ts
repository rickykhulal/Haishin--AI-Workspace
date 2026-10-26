import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MODEL_ID,
  SECONDARY_MODEL_ID,
  isLocalModel,
  getModelById,
} from "../src/features/conversations/models.ts";
import {
  sendLocalChatRequest,
  sendLocalStreamingRequest,
} from "../src/lib/local-api.ts";
import { sanitizeConversation } from "../src/lib/storage.ts";

test("Dual models: default remains llama3.2:1b and secondary is 9b model", () => {
  assert.equal(DEFAULT_MODEL_ID, "llama3.2:1b");
  assert.equal(SECONDARY_MODEL_ID, "richardyoung/qwythos-9b-abliterated:Q4_K_M");
});

test("Dual models: both models identified as local offline models", () => {
  assert.equal(isLocalModel("llama3.2:1b"), true);
  assert.equal(isLocalModel("richardyoung/qwythos-9b-abliterated:Q4_K_M"), true);
  assert.equal(isLocalModel("haishin-local"), true);
  assert.equal(isLocalModel("haishin-demo"), false);
  assert.equal(isLocalModel("unknown-model"), false);
});

test("Dual models: getModelById resolves both models", () => {
  const small = getModelById("llama3.2:1b");
  assert.ok(small);
  assert.equal(small?.id, "llama3.2:1b");
  assert.equal(small?.provider, "local");

  const large = getModelById("richardyoung/qwythos-9b-abliterated:Q4_K_M");
  assert.ok(large);
  assert.equal(large?.id, "richardyoung/qwythos-9b-abliterated:Q4_K_M");
  assert.equal(large?.provider, "local");
});

test("Dual models: sanitizeConversation preserves modelId for both models", () => {
  const convSmall = sanitizeConversation({
    id: "conv-1",
    title: "Small Chat",
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
    messages: [],
    modelId: "llama3.2:1b",
  });
  assert.ok(convSmall);
  assert.equal(convSmall.modelId, "llama3.2:1b");

  const convLarge = sanitizeConversation({
    id: "conv-2",
    title: "Large Chat",
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
    messages: [],
    modelId: "richardyoung/qwythos-9b-abliterated:Q4_K_M",
  });
  assert.ok(convLarge);
  assert.equal(convLarge.modelId, "richardyoung/qwythos-9b-abliterated:Q4_K_M");
});

test("Dual models: sendLocalChatRequest sends exact model ID in payload", async () => {
  const captured: { body: { model?: string } | null } = { body: null };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof init?.body === "string") {
      captured.body = JSON.parse(init.body) as { model?: string };
    }
    return new Response(
      JSON.stringify({
        id: "mock-id",
        model: captured.body?.model,
        mode: "local",
        message: { role: "assistant", content: "OK" },
        inference_duration_ms: 100,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    // 1. Small model
    await sendLocalChatRequest({
      conversationId: "test-c1",
      messages: [{ role: "user", content: "hi" }],
      modelId: "llama3.2:1b",
    });
    assert.equal(captured.body?.model, "llama3.2:1b");

    // 2. Large model
    await sendLocalChatRequest({
      conversationId: "test-c2",
      messages: [{ role: "user", content: "hi" }],
      modelId: "richardyoung/qwythos-9b-abliterated:Q4_K_M",
    });
    assert.equal(captured.body?.model, "richardyoung/qwythos-9b-abliterated:Q4_K_M");

    // 3. Legacy haishin-local maps to llama3.2:1b
    await sendLocalChatRequest({
      conversationId: "test-c3",
      messages: [{ role: "user", content: "hi" }],
      modelId: "haishin-local",
    });
    assert.equal(captured.body?.model, "llama3.2:1b");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Dual models: sendLocalStreamingRequest sends exact model ID in streaming payload", async () => {
  const captured: { body: { model?: string; stream?: boolean } | null } = { body: null };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof init?.body === "string") {
      captured.body = JSON.parse(init.body) as { model?: string; stream?: boolean };
    }
    const stream = new ReadableStream({
      start(controller) {
        const chunk = JSON.stringify({
          delta: "hello",
          done: true,
          model: captured.body?.model,
          duration_ms: 250,
        });
        controller.enqueue(new TextEncoder().encode(`data: ${chunk}\n\ndata: [DONE]\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };

  try {
    const res = await sendLocalStreamingRequest(
      {
        conversationId: "test-stream",
        messages: [{ role: "user", content: "hi" }],
        modelId: "richardyoung/qwythos-9b-abliterated:Q4_K_M",
      },
      () => {}
    );
    assert.equal(captured.body?.model, "richardyoung/qwythos-9b-abliterated:Q4_K_M");
    assert.equal(captured.body?.stream, true);
    assert.equal(res.modelName, "richardyoung/qwythos-9b-abliterated:Q4_K_M");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
