import test from "node:test";
import assert from "node:assert/strict";
import { BACKEND_URL, checkBackendHealth } from "../src/lib/local-api.ts";

test("BACKEND_URL defaults to localhost:8000", () => {
  assert.ok(BACKEND_URL.includes("8000"));
});

test("checkBackendHealth handles offline server gracefully", async () => {
  // Point to a port that is guaranteed closed to test graceful offline failure
  const originalUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  process.env.NEXT_PUBLIC_BACKEND_URL = "http://127.0.0.1:59999";

  const result = await checkBackendHealth();
  assert.equal(result.online, false);
  assert.equal(result.runtimeAvailable, false);
  assert.equal(result.modelReady, false);
  assert.ok(result.details.includes("unreachable") || result.details.includes("59999"));

  if (originalUrl) {
    process.env.NEXT_PUBLIC_BACKEND_URL = originalUrl;
  } else {
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
  }
});
