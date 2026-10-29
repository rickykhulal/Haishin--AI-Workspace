# Haishin AI Workspace

Premium AI workspace by **Haitian (H-Y-C-E-A-N)**.

> **v0.8.0 — Intelligence, Dual-Model Local Inference, and Multimodal Readiness Milestone.**<br/>
> High-performance offline language model inference running locally on your hardware via Python FastAPI backend and Ollama. Defaulting to the verified, high-speed `llama3.2:1b` model (1.3 GB, 100% within 4 GB VRAM) with seamless switching to `richardyoung/qwythos-9b-abliterated:Q4_K_M` (9B parameters for advanced reasoning with hybrid VRAM/system RAM offload). Includes prefix continuation API, reasoning token separation, truthful capability validation, and robust conversation persistence.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  Haishin Frontend (Next.js 16 + React 19 + Tailwind)  │
│  http://localhost:3000                                 │
│  - Premium Dark AI Workspace Interface                 │
│  - Progressive SSE Streaming & Cancellation            │
│  - Continuation & Model Switching                      │
│  - LocalStorage Resilient Session Persistence          │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP (REST / JSON / SSE)
                            ▼
┌────────────────────────────────────────────────────────┐
│  Haishin Backend (Python 3.14 + FastAPI + Uvicorn)     │
│  http://127.0.0.1:8000                                 │
│  - GET  /health (runtime & model telemetry)            │
│  - GET  /v1/models & POST /v1/models/refresh           │
│  - POST /v1/chat/completions (streaming & non-stream)  │
│  - POST /v1/chat/continue (prefix continuation)        │
│  - GET  /v1/system/resources (GPU/VRAM & RAM stats)    │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP (127.0.0.1:11434)
                            ▼
┌────────────────────────────────────────────────────────┐
│  Local Model Runtime (Ollama v0.40+)                   │
│  - llama-server (NVIDIA CUDA + CPU fallback)           │
│  - llama3.2:1b (1.3 GB, 100% in 4 GB GTX 1650 VRAM)   │
│  - richardyoung/qwythos-9b-abliterated:Q4_K_M (5.6 GB) │
└────────────────────────────────────────────────────────┘
```

---

## Hardware Profile & Model Sizing

- **Tested Hardware:** NVIDIA GeForce GTX 1650 (4 GB dedicated VRAM), Intel Core i5-10300H, 16 GB System RAM.
- **Primary / Default Model (`llama3.2:1b`):**
  - Parameter size: 1.2B (Q8_0 / Q4 quantization, ~1.3 GB download, ~1.8 GB VRAM footprint).
  - Runs 100% inside GPU VRAM, providing rapid responses (under 5 seconds) and low latency.
- **Secondary Model (`richardyoung/qwythos-9b-abliterated:Q4_K_M`):**
  - Parameter size: 9.0B (Q4_K_M quantization, ~5.6 GB download).
  - Automatically offloaded across GPU VRAM (partial layers) and system RAM via CPU.
  - Generates deep reasoning with `<think>` token extraction, suitable for complex problem-solving.

---

## Prerequisites

| Component | Required Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 20 LTS (tested v24) | Next.js frontend |
| **npm** | ≥ 10 (tested v11/v12) | Package management |
| **Python** | ≥ 3.10 (tested v3.14) | FastAPI backend service |
| **Ollama** | ≥ 0.3.0 (tested v0.40.5)| Local model inference daemon |
| **Git** | ≥ 2.40 | Source control |

---

## Quick Start (Windows PowerShell)

### 1. Model Runtime Setup (Ollama)

1. Verify Ollama is running:
   ```powershell
   ollama --version
   curl.exe http://127.0.0.1:11434/api/tags
   ```
2. *(If not installed)*: Download and install Ollama from [https://ollama.com/download/windows](https://ollama.com/download/windows).
3. Ensure the required models are pulled:
   ```powershell
   ollama pull llama3.2:1b
   ollama pull richardyoung/qwythos-9b-abliterated:Q4_K_M
   ```

### 2. Terminal 1 — Start the Backend

From `C:\PROJECT AI\haishin`:

```powershell
cd "C:\PROJECT AI\haishin"
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
- Health Check: **`http://127.0.0.1:8000/health`**
- Interactive API Docs: **`http://127.0.0.1:8000/docs`**

### 3. Terminal 2 — Start the Frontend

From `C:\PROJECT AI\haishin`:

```powershell
cd "C:\PROJECT AI\haishin"
npm run dev
```
- Open browser at: **`http://localhost:3000`**

---

## Key Features & Capabilities

1. **Prefix Continuation API (`POST /v1/chat/continue`):**
   - Seamlessly resumes incomplete assistant answers without repeating previously generated text.
   - Guarded by concurrency locks on `parent_message_id` to prevent duplicate or conflicting completions.
2. **Dynamic Model Discovery & Switching:**
   - Detects all installed Ollama models dynamically via `/v1/models`.
   - Allows instant switching between small responsive models and larger reasoning models.
3. **Truthful Multimodal & Speech Capabilities:**
   - Strictly validates vision compatibility: text-only models return HTTP 400 with actionable messages rather than hallucinating image content.
   - Extensible architecture ready for vision models (e.g. `llava`, `llama3.2-vision`) when installed.
   - Built-in Web Speech API microphone transcription support with graceful browser compatibility handling.
4. **Resilient Local Conversation Persistence:**
   - Full conversation history persisted client-side in `localStorage` with automated schema migrations and corruption recovery.

---

## Testing & Quality Assurance

### Backend Tests (72 tests)
```powershell
python -m pytest backend/tests -q
```
Covers API endpoints, SSE streaming, model routing, error handling, timeout recovery, hardware telemetry, and v0.8 continuation logic.

### Frontend Tests (47 tests)
```powershell
npm test
```
Tests conversation state, storage resilience, schema migrations, demo responder, SSE streaming parser, and UI utilities.

### Production Build & Static Analysis
```powershell
npm run lint
npx tsc --noEmit
npm run build
```

---

## Operational & Security Rules

1. **Strictly Local Execution:** Haishin runs entirely offline on your local machine. No external cloud inference APIs (OpenAI, Anthropic) are contacted.
2. **Local Host Binding:** The backend binds by default to `127.0.0.1` and CORS is restricted to `localhost:3000`.
3. **GitHub Deployment Notice:** Publishing this repository to GitHub publishes the source code only. Running the workspace requires local hardware with Ollama and the Python backend running locally.
4. **Honest Capability Reporting:** The system never pretends a text model understands images or that an offline service is available.

---

## License

Private — Haitian (H-Y-C-E-A-N).
