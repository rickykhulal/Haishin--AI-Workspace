# Haishin v0.5 — Stability, Regression Testing & Evidence-Based Hardening Report

**Date:** 2026-10-16  
**Author:** Haishin Development Agent  
**Milestone:** v0.5 — Stability & Regression Hardening  
**Verdict:** ✅ **PASS**

---

## 1. Executive Summary

The v0.5 stability milestone audited the existing Haishin application, added 27 regression tests (15 backend + 12 frontend), fixed 3 confirmed defects with minimal code changes, and verified zero regressions across the full test suite.

| Metric | Before v0.5 | After v0.5 |
|--------|-------------|------------|
| Backend tests (pytest) | 28 passed | **43 passed** (+15) |
| Frontend tests (node:test) | 28 passed | **40 passed** (+12) |
| Lint errors | 0 | **0** |
| TypeScript errors | 0 | **0** |
| Production build | ✅ | ✅ |
| Defects fixed | — | **3** |

---

## 2. Phase A — Baseline Audit

### 2.1 Git State (Recorded Before Any v0.5 Edits)

- **Branch:** `master`
- **Last commit:** `78cac97` (chore: add Python cache and environment patterns to .gitignore)
- **Working tree:** Modified files from v0.3/v0.4 milestones (uncommitted)
- **Untracked files:** `AGENTS.md`, `backend/app/system_resources.py`, `backend/benchmarks/`, `backend/tests/test_v04_intelligence.py`, `src/components/performance/`, `src/lib/storage.ts`, `tests/intelligence.test.ts`, `tests/storage.test.ts`

### 2.2 Baseline Test Results (All Passing)

| Check | Command | Result | Exit Code | Duration |
|-------|---------|--------|-----------|----------|
| Backend tests | `python -m pytest backend/tests` | 28 passed | 0 | 0.92s |
| Frontend tests | `npm test` | 28 passed | 0 | 1.28s |
| Lint | `npm run lint` | 0 errors, 0 warnings | 0 | — |
| TypeScript | `npx tsc --noEmit` | 0 errors | 0 | — |
| Production build | `npm run build` | Compiled successfully | 0 | Turbopack |

**No pre-existing test failures detected.**

### 2.3 Architecture Summary

| Component | Technology | URL |
|-----------|-----------|-----|
| Frontend | Next.js 16.4.1 (App Router), React 19, Tailwind CSS | `http://localhost:3000` |
| Backend | FastAPI, Python 3.14.7 | `http://127.0.0.1:8000` |
| Inference | Ollama (local) | `http://127.0.0.1:11434` |
| Default model | `llama3.2:1b` | — |
| Hardware | Windows, 16 GB RAM, NVIDIA GTX 1650 (4 GB VRAM) | — |

---

## 3. Phase B — Regression Test Matrix

### 3.1 Backend Regression Tests (`backend/tests/test_v05_stability.py`)

15 new regression tests covering:

| # | Test | Category | Status |
|---|------|----------|--------|
| 1 | `test_health_schema_fields` | Health schema | ✅ PASS |
| 2 | `test_health_no_models_installed` | Health edge case | ✅ PASS |
| 3 | `test_models_invalid_model_returns_empty_gracefully` | Model resilience | ✅ PASS |
| 4 | `test_system_resources_no_nvidia_smi` | GPU degradation | ✅ PASS |
| 5 | `test_system_resources_no_psutil` | CPU/RAM degradation | ✅ PASS |
| 6 | `test_system_resources_nvidia_smi_timeout` | GPU timeout | ✅ PASS |
| 7 | `test_streaming_chunk_order` | SSE protocol | ✅ PASS |
| 8 | `test_streaming_error_in_sse` | SSE error handling | ✅ PASS |
| 9 | `test_benchmark_history_empty` | Benchmark edge case | ✅ PASS |
| 10 | `test_benchmark_latest_empty` | Benchmark edge case | ✅ PASS |
| 11 | `test_chat_wrong_role_rejected` | Validation | ✅ PASS |
| 12 | `test_chat_whitespace_only_rejected` | Validation | ✅ PASS |
| 13 | `test_models_refresh_invalidates_cache` | Cache invalidation | ✅ PASS |
| 14 | `test_health_handles_exception_from_check_runtime` | Error resilience | ✅ PASS |
| 15 | `test_benchmark_run_timeout_returns_500` | Timeout handling | ✅ PASS |

### 3.2 Frontend Regression Tests (`tests/stability.test.ts`)

12 new regression tests covering:

| # | Test | Category | Status |
|---|------|----------|--------|
| 1 | Storage: invalid JSON returns empty array | Corruption | ✅ PASS |
| 2 | Storage: wrong schema returns empty array | Corruption | ✅ PASS |
| 3 | Storage: null/undefined values handled | Corruption | ✅ PASS |
| 4 | Storage: missing `modelId` gets default | Migration | ✅ PASS |
| 5 | Storage: missing `updatedAt` uses `createdAt` | Migration | ✅ PASS |
| 6 | Demo: resolves with `mode='mock'` | Demo mode | ✅ PASS |
| 7 | Demo: cancelled via AbortSignal | Cancellation | ✅ PASS |
| 8 | Demo: truncates long titles | Formatting | ✅ PASS |
| 9 | Demo: preserves short titles | Formatting | ✅ PASS |
| 10 | API: parseSSEStream complete stream | Streaming | ✅ PASS |
| 11 | API: parseSSEStream error chunk | Error handling | ✅ PASS |
| 12 | API: parseSSEStream empty stream | Edge case | ✅ PASS |

---

## 4. Phase C — Confirmed Defect Fixes

### Fix 1: Async nvidia-smi call (Event Loop Blocking)

- **File:** `backend/app/main.py`, line 221
- **Root cause:** `get_system_resources()` calls `subprocess.run(nvidia-smi)` synchronously on the async event loop. If nvidia-smi hangs or is slow (up to 1.5s timeout), it blocks all concurrent requests.
- **Fix:** `data = await asyncio.to_thread(get_system_resources)` — offloads the synchronous I/O to a thread pool worker.
- **Risk:** Minimal. `asyncio.to_thread` is standard library. The function is already thread-safe (no shared mutable state).

### Fix 2: Missing `psutil` in requirements.txt

- **File:** `backend/requirements.txt`, line 7
- **Root cause:** `system_resources.py` imports `psutil` but it was not declared as a dependency. Installation works on the dev machine because psutil was installed globally, but would fail in a fresh virtualenv.
- **Fix:** Added `psutil>=5.9.0` to requirements.txt.
- **Risk:** None. Declarative dependency listing.

### Fix 3: Missing `Optional` import in main.py

- **File:** `backend/app/main.py`, line 3
- **Root cause:** `run_benchmark_endpoint` uses `Optional[str]` for the `model` parameter, but `Optional` was not explicitly imported. FastAPI's internal type resolution happened to handle it, but this is fragile and incorrect for static type checkers.
- **Fix:** Added `from typing import Optional` at line 3.
- **Risk:** None. Import-only change.

### Deferred Items (Not Fixed — Working as-is)

| Issue | Reason Deferred |
|-------|----------------|
| `chat_stream` creates ephemeral httpx clients | Functional as-is. The `finally: await client.aclose()` ensures cleanup. Switching to pool client risks lifetime issues with streaming generators. |
| No `asyncio.wait_for` on benchmark run endpoint | Benchmark runner already has per-prompt timeouts. Adding endpoint-level timeout risks corrupting partial results. Should be addressed in a future milestone with proper cancellation semantics. |

---

## 5. Phase D — Full Verification Suite

### 5.1 Post-Fix Automated Test Results

| Check | Command | Result | Exit Code |
|-------|---------|--------|-----------|
| Backend tests | `python -m pytest backend/tests -v` | **43 passed** | 0 |
| Frontend tests | `npm test` | **40 passed** | 0 |
| Lint | `npm run lint` | 0 errors, 0 warnings | 0 |
| TypeScript | `npx tsc --noEmit` | 0 errors | 0 |
| Production build | `npm run build` | Compiled successfully (Turbopack) | 0 |

**Zero regressions detected.**

### 5.2 Files Changed in v0.5

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/app/main.py` | Modified | Added `from typing import Optional` (line 3), changed `get_system_resources()` to `await asyncio.to_thread(get_system_resources)` (line 221) |
| `backend/requirements.txt` | Modified | Added `psutil>=5.9.0` |
| `backend/tests/test_v05_stability.py` | **New** | 15 backend regression tests |
| `tests/stability.test.ts` | **New** | 12 frontend regression tests |

**Total:** 2 files modified, 2 files created. **No files deleted.**

---

## 6. Startup Hang Investigation (Section 6)

### Analysis

The `/v1/system/resources` endpoint previously ran `subprocess.run(nvidia-smi)` synchronously on the async event loop. While this had a 1.5s timeout, it could still block all concurrent requests during that window. 

The most likely hang scenario: a previous uvicorn process became unresponsive (e.g., stuck in a long benchmark or GPU-bound nvidia-smi call), and a new process couldn't bind to port 8000. Stopping the old process and restarting fixed it.

### Mitigation Applied

Fix 1 (`asyncio.to_thread`) ensures `nvidia-smi` and `psutil` calls now run in a thread pool, preventing event loop blocking.

### Recommendations for Future Milestones

1. Add startup health probe logging with timestamps around lifespan events
2. Consider `--reload` flag with file-change-only triggers for dev server
3. Add process-level timeout for `/v1/benchmarks/run` endpoint

---

## 7. Existing Benchmark Results (Preserved)

All v0.4 benchmark results were preserved without modification:

| File | Type |
|------|------|
| `bench_20261016_090658.json` / `.md` | Full run (15/18 passed, 83.3%) |
| `bench_20261016_091008.json` / `.md` | Full run |
| `bench_smoke_20261016_090609.json` / `.md` | Smoke test |
| `bench_smoke_20261016_090646.json` / `.md` | Smoke test |
| `bench_smoke_20261016_090955.json` / `.md` | Smoke test |
| `latest.json` / `latest.md` | Latest symlinks |

---

## 8. Browser Acceptance Checklist

> [!IMPORTANT]
> These items require **manual browser verification** at `http://localhost:3000` with the backend running at `http://127.0.0.1:8000`. They cannot be verified by automated unit/API tests.

| # | Feature | Verification Steps | Status |
|---|---------|-------------------|--------|
| 1 | Local chat inference | Send a message, verify response from llama3.2:1b | 🔲 REQUIRES USER VERIFICATION |
| 2 | Progressive streaming | Observe tokens appearing incrementally during response | 🔲 REQUIRES USER VERIFICATION |
| 3 | Stop/cancel behavior | Click Stop during a streaming response, verify it halts cleanly | 🔲 REQUIRES USER VERIFICATION |
| 4 | Conversation persistence | Send messages, refresh browser (F5), verify conversations reload | 🔲 REQUIRES USER VERIFICATION |
| 5 | Conversation isolation | Switch between conversations during streaming, verify no cross-talk | 🔲 REQUIRES USER VERIFICATION |
| 6 | Markdown/copy | Verify code blocks render with syntax highlighting, copy button works | 🔲 REQUIRES USER VERIFICATION |
| 7 | Sidebar & conversation management | Create, rename, delete conversations from sidebar | 🔲 REQUIRES USER VERIFICATION |
| 8 | Demo mode | Select "Haishin Demo" model, send message, verify mock response | 🔲 REQUIRES USER VERIFICATION |
| 9 | Performance dashboard | Navigate to Performance & Models tab, verify CPU/RAM/GPU charts render | 🔲 REQUIRES USER VERIFICATION |

### Manual Test Steps

1. Start backend: `cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
2. Start frontend: `npm run dev` (in project root)
3. Open `http://localhost:3000` in browser
4. Work through items 1–9 above

---

## 9. Verdict

### ✅ PASS

**Justification:**
- All 83 automated tests pass (43 backend + 40 frontend) with zero regressions
- 27 new regression tests cover stability-critical code paths
- 3 confirmed defects fixed with minimal, safe code changes
- No UI changes, no feature removals, no external dependencies added
- Production build compiles successfully
- Existing benchmark data and user conversations preserved

### Limitations

1. Browser acceptance tests (Section 8) require manual verification — no browser automation available
2. `chat_stream` ephemeral client pattern is functional but sub-optimal — deferred to future milestone
3. Benchmark endpoint lacks top-level timeout — deferred with documented rationale
4. Settings dialog still shows "v0.1.0" — cosmetic inconsistency, not in scope for stability milestone
