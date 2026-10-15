import test from "node:test";
import assert from "node:assert/strict";
import { cn, generateId, formatTime } from "../src/lib/utils.ts";

test("cn combines class names and omits falsy values", () => {
  assert.equal(cn("foo", "bar"), "foo bar");
  assert.equal(cn("foo", false, "bar", null, undefined, ""), "foo bar");
  assert.equal(cn(), "");
});

test("generateId returns valid UUID v4", () => {
  const id1 = generateId();
  const id2 = generateId();
  assert.notEqual(id1, id2);
  assert.match(
    id1,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test("formatTime formats relative timestamps properly", () => {
  const justNow = new Date().toISOString();
  assert.equal(formatTime(justNow), "Just now");

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  assert.equal(formatTime(tenMinutesAgo), "10m ago");

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  assert.equal(formatTime(twoHoursAgo), "2h ago");

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(formatTime(twoDaysAgo), "2d ago");
});
