import test from "node:test";
import assert from "node:assert/strict";
import {
  generateTitle,
  sendDemoRequest,
} from "../src/lib/demo-responder.ts";

test("generateTitle trims and truncates to 50 characters", () => {
  assert.equal(generateTitle("Short message"), "Short message");
  assert.equal(
    generateTitle("   Leading and trailing spaces   "),
    "Leading and trailing spaces",
  );
  const longMsg =
    "This is a very long message that should definitely exceed fifty characters in total length";
  const title = generateTitle(longMsg);
  assert.equal(title.length, 50);
  assert.ok(title.endsWith("..."));
});

test("sendDemoRequest returns mock response mode and assistant role", async () => {
  const req = {
    conversationId: "test-conv",
    messages: [{ role: "user" as const, content: "Hello" }],
    modelId: "haishin-demo",
  };

  const res = await sendDemoRequest(req);
  assert.equal(res.mode, "mock");
  assert.equal(res.message.role, "assistant");
  assert.ok(res.message.content.length > 0);
});

test("sendDemoRequest aborts when signal is triggered", async () => {
  const controller = new AbortController();
  const req = {
    conversationId: "test-conv",
    messages: [{ role: "user" as const, content: "Hello" }],
    modelId: "haishin-demo",
  };

  const promise = sendDemoRequest(req, controller.signal);
  controller.abort();

  await assert.rejects(promise, {
    name: "AbortError",
  });
});
