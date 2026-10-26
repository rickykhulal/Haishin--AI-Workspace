import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  loadConversations,
  saveConversations,
  clearStoredConversations,
} from "../src/lib/storage.ts";
import type { Conversation } from "../src/features/conversations/types.ts";

// Setup mock localStorage in Node.js test environment
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

test.beforeEach(() => {
  const mockStorage = new MockLocalStorage();
  (globalThis as unknown as { window: { localStorage: MockLocalStorage } }).window = {
    localStorage: mockStorage,
  };
});

test("loadConversations returns empty array when storage is empty", () => {
  const result = loadConversations();
  assert.deepEqual(result, []);
});

test("saveConversations and loadConversations roundtrip valid data", () => {
  const testConvs: Conversation[] = [
    {
      id: "conv-1",
      title: "Test Conversation",
      createdAt: "2026-10-15T10:00:00.000Z",
      updatedAt: "2026-10-15T10:05:00.000Z",
      modelId: "haishin-local",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Hello",
          createdAt: "2026-10-15T10:00:00.000Z",
          status: "complete",
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Hi there! How can I help?",
          createdAt: "2026-10-15T10:00:01.000Z",
          status: "complete",
          mode: "local",
          durationMs: 420,
          modelName: "llama3.2:1b",
        },
      ],
    },
  ];

  const saved = saveConversations(testConvs);
  assert.equal(saved, true);

  const loaded = loadConversations();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, "conv-1");
  assert.equal(loaded[0].title, "Test Conversation");
  assert.equal(loaded[0].messages.length, 2);
  assert.equal(loaded[0].messages[1].content, "Hi there! How can I help?");
  assert.equal(loaded[0].messages[1].modelName, "llama3.2:1b");
  assert.equal(loaded[0].messages[1].durationMs, 420);
});

test("loadConversations handles corrupted JSON gracefully", () => {
  window.localStorage.setItem(STORAGE_KEY, "{ not valid json :::");
  const loaded = loadConversations();
  assert.deepEqual(loaded, []);
});

test("loadConversations handles non-array JSON payload gracefully", () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ some: "object" }));
  const loaded = loadConversations();
  assert.deepEqual(loaded, []);
});

test("saveConversations cleans pending placeholder messages", () => {
  const testConvs: Conversation[] = [
    {
      id: "conv-pending",
      title: "Active Chat",
      createdAt: "2026-10-15T10:00:00.000Z",
      updatedAt: "2026-10-15T10:05:00.000Z",
      modelId: "haishin-local",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "What is 2+2?",
          createdAt: "2026-10-15T10:00:00.000Z",
          status: "complete",
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "", // Empty pending message
          createdAt: "2026-10-15T10:00:01.000Z",
          status: "pending",
        },
      ],
    },
  ];

  saveConversations(testConvs);
  const loaded = loadConversations();
  assert.equal(loaded.length, 1);
  // Empty pending message should have been filtered out before saving
  assert.equal(loaded[0].messages.length, 1);
  assert.equal(loaded[0].messages[0].role, "user");
});

test("clearStoredConversations removes data from localStorage", () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: "test" }]));
  clearStoredConversations();
  assert.equal(window.localStorage.getItem(STORAGE_KEY), null);
});
