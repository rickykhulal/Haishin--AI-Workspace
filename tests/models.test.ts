import test from "node:test";
import assert from "node:assert/strict";
import {
  MODEL_OPTIONS,
  DEFAULT_MODEL_ID,
  getModelById,
  isLocalModel,
} from "../src/features/conversations/models.ts";

test("DEFAULT_MODEL_ID is haishin-local", () => {
  assert.equal(DEFAULT_MODEL_ID, "haishin-local");
});

test("Both haishin-local and haishin-demo are available in v0.2", () => {
  const local = MODEL_OPTIONS.find((m) => m.id === "haishin-local");
  assert.ok(local);
  assert.equal(local.status, "available");
  assert.equal(local.provider, "local");

  const demo = MODEL_OPTIONS.find((m) => m.id === "haishin-demo");
  assert.ok(demo);
  assert.equal(demo.status, "available");
  assert.equal(demo.provider, "demo");

  // Future models must be coming_soon
  const futureModels = MODEL_OPTIONS.filter(
    (m) => m.id !== "haishin-local" && m.id !== "haishin-demo",
  );
  assert.ok(futureModels.length > 0);
  for (const model of futureModels) {
    assert.equal(model.status, "coming_soon");
  }
});

test("isLocalModel identifies local vs demo correctly", () => {
  assert.equal(isLocalModel("haishin-local"), true);
  assert.equal(isLocalModel("haishin-demo"), false);
  assert.equal(isLocalModel("unknown-model"), false);
});

test("getModelById returns correct model or undefined", () => {
  const local = getModelById("haishin-local");
  assert.equal(local?.label, "Haishin Local (Ollama)");

  const demo = getModelById("haishin-demo");
  assert.equal(demo?.label, "Haishin Demo (mock)");

  const invalid = getModelById("non-existent");
  assert.equal(invalid, undefined);
});
