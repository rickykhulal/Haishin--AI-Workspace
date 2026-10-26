# Haishin v0.6 — Release Acceptance Checklist

**Date:** 2026-10-19  
**Tester:** Haitian / AI Assistant  
**Hardware:** Windows 11, 16 GB RAM, NVIDIA GTX 1650 (4 GB VRAM)

## Prerequisites

- [x] Ollama running at `http://127.0.0.1:11434`
- [x] Model `llama3.2:1b` installed (`ollama list`)
- [x] Backend running: `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`
- [x] Frontend running: `npm run dev`

## Automated Tests

| # | Check | Command | Expected | Result |
|---|-------|---------|----------|--------|
| 1 | Backend tests | `python -m pytest backend/tests -v` | 51 passed | ☑ PASS ☐ FAIL |
| 2 | Frontend tests | `npm test` | 40 passed | ☑ PASS ☐ FAIL |
| 3 | ESLint | `npm run lint` | 0 errors | ☑ PASS ☐ FAIL |
| 4 | TypeScript | `npx tsc --noEmit` | 0 errors | ☑ PASS ☐ FAIL |
| 5 | Production build | `npm run build` | Compiled | ☑ PASS ☐ FAIL |

## API Health

| # | Check | Command | Expected | Result |
|---|-------|---------|----------|--------|
| 6 | Health endpoint | `curl http://127.0.0.1:8000/health` | status=ok, version=0.6.0 | ☑ PASS ☐ FAIL |
| 7 | Models endpoint | `curl http://127.0.0.1:8000/v1/models` | runtime_available=true | ☑ PASS ☐ FAIL |
| 8 | Resources endpoint | `curl http://127.0.0.1:8000/v1/system/resources` | Valid CPU/RAM/GPU data | ☑ PASS ☐ FAIL |

## Browser Tests (Manual)

| # | Feature | Steps | Expected | Result |
|---|---------|-------|----------|--------|
| 9 | Chat inference | Send a message | Response from llama3.2:1b | ☑ PASS ☐ FAIL |
| 10 | Streaming | Observe response | Tokens appear incrementally | ☑ PASS ☐ FAIL |
| 11 | Stop/cancel | Click Stop mid-response | Stream halts cleanly | ☑ PASS ☐ FAIL |
| 12 | Persistence | Send message, refresh (F5) | Conversation reloads | ☑ PASS ☐ FAIL |
| 13 | Isolation | Switch conversations during stream | No cross-talk | ☑ PASS ☐ FAIL |
| 14 | Markdown | Send code question | Code blocks render correctly | ☑ PASS ☐ FAIL |
| 15 | Copy | Click copy on a message | Text copied to clipboard | ☑ PASS ☐ FAIL |
| 16 | Conversation mgmt | Create/rename/delete | Works correctly | ☑ PASS ☐ FAIL |
| 17 | Demo mode | Select "Haishin Demo" model | Mock response with "mock" badge | ☑ PASS ☐ FAIL |
| 18 | Performance dashboard | Open Performance tab | CPU/RAM/GPU charts render | ☑ PASS ☐ FAIL |
| 19 | Model discovery | Open model selector | Shows installed models | ☑ PASS ☐ FAIL |
| 20 | Version display | Open Settings | Shows "v0.6.0" | ☑ PASS ☐ FAIL |

## Benchmark

| # | Check | Command | Expected | Result |
|---|-------|---------|----------|--------|
| 21 | Smoke benchmark | `curl -X POST "http://127.0.0.1:8000/v1/benchmarks/run?smoke=true"` | Completes with pass_rate | ☑ PASS ☐ FAIL |

## Security & Data

| # | Check | Steps | Expected | Result |
|---|-------|-------|----------|--------|
| 22 | No traceback leak | Force 500 error | Error message doesn't contain file paths | ☑ PASS ☐ FAIL |
| 23 | Loopback only | Check backend binding | Only 127.0.0.1, not 0.0.0.0 | ☑ PASS ☐ FAIL |
| 24 | No secrets in storage | Check localStorage | No API keys or .env values | ☑ PASS ☐ FAIL |

## Verdict

- [x] **PASS** — All critical automated and manual items pass
- [ ] **PASS WITH LIMITATIONS** — Non-critical items have known issues
- [ ] **FAIL** — Critical items fail
