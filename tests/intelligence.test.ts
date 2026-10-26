import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchSystemResources,
  fetchInstalledModels,
  refreshInstalledModels,
  fetchLatestBenchmark,
  fetchBenchmarkHistory,
  triggerBenchmarkRun,
  type SystemResources,
  type BenchmarkRunSummary,
} from "../src/lib/local-api.ts";

const OFFLINE_URL = "http://127.0.0.1:59999";

test("fetchSystemResources returns null when backend is offline", async () => {
  const result = await fetchSystemResources(OFFLINE_URL);
  assert.equal(result, null);
});

test("fetchInstalledModels returns null when backend is offline", async () => {
  const result = await fetchInstalledModels(OFFLINE_URL);
  assert.equal(result, null);
});

test("refreshInstalledModels returns null when backend is offline", async () => {
  const result = await refreshInstalledModels(OFFLINE_URL);
  assert.equal(result, null);
});

test("fetchLatestBenchmark returns null when backend is offline or empty", async () => {
  const result = await fetchLatestBenchmark(OFFLINE_URL);
  assert.equal(result, null);
});

test("fetchBenchmarkHistory returns empty array when backend is offline", async () => {
  const result = await fetchBenchmarkHistory(OFFLINE_URL);
  assert.deepEqual(result, []);
});

test("triggerBenchmarkRun rejects with descriptive error when backend is offline", async () => {
  await assert.rejects(
    async () => {
      await triggerBenchmarkRun(true, OFFLINE_URL);
    },
    (err: Error) => {
      assert.ok(err.message.includes("fetch failed") || err.message.includes("Benchmark failed"));
      return true;
    }
  );
});

test("SystemResources structure adheres to required schema types", () => {
  const mockResource: SystemResources = {
    cpu_percent: 18.5,
    ram_total_mb: 16220.0,
    ram_used_mb: 8110.0,
    ram_percent: 50.0,
    gpu_available: true,
    gpu_name: "NVIDIA GeForce GTX 1650",
    vram_total_mb: 4096.0,
    vram_used_mb: 512.0,
    vram_free_mb: 3584.0,
    gpu_utilization_percent: 12.0,
    details: "NVIDIA GeForce GTX 1650 (512/4096 MiB VRAM used)",
  };

  assert.equal(mockResource.gpu_available, true);
  assert.equal(mockResource.vram_total_mb, 4096.0);
  assert.equal(mockResource.ram_percent, 50.0);
});

test("BenchmarkRunSummary parses and validates result counts", () => {
  const mockSummary: BenchmarkRunSummary = {
    benchmark_version: "1.0",
    run_id: "bench_smoke_test_123",
    timestamp: "2026-10-16T08:00:00Z",
    model_id: "llama3.2:1b",
    is_smoke: true,
    total_prompts: 3,
    passed: 3,
    failed: 0,
    timed_out: 0,
    errored: 0,
    pass_rate_percent: 100.0,
    total_duration_ms: 2500,
    avg_latency_ms: 833.3,
    avg_tokens_per_sec: 42.5,
    results: [
      {
        id: "fact-capital-nepal",
        category: "factual",
        prompt: "Capital of Nepal?",
        evaluation_type: "deterministic",
        passed: true,
        score: 1.0,
        reason: "Matched Kathmandu",
        output: "Kathmandu",
        latency_ms: 810,
        tokens_per_sec: 45.0,
      },
    ],
  };

  assert.equal(mockSummary.pass_rate_percent, 100.0);
  assert.equal(mockSummary.results.length, 1);
  assert.equal(mockSummary.results[0].passed, true);
});

test("BenchmarkRunSummary supports optional avg_ttft_ms and item ttft_ms", () => {
  const mockSummaryWithTtft: BenchmarkRunSummary = {
    benchmark_version: "1.0",
    run_id: "bench_v07_ttft",
    timestamp: "2026-10-19T00:00:00Z",
    model_id: "llama3.2:1b",
    is_smoke: true,
    total_prompts: 1,
    passed: 1,
    failed: 0,
    timed_out: 0,
    errored: 0,
    pass_rate_percent: 100.0,
    total_duration_ms: 1200,
    avg_latency_ms: 600.0,
    avg_ttft_ms: 95.0,
    avg_tokens_per_sec: 48.0,
    results: [
      {
        id: "reasoning-test",
        category: "reasoning",
        prompt: "2+2?",
        evaluation_type: "deterministic",
        passed: true,
        score: 1.0,
        reason: "Matched 4",
        output: "4",
        latency_ms: 600,
        ttft_ms: 95,
        tokens_per_sec: 48.0,
      },
    ],
  };

  assert.equal(mockSummaryWithTtft.avg_ttft_ms, 95.0);
  assert.equal(mockSummaryWithTtft.results[0].ttft_ms, 95);
});

