"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Activity,
  Cpu,
  Zap,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Server,
  Layers,
} from "lucide-react";
import {
  fetchSystemResources,
  fetchInstalledModels,
  refreshInstalledModels,
  fetchLatestBenchmark,
  fetchBenchmarkHistory,
  triggerBenchmarkRun,
  type SystemResources,
  type ModelsCatalogResponse,
  type BenchmarkRunSummary,
  type BenchmarkHistoryItem,
} from "@/lib/local-api";

interface PerformanceDashboardProps {
  open: boolean;
  onClose: () => void;
}

export function PerformanceDashboard({ open, onClose }: PerformanceDashboardProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "models" | "benchmarks">("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  const [resources, setResources] = useState<SystemResources | null>(null);
  const [catalog, setCatalog] = useState<ModelsCatalogResponse | null>(null);
  const [latestBenchmark, setLatestBenchmark] = useState<BenchmarkRunSummary | null>(null);
  const [history, setHistory] = useState<BenchmarkHistoryItem[]>([]);

  const handleRefreshModels = async () => {
    setRefreshing(true);
    try {
      const updated = await refreshInstalledModels();
      if (updated) setCatalog(updated);
      const res = await fetchSystemResources();
      if (res) setResources(res);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRunBenchmark = async (smoke: boolean) => {
    setBenchmarking(true);
    setBenchmarkError(null);
    try {
      const result = await triggerBenchmarkRun(smoke);
      setLatestBenchmark(result);
      const hist = await fetchBenchmarkHistory();
      setHistory(hist);
      // Auto-switch to benchmark tab on completion
      setActiveTab("benchmarks");
    } catch (err: unknown) {
      setBenchmarkError(err instanceof Error ? err.message : "Benchmark failed.");
    } finally {
      setBenchmarking(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    let active = true;
    Promise.all([
      fetchSystemResources(),
      fetchInstalledModels(),
      fetchLatestBenchmark(),
      fetchBenchmarkHistory(),
    ]).then(([resData, catData, benchData, histData]) => {
      if (!active) return;
      setResources(resData);
      setCatalog(catData);
      setLatestBenchmark(benchData);
      setHistory(histData);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-title"
    >
      <div
        className="mx-4 flex h-[90vh] max-h-[800px] w-full max-w-4xl flex-col rounded-2xl border border-[#273040] bg-[#0E121A] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#273040]/60 px-6 py-4 bg-[#10141C]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#8AB4F8]/10 text-[#8AB4F8] ring-1 ring-[#8AB4F8]/30">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 id="dashboard-title" className="text-base font-semibold text-[#F3F5F9]">
                Model Intelligence & Evaluation
              </h2>
              <p className="text-xs text-[#9AA6B8]">
                Hardware telemetry, Ollama model memory, and repeatable local benchmarks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshModels}
              disabled={refreshing || benchmarking}
              className="flex items-center gap-1.5 rounded-lg border border-[#273040] bg-[#151A23] px-3 py-1.5 text-xs text-[#9AA6B8] hover:text-[#F3F5F9] hover:bg-[#1E2533] disabled:opacity-50 transition-colors"
              title="Refresh models and hardware telemetry"
            >
              <RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              ref={closeRef}
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#9AA6B8] hover:bg-[#151A23] hover:text-[#F3F5F9] transition-colors"
              aria-label="Close dashboard"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[#273040]/50 bg-[#121721] px-6 gap-6 text-sm">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 font-medium transition-colors border-b-2 ${
              activeTab === "overview"
                ? "border-[#8AB4F8] text-[#8AB4F8]"
                : "border-transparent text-[#9AA6B8] hover:text-[#F3F5F9]"
            }`}
          >
            System & Status
          </button>
          <button
            onClick={() => setActiveTab("models")}
            className={`py-3 font-medium transition-colors border-b-2 ${
              activeTab === "models"
                ? "border-[#8AB4F8] text-[#8AB4F8]"
                : "border-transparent text-[#9AA6B8] hover:text-[#F3F5F9]"
            }`}
          >
            Installed Models ({catalog?.models?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("benchmarks")}
            className={`py-3 font-medium transition-colors border-b-2 ${
              activeTab === "benchmarks"
                ? "border-[#8AB4F8] text-[#8AB4F8]"
                : "border-transparent text-[#9AA6B8] hover:text-[#F3F5F9]"
            }`}
          >
            Benchmarks & Results
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !refreshing ? (
            <div className="flex h-64 items-center justify-center text-sm text-[#9AA6B8]">
              <RotateCw className="h-5 w-5 animate-spin mr-2 text-[#8AB4F8]" />
              Querying local model runtime and system metrics…
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Runtime Status Pill Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-[#273040]/60 bg-[#151A23] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#9AA6B8]">Ollama Service</span>
                        <Server className="h-4 w-4 text-[#8AB4F8]" />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            catalog?.runtime_available ? "bg-emerald-400" : "bg-red-500"
                          }`}
                        />
                        <span className="text-sm font-semibold text-[#F3F5F9]">
                          {catalog?.runtime_available ? "Online (127.0.0.1:11434)" : "Unreachable"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#9AA6B8]/70">
                        {catalog?.runtime_available
                          ? `${catalog.models.length} model${catalog.models.length === 1 ? "" : "s"} installed`
                          : (catalog?.last_error || "Start Ollama desktop or service")}
                      </p>
                      {catalog?.last_checked_at && (
                        <p className="mt-1 text-[10px] text-[#9AA6B8]/50">
                          Checked: {new Date(catalog.last_checked_at).toLocaleTimeString()}
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-[#273040]/60 bg-[#151A23] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#9AA6B8]">Configured Model</span>
                        <Zap className="h-4 w-4 text-[#8AB4F8]" />
                      </div>
                      <div className="mt-2">
                        <span className="font-mono text-sm font-semibold text-[#8AB4F8]">
                          {catalog?.default_model || "None"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#9AA6B8]/70">
                        {catalog?.models.some((m) => m.id === catalog.default_model)
                          ? "Available for local inference"
                          : "Not found in local Ollama"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#273040]/60 bg-[#151A23] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#9AA6B8]">Memory Loaded</span>
                        <Layers className="h-4 w-4 text-[#8AB4F8]" />
                      </div>
                      <div className="mt-2">
                        {catalog?.models.some((m) => m.is_loaded) ? (
                          <span className="text-sm font-semibold text-emerald-400">
                            {catalog.models.find((m) => m.is_loaded)?.id}
                          </span>
                        ) : (
                          <span className="text-sm text-[#9AA6B8]">No model currently in RAM</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#9AA6B8]/70">
                        Models load on-demand during inference
                      </p>
                    </div>
                  </div>

                  {/* Hardware Telemetry Card */}
                  <div className="rounded-xl border border-[#273040]/60 bg-[#151A23] p-5">
                    <h3 className="text-sm font-semibold text-[#F3F5F9] mb-4 flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-[#8AB4F8]" />
                      Hardware Resource Telemetry
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* CPU & RAM */}
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs text-[#9AA6B8] mb-1">
                            <span>System CPU Utilization</span>
                            <span className="font-mono">{resources?.cpu_percent ?? 0}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-[#273040]/50 overflow-hidden">
                            <div
                              className="h-full bg-[#8AB4F8] transition-all duration-300"
                              style={{ width: `${Math.min(resources?.cpu_percent ?? 0, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs text-[#9AA6B8] mb-1">
                            <span>System RAM Usage</span>
                            <span className="font-mono">
                              {resources
                                ? `${(resources.ram_used_mb / 1024).toFixed(1)} / ${(resources.ram_total_mb / 1024).toFixed(1)} GB (${resources.ram_percent}%)`
                                : "N/A"}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-[#273040]/50 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${Math.min(resources?.ram_percent ?? 0, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* GPU & VRAM */}
                      <div className="rounded-lg border border-[#273040]/40 bg-[#0E121A] p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[#F3F5F9]">
                            {resources?.gpu_available ? resources.gpu_name : "NVIDIA GPU"}
                          </span>
                          {resources?.gpu_available ? (
                            <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-400 font-medium">
                              Active
                            </span>
                          ) : (
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                              Unavailable
                            </span>
                          )}
                        </div>

                        {resources?.gpu_available && resources.vram_total_mb ? (
                          <div className="space-y-2 mt-3">
                            <div className="flex justify-between text-xs text-[#9AA6B8]">
                              <span>VRAM Allocation</span>
                              <span className="font-mono">
                                {Math.round(resources.vram_used_mb ?? 0)} /{" "}
                                {Math.round(resources.vram_total_mb)} MiB
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-[#273040]/50 overflow-hidden">
                              <div
                                className="h-full bg-purple-500 transition-all duration-300"
                                style={{
                                  width: `${Math.min(
                                    ((resources.vram_used_mb ?? 0) / resources.vram_total_mb) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                            <p className="text-[11px] text-[#9AA6B8]/70 mt-1">
                              GPU Core Utilization: {resources.gpu_utilization_percent ?? 0}%
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-[#9AA6B8]/80 mt-2">
                            {resources?.details || "GPU metrics could not be verified via nvidia-smi."}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INSTALLED MODELS */}
              {activeTab === "models" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#9AA6B8]">
                      Models installed in the local Ollama store. Status reflects real-time memory loading.
                    </p>
                  </div>

                  {catalog?.models && catalog.models.length > 0 ? (
                    <div className="divide-y divide-[#273040]/50 rounded-xl border border-[#273040]/60 bg-[#151A23] overflow-hidden">
                      {catalog.models.map((m) => {
                        const sizeMb = m.size_bytes ? (m.size_bytes / (1024 * 1024)).toFixed(0) : "N/A";
                        return (
                          <div
                            key={m.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-[#1A202C]/40 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-[#F3F5F9]">
                                  {m.id}
                                </span>
                                {m.is_default && (
                                  <span className="rounded bg-[#8AB4F8]/15 border border-[#8AB4F8]/30 px-1.5 py-0.5 text-[10px] font-medium text-[#8AB4F8]">
                                    Default
                                  </span>
                                )}
                                {m.is_loaded ? (
                                  <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                                    Loaded in Memory
                                  </span>
                                ) : (
                                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                                    On Disk
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-[#9AA6B8]">
                                <span>Size: {sizeMb} MB</span>
                                {m.parameter_size && <span>Params: {m.parameter_size}</span>}
                                {m.quantization && <span>Quant: {m.quantization}</span>}
                                {m.family && <span>Family: {m.family}</span>}
                              </div>

                              {/* Historical Benchmark Cross-Reference */}
                              {(() => {
                                const modelBench = history.find(
                                  (h) => h.model_id === m.id || h.model_id === m.name
                                );
                                if (modelBench) {
                                  return (
                                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#9AA6B8]">
                                      <div className="flex items-center gap-1.5 rounded bg-[#0E121A] border border-[#273040]/50 px-2 py-0.5">
                                        <span className="text-[#8AB4F8] font-medium">Last Benchmark:</span>
                                        <span className="text-[#F3F5F9] font-semibold">{modelBench.pass_rate_percent}% pass</span>
                                        <span>•</span>
                                        <span>{Math.round(modelBench.avg_latency_ms)}ms</span>
                                        {modelBench.avg_ttft_ms !== null && modelBench.avg_ttft_ms !== undefined && (
                                          <>
                                            <span>•</span>
                                            <span>{Math.round(modelBench.avg_ttft_ms)}ms TTFT</span>
                                          </>
                                        )}
                                        {modelBench.avg_tokens_per_sec && (
                                          <>
                                            <span>•</span>
                                            <span className="text-emerald-400 font-mono">
                                              {modelBench.avg_tokens_per_sec.toFixed(1)} tok/s
                                            </span>
                                          </>
                                        )}
                                        <span>•</span>
                                        <span className="text-[#9AA6B8]/70">
                                          {new Date(modelBench.timestamp).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="pt-1 text-[11px] text-[#9AA6B8]/50">
                                    No benchmark recorded yet
                                  </div>
                                );
                              })()}
                            </div>

                            <div className="flex flex-col sm:items-end gap-1 shrink-0">
                              {m.is_loaded && m.vram_bytes !== null && m.vram_bytes !== undefined && (
                                <span className="text-[11px] text-[#8AB4F8] font-mono">
                                  VRAM: {(m.vram_bytes / (1024 * 1024)).toFixed(0)} MiB
                                </span>
                              )}
                              {(m.size_bytes && m.size_bytes > 3.8 * 1024 * 1024 * 1024) || m.id.includes("9b") ? (
                                <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] text-amber-400">
                                  May offload to CPU (4GB VRAM limit)
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#273040]/50 bg-[#151A23] p-8 text-center text-sm text-[#9AA6B8]">
                      No models found in Ollama runtime. Run: <code>ollama pull llama3.2:1b</code>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: BENCHMARKS */}
              {activeTab === "benchmarks" && (
                <div className="space-y-6">
                  {/* Action Banner */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-[#273040]/60 bg-[#151A23] p-4">
                    <div>
                      <h4 className="text-sm font-semibold text-[#F3F5F9]">Run Local Evaluation</h4>
                      <p className="text-xs text-[#9AA6B8] mt-0.5">
                        Deterministic checks and labeled heuristics across 6 AI capability categories.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRunBenchmark(true)}
                        disabled={benchmarking}
                        className="flex items-center gap-1.5 rounded-lg border border-[#8AB4F8]/40 bg-[#8AB4F8]/15 px-3 py-1.5 text-xs font-medium text-[#8AB4F8] hover:bg-[#8AB4F8]/25 disabled:opacity-50 transition-colors"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Smoke Test (3 prompts)
                      </button>
                      <button
                        onClick={() => handleRunBenchmark(false)}
                        disabled={benchmarking}
                        className="flex items-center gap-1.5 rounded-lg bg-[#8AB4F8] px-3 py-1.5 text-xs font-semibold text-[#0B0D12] hover:bg-[#a0c4fa] disabled:opacity-50 transition-colors"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Full Benchmark (18 prompts)
                      </button>
                    </div>
                  </div>

                  {benchmarking && (
                    <div className="flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 text-xs text-blue-200">
                      <RotateCw className="h-4 w-4 animate-spin text-[#8AB4F8]" />
                      <span>
                        Executing benchmarks sequentially against local Ollama model… Please wait.
                      </span>
                    </div>
                  )}

                  {benchmarkError && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-800/40 bg-red-950/30 p-4 text-xs text-red-200">
                      <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                      <span>{benchmarkError}</span>
                    </div>
                  )}

                  {/* Latest Results Card */}
                  {latestBenchmark ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-[#273040]/60 bg-[#151A23] p-3 text-center">
                          <span className="text-[11px] text-[#9AA6B8]">Pass Rate</span>
                          <p className="mt-1 text-lg font-bold text-[#8AB4F8]">
                            {latestBenchmark.pass_rate_percent}%
                          </p>
                          <span className="text-[10px] text-[#9AA6B8]/70">
                            {latestBenchmark.passed}/{latestBenchmark.total_prompts} passed
                          </span>
                        </div>
                        <div className="rounded-xl border border-[#273040]/60 bg-[#151A23] p-3 text-center">
                          <span className="text-[11px] text-[#9AA6B8]">Avg Latency</span>
                          <p className="mt-1 text-lg font-bold text-[#F3F5F9]">
                            {Math.round(latestBenchmark.avg_latency_ms)} ms
                          </p>
                          <span className="text-[10px] text-[#9AA6B8]/70">
                            {latestBenchmark.avg_ttft_ms !== null && latestBenchmark.avg_ttft_ms !== undefined
                              ? `TTFT: ${Math.round(latestBenchmark.avg_ttft_ms)} ms`
                              : "per evaluation prompt"}
                          </span>
                        </div>
                        <div className="rounded-xl border border-[#273040]/60 bg-[#151A23] p-3 text-center">
                          <span className="text-[11px] text-[#9AA6B8]">Throughput</span>
                          <p className="mt-1 text-lg font-bold text-emerald-400">
                            {latestBenchmark.avg_tokens_per_sec
                              ? `${latestBenchmark.avg_tokens_per_sec.toFixed(1)} tok/s`
                              : "N/A"}
                          </p>
                          <span className="text-[10px] text-[#9AA6B8]/70">measured generation</span>
                        </div>
                        <div className="rounded-xl border border-[#273040]/60 bg-[#151A23] p-3 text-center">
                          <span className="text-[11px] text-[#9AA6B8]">Total Duration</span>
                          <p className="mt-1 text-lg font-bold text-[#F3F5F9]">
                            {(latestBenchmark.total_duration_ms / 1000).toFixed(1)} s
                          </p>
                          <span className="text-[10px] text-[#9AA6B8]/70">
                            Model: {latestBenchmark.model_id}
                          </span>
                        </div>
                      </div>

                      {/* Prompt Results Table */}
                      <div className="rounded-xl border border-[#273040]/60 bg-[#151A23] overflow-hidden">
                        <div className="border-b border-[#273040]/60 px-4 py-2.5 bg-[#10141C] flex justify-between items-center text-xs text-[#9AA6B8]">
                          <span className="font-semibold text-[#F3F5F9]">
                            Run: {latestBenchmark.run_id} ({new Date(latestBenchmark.timestamp).toLocaleTimeString()})
                          </span>
                          <span>{latestBenchmark.is_smoke ? "Smoke Run" : "Full Suite"}</span>
                        </div>
                        <div className="divide-y divide-[#273040]/40 max-h-72 overflow-y-auto">
                          {latestBenchmark.results.map((r) => (
                            <div key={r.id} className="p-3 text-xs flex items-start justify-between gap-3">
                              <div className="space-y-0.5 flex-1">
                                <div className="flex items-center gap-2">
                                  {r.passed ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                  ) : r.error === "timeout" ? (
                                    <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                                  )}
                                  <span className="font-mono font-medium text-[#F3F5F9]">{r.id}</span>
                                  <span className="rounded bg-[#273040]/50 px-1.5 py-0.5 text-[10px] text-[#9AA6B8]">
                                    {r.category}
                                  </span>
                                  <span className="text-[10px] text-[#9AA6B8]/60">
                                    {r.evaluation_type}
                                  </span>
                                </div>
                                <p className="text-[#9AA6B8] text-[11px] pl-6">{r.reason}</p>
                              </div>
                              <div className="text-right shrink-0 font-mono text-[11px] text-[#9AA6B8]">
                                <span>{r.latency_ms} ms</span>
                                {r.ttft_ms !== null && r.ttft_ms !== undefined && (
                                  <span className="block text-[10px] text-blue-400/80">
                                    TTFT: {r.ttft_ms} ms
                                  </span>
                                )}
                                {r.tokens_per_sec && (
                                  <span className="block text-[10px] text-emerald-400/80">
                                    {r.tokens_per_sec.toFixed(1)} tok/s
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#273040]/50 bg-[#151A23] p-8 text-center text-sm text-[#9AA6B8] space-y-2">
                      <p className="font-medium text-[#F3F5F9]">No benchmark runs recorded yet.</p>
                      <p className="text-xs">
                        Run a Smoke Test above to evaluate your local model across factual, arithmetic, and instruction following tasks.
                      </p>
                    </div>
                  )}

                  {/* Benchmark History */}
                  {history.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-[#9AA6B8]">Run History ({history.length})</h4>
                      <div className="divide-y divide-[#273040]/40 rounded-xl border border-[#273040]/60 bg-[#151A23] overflow-hidden text-xs">
                        {history.map((h) => (
                          <div key={h.run_id} className="p-3 flex items-center justify-between text-[#9AA6B8]">
                            <div className="space-y-0.5">
                              <span className="font-mono text-[#F3F5F9] font-medium">{h.run_id}</span>
                              <div className="flex items-center gap-2 text-[10px]">
                                <span>{new Date(h.timestamp).toLocaleString()}</span>
                                <span>•</span>
                                <span>{h.model_id}</span>
                                <span>•</span>
                                <span>{h.is_smoke ? "Smoke" : "Full"}</span>
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <span className="font-bold text-[#8AB4F8]">{h.pass_rate_percent}%</span>
                              <span className="block text-[10px] text-[#9AA6B8]/70">
                                {Math.round(h.avg_latency_ms)} ms avg{h.avg_ttft_ms !== null && h.avg_ttft_ms !== undefined ? ` • ${Math.round(h.avg_ttft_ms)}ms TTFT` : ""}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
