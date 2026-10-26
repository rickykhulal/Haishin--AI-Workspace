import test from "node:test";
import assert from "node:assert/strict";
import {
  MODEL_OPTIONS,
  DEFAULT_MODEL_ID,
  SECONDARY_MODEL_ID,
  getModelById,
  isLocalModel,
} from "../src/features/conversations/models.ts";

test("DEFAULT_MODEL_ID is llama3.2:1b", () => {
  assert.equal(DEFAULT_MODEL_ID, "llama3.2:1b");
  assert.equal(SECONDARY_MODEL_ID, "richardyoung/qwythos-9b-abliterated:Q4_K_M");
});

test("Both local models and haishin-demo are available", () => {
  const small = MODEL_OPTIONS.find((m) => m.id === "llama3.2:1b");
  assert.ok(small);
  assert.equal(small.status, "available");
  assert.equal(small.provider, "local");

  const large = MODEL_OPTIONS.find(
    (m) => m.id === "richardyoung/qwythos-9b-abliterated:Q4_K_M"
  );
  assert.ok(large);
  assert.equal(large.status, "available");
  assert.equal(large.provider, "local");

  const demo = MODEL_OPTIONS.find((m) => m.id === "haishin-demo");
  assert.ok(demo);
  assert.equal(demo.status, "available");
  assert.equal(demo.provider, "demo");

  // Future models must be coming_soon
  const futureModels = MODEL_OPTIONS.filter(
    (m) =>
      m.id !== "llama3.2:1b" &&
      m.id !== "richardyoung/qwythos-9b-abliterated:Q4_K_M" &&
      m.id !== "haishin-local" &&
      m.id !== "haishin-demo"
  );
  assert.ok(futureModels.length > 0);
  for (const model of futureModels) {
    assert.equal(model.status, "coming_soon");
  }
});

test("isLocalModel identifies local vs demo correctly", () => {
  assert.equal(isLocalModel("llama3.2:1b"), true);
  assert.equal(isLocalModel("richardyoung/qwythos-9b-abliterated:Q4_K_M"), true);
  assert.equal(isLocalModel("haishin-local"), true);
  assert.equal(isLocalModel("haishin-demo"), false);
  assert.equal(isLocalModel("unknown-model"), false);
});

test("getModelById returns correct model or undefined", () => {
  const small = getModelById("llama3.2:1b");
  assert.ok(small);
  assert.equal(small?.id, "llama3.2:1b");

  const large = getModelById("richardyoung/qwythos-9b-abliterated:Q4_K_M");
  assert.ok(large);
  assert.equal(large?.id, "richardyoung/qwythos-9b-abliterated:Q4_K_M");

  const local = getModelById("haishin-local");
  assert.ok(local);

  const demo = getModelById("haishin-demo");
  assert.equal(demo?.label, "Haishin Demo (mock)");

  const invalid = getModelById("non-existent");
  assert.equal(invalid, undefined);
});
