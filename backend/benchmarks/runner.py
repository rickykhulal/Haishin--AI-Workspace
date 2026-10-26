"""
Automated benchmark runner for Haishin v0.4.
Executes prompts sequentially against local Ollama inference, records latency,
tokens/sec throughput, and outputs structured JSON and Markdown reports.
"""

import os
import sys
import json
import time
import asyncio
import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

from .prompts import BENCHMARK_VERSION, get_prompts
from .evaluator import evaluate_output

RESULTS_DIR = Path(__file__).resolve().parent / "results"


def ensure_results_dir() -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    return RESULTS_DIR


def generate_markdown_report(summary: Dict[str, Any]) -> str:
    """Generate human-readable Markdown summary of benchmark run."""
    run_id = summary["run_id"]
    timestamp = summary["timestamp"]
    model_id = summary["model_id"]
    is_smoke = summary["is_smoke"]
    total = summary["total_prompts"]
    passed = summary["passed"]
    failed = summary["failed"]
    timed_out = summary["timed_out"]
    errored = summary["errored"]
    pass_rate = summary["pass_rate_percent"]
    total_sec = round(summary["total_duration_ms"] / 1000.0, 1)
    avg_latency = summary["avg_latency_ms"]
    avg_ttft = summary.get("avg_ttft_ms")
    ttft_str = f"{avg_ttft:.0f} ms" if avg_ttft is not None else "N/A"
    tps = summary.get("avg_tokens_per_sec")
    tps_str = f"{tps:.1f} tok/s" if tps else "N/A"

    mode_label = "Smoke Test (3 prompts)" if is_smoke else f"Full Suite ({total} prompts)"

    md = f"""# Haishin Benchmark Report — {run_id}

- **Benchmark Version:** {summary.get('benchmark_version', BENCHMARK_VERSION)}
- **Date & Time:** {timestamp}
- **Model:** `{model_id}`
- **Test Mode:** {mode_label}
- **Total Duration:** {total_sec}s
- **Pass Rate:** **{pass_rate:.1f}%** ({passed}/{total} passed)
- **Average Latency:** {avg_latency:.0f} ms
- **Average TTFT:** {ttft_str}
- **Average Throughput:** {tps_str}

## Status Breakdown

| Metric | Count |
| :--- | :--- |
| **Total Prompts** | {total} |
| **Passed** | {passed} |
| **Failed** | {failed} |
| **Timed Out** | {timed_out} |
| **Errored** | {errored} |

## Detailed Results

| ID | Category | Type | Status | Latency | Tok/s | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
"""

    for r in summary["results"]:
        status_icon = "PASS" if r["passed"] else ("TIMEOUT" if r.get("error") == "timeout" else "FAIL")
        tok_s = f"{r['tokens_per_sec']:.1f}" if r.get("tokens_per_sec") else "-"
        reason = r["reason"].replace("|", "\\|")
        md += f"| `{r['id']}` | {r['category']} | {r['evaluation_type']} | **{status_icon}** | {r['latency_ms']}ms | {tok_s} | {reason} |\n"

    md += """
---
*Note: Results from a single run are preliminary. Approximate evaluation checks are labeled accordingly.*
"""
    return md


async def run_benchmark(
    model_id: Optional[str] = None,
    smoke_only: bool = False,
    base_url: str = "http://127.0.0.1:11434",
    timeout_override: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Execute benchmark prompts sequentially against local Ollama runtime.
    Returns structured summary and persists JSON + Markdown files.
    """
    from backend.app.ollama_adapter import OllamaAdapter

    adapter = OllamaAdapter(base_url=base_url)
    try:
        resolved_model = await adapter.resolve_model(model_id)
    except Exception as exc:
        raise RuntimeError(f"Cannot run benchmark: runtime/model resolution failed: {exc}") from exc

    prompts = get_prompts(smoke_only=smoke_only)
    run_timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    clean_ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    run_id = f"bench_{'smoke_' if smoke_only else ''}{clean_ts}"

    results: List[Dict[str, Any]] = []
    total_start = time.perf_counter()

    for item in prompts:
        prompt_id = item["id"]
        category = item["category"]
        prompt_text = item["prompt"]
        eval_type = item["evaluation_type"]
        timeout_sec = timeout_override or item["timeout"]

        item_start = time.perf_counter()
        passed = False
        score = 0.0
        reason = ""
        output_text = ""
        error_msg = None
        eval_tokens = None
        prompt_tokens = None
        tokens_per_sec = None

        try:
            # Set adapter timeout for this specific prompt
            adapter.timeout = timeout_sec
            resp = await adapter.chat(
                messages=[{"role": "user", "content": prompt_text}],
                model=resolved_model,
                temperature=0.1,  # Low temperature for deterministic evaluation
            )
            output_text = resp.get("content", "")
            eval_tokens = resp.get("completion_tokens")
            prompt_tokens = resp.get("prompt_tokens")
            duration_ms = resp.get("duration_ms") or int((time.perf_counter() - item_start) * 1000)

            if eval_tokens and duration_ms and duration_ms > 0:
                tokens_per_sec = round((eval_tokens / (duration_ms / 1000.0)), 2)

            passed, score, reason = evaluate_output(prompt_id, output_text)

        except Exception as exc:
            duration_ms = int((time.perf_counter() - item_start) * 1000)
            exc_str = str(exc)
            if "timed out" in exc_str.lower() or "timeout" in exc_str.lower():
                error_msg = "timeout"
                reason = f"Inference timed out after {timeout_sec}s."
            else:
                error_msg = "error"
                reason = f"Execution error: {exc_str}"
            passed = False
            score = 0.0

        latency_ms = duration_ms

        results.append({
            "id": prompt_id,
            "category": category,
            "prompt": prompt_text,
            "evaluation_type": eval_type,
            "passed": passed,
            "score": score,
            "reason": reason,
            "output": output_text,
            "latency_ms": latency_ms,
            "eval_tokens": eval_tokens,
            "prompt_tokens": prompt_tokens,
            "tokens_per_sec": tokens_per_sec,
            "error": error_msg,
        })

    total_duration_ms = int((time.perf_counter() - total_start) * 1000)
    passed_count = sum(1 for r in results if r["passed"])
    failed_count = sum(1 for r in results if not r["passed"] and not r["error"])
    timed_out_count = sum(1 for r in results if r.get("error") == "timeout")
    errored_count = sum(1 for r in results if r.get("error") == "error")
    total_count = len(results)
    pass_rate = round((passed_count / total_count * 100.0), 1) if total_count > 0 else 0.0

    avg_latency = round(sum(r["latency_ms"] for r in results) / total_count, 1) if total_count > 0 else 0.0
    tps_vals = [r["tokens_per_sec"] for r in results if r.get("tokens_per_sec") is not None]
    ttft_vals = [r["ttft_ms"] for r in results if r.get("ttft_ms") is not None]
    avg_ttft = round(sum(ttft_vals) / len(ttft_vals), 1) if ttft_vals else None

    summary = {
        "benchmark_version": BENCHMARK_VERSION,
        "run_id": run_id,
        "timestamp": run_timestamp,
        "model_id": resolved_model,
        "is_smoke": smoke_only,
        "total_prompts": total_count,
        "passed": passed_count,
        "failed": failed_count,
        "timed_out": timed_out_count,
        "errored": errored_count,
        "pass_rate_percent": pass_rate,
        "total_duration_ms": total_duration_ms,
        "avg_latency_ms": avg_latency,
        "avg_ttft_ms": avg_ttft,
        "avg_tokens_per_sec": avg_tps,
        "results": results,
    }

    # Persist JSON and Markdown files
    res_dir = ensure_results_dir()
    json_path = res_dir / f"{run_id}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    latest_json = res_dir / "latest.json"
    with open(latest_json, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    md_content = generate_markdown_report(summary)
    md_path = res_dir / f"{run_id}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    latest_md = res_dir / "latest.md"
    with open(latest_md, "w", encoding="utf-8") as f:
        f.write(md_content)

    return summary


def get_latest_benchmark_result() -> Optional[Dict[str, Any]]:
    """Return the most recent benchmark run result, or None if no runs exist."""
    res_dir = ensure_results_dir()
    latest_file = res_dir / "latest.json"
    if latest_file.exists():
        try:
            with open(latest_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    # Fallback to scanning *.json
    json_files = sorted(res_dir.glob("bench_*.json"), key=os.path.getmtime, reverse=True)
    if json_files:
        try:
            with open(json_files[0], "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def get_benchmark_history() -> List[Dict[str, Any]]:
    """Return list of historical benchmark run summaries (without verbose prompt outputs)."""
    res_dir = ensure_results_dir()
    json_files = sorted(res_dir.glob("bench_*.json"), key=os.path.getmtime, reverse=True)
    history: List[Dict[str, Any]] = []

    for path in json_files[:10]:  # Limit to 10 most recent
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                history.append({
                    "run_id": data.get("run_id"),
                    "timestamp": data.get("timestamp"),
                    "model_id": data.get("model_id"),
                    "is_smoke": data.get("is_smoke"),
                    "total_prompts": data.get("total_prompts"),
                    "passed": data.get("passed"),
                    "failed": data.get("failed"),
                    "pass_rate_percent": data.get("pass_rate_percent"),
                    "avg_latency_ms": data.get("avg_latency_ms"),
                    "avg_ttft_ms": data.get("avg_ttft_ms"),
                    "avg_tokens_per_sec": data.get("avg_tokens_per_sec"),
                    "total_duration_ms": data.get("total_duration_ms"),
                })
        except Exception:
            continue
    return history


def main():
    """CLI entrypoint for running benchmarks."""
    import argparse
    parser = argparse.ArgumentParser(description="Haishin Benchmark Runner")
    parser.add_argument("--smoke", action="store_true", help="Run fast 3-prompt smoke test")
    parser.add_argument("--model", type=str, default=None, help="Target model ID")
    parser.add_argument("--timeout", type=float, default=None, help="Per-prompt timeout in seconds")
    args = parser.parse_args()

    print(f"[Haishin Benchmark] Starting {'smoke' if args.smoke else 'full'} evaluation suite...")
    try:
        summary = asyncio.run(
            run_benchmark(
                model_id=args.model,
                smoke_only=args.smoke,
                timeout_override=args.timeout,
            )
        )
        print(f"\n[Haishin Benchmark] Completed Run: {summary['run_id']}")
        print(f"Model: {summary['model_id']}")
        print(f"Passed: {summary['passed']}/{summary['total_prompts']} ({summary['pass_rate_percent']}%)")
        print(f"Average Latency: {summary['avg_latency_ms']:.0f} ms")
        if summary.get('avg_tokens_per_sec'):
            print(f"Average Throughput: {summary['avg_tokens_per_sec']:.1f} tok/s")
        print(f"Results saved to: {RESULTS_DIR}")
    except Exception as exc:
        print(f"[Haishin Benchmark Error] {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
