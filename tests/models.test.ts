import test from "node:test";
import assert from "node:assert/strict";
import {
  MODEL_OPTIONS,
  DEFAULT_MODEL_ID,
  getModelById,
} from "../src/features/conversations/models.ts";

test("DEFAULT_MODEL_ID is haishin-demo", () => {
  assert.equal(DEFAULT_MODEL_ID, "haishin-demo");
});

test("Only haishin-demo is available in v0.1", () => {
  const demo = MODEL_OPTIONS.find((m) => m.id === "haishin-demo");
  assert.ok(demo);
  assert.equal(demo.status, "available");
  assert.equal(demo.provider, "demo");

  // All other models must be coming_soon
  const otherModels = MODEL_OPTIONS.filter((m) => m.id !== "haishin-demo");
  assert.ok(otherModels.length > 0);
  for (const model of otherModels) {
    assert.equal(model.status, "coming_soon");
  }
});

test("getModelById returns correct model or undefined", () => {
  const model = getModelById("haishin-demo");
  assert.equal(model?.label, "Haishin Demo (mock)");

  const invalid = getModelById("non-existent");
  assert.equal(invalid, undefined);
});
