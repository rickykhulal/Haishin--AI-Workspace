# Haishin

Premium AI workspace by **Haitian (H-Y-C-E-A-N)**.

> **v0.2.1 — Switch to Verified Local Model.** Genuine offline language model inference running locally on your hardware via Python FastAPI backend and Ollama, defaulting to the verified, high-speed `llama3.2:1b` model (1.3 GB, fits within 4 GB VRAM). Explicitly labeled Demo Mock mode retained as fallback.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  Haishin Frontend (Next.js 16 + React 19)    │
│  http://localhost:3000                       │
└──────────────────────┬───────────────────────┘
                       │ HTTP (REST / JSON)
                       ▼
┌──────────────────────────────────────────────┐
│  Haishin Backend (Python + FastAPI)          │
│  http://127.0.0.1:8000                       │
│  - GET /health                               │
│  - GET /v1/models                            │
│  - POST /v1/chat/completions                 │
└──────────────────────┬───────────────────────┘
                       │ HTTP (127.0.0.1:11434)
                       ▼
┌──────────────────────────────────────────────┐
│  Local Model Runtime (Ollama)                │
│  - llama-server (NVIDIA GPU + CPU fallback)  │
│  - Models: llama3.2:1b (recommended 1B)     │
└──────────────────────────────────────────────┘
```

---

## Hardware Profile & Model Sizing

- **Tested Hardware:** NVIDIA GeForce GTX 1650 (4 GB dedicated VRAM), 16 GB System RAM.
- **Recommended Model:** `llama3.2:1b` (Q4 quantization, ~1.3 GB download, ~1.8 GB VRAM).
  - Fits 100% within the 4 GB VRAM for rapid, responsive generation.
- **Larger Models (e.g. 7B–9B):**
  - Models exceeding 4 GB VRAM (such as 9B Q4 models requiring ~5.6 GB) will offload extra layers to system RAM via CPU.
  - While functional, initial cold load and token generation will have higher latency.

---

## Prerequisites

| Component | Required Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 20 LTS (tested v24) | Next.js frontend |
| **npm** | ≥ 10 | Package management |
| **Python** | ≥ 3.10 (tested v3.14) | FastAPI backend service |
| **Ollama** | ≥ 0.3.0 (tested v0.40.4)| Local model inference daemon |
| **Git** | ≥ 2.40 | Source control |

---

## Quick Start (Two Terminals on Windows)

### 1. Model Runtime Setup (Ollama)

1. Verify Ollama is installed and running:
   ```powershell
   ollama --version
   curl.exe http://127.0.0.1:11434/api/tags
   ```
2. *(If not installed)*: Download and install Ollama from [https://ollama.com/download/windows](https://ollama.com/download/windows).
3. Download the recommended lightweight 1B model (approx 1.3 GB):
   ```powershell
   ollama pull llama3.2:1b
   ```

### 2. Terminal 1 — Start the Backend

From `C:\PROJECT AI\haishin`:

```powershell
cd "C:\PROJECT AI\haishin"
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
- Backend will be available at: **`http://127.0.0.1:8000`**
- Health check: **`http://127.0.0.1:8000/health`**
- Interactive API Docs: **`http://127.0.0.1:8000/docs`**

### 3. Terminal 2 — Start the Frontend

From `C:\PROJECT AI\haishin`:

```powershell
cd "C:\PROJECT AI\haishin"
npm run dev
```
- Open browser at: **`http://localhost:3000`**

---

## Project Structure

```
haishin/
├── backend/                    # Python FastAPI local inference service
│   ├── app/
│   │   ├── config.py           # Host, port, CORS, Ollama target URL
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── ollama_adapter.py   # Ollama HTTP client with timeout & error handling
│   │   └── main.py             # FastAPI routes (/health, /v1/models, /v1/chat/completions)
│   ├── tests/
│   │   └── test_api.py         # Pytest test suite with mocked adapters
│   ├── .env.example
│   ├── requirements.txt
│   └── README.md
├── src/                        # Next.js App Router frontend
│   ├── app/
│   │   ├── globals.css         # Haishin design tokens & dark styles
│   │   ├── layout.tsx          # Root layout & providers
│   │   └── page.tsx            # Main workspace
│   ├── components/
│   │   ├── chat/               # MessageBubble, MessageList, Composer, Welcome
│   │   ├── layout/             # AppShell, Sidebar, TopBar, BrandMark, Settings
│   │   ├── model/              # ModelSelector dropdown
│   │   └── ui/                 # Toast, ConfirmDialog
│   ├── features/
│   │   └── conversations/      # Types, state reducer, models registry
│   └── lib/
│       ├── local-api.ts        # Client for FastAPI backend
│       ├── demo-responder.ts   # Fallback mock responder
│       └── utils.ts            # Formatting, IDs, clipboard
├── tests/                      # Frontend unit test suite (node:test)
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Available Commands

### Frontend

| Command | Working Directory | Description |
|---|---|---|
| `npm run dev` | `C:\PROJECT AI\haishin` | Start Next.js development server |
| `npm run build` | `C:\PROJECT AI\haishin` | Build optimized production bundle |
| `npm start` | `C:\PROJECT AI\haishin` | Start production server |
| `npm run lint` | `C:\PROJECT AI\haishin` | Run ESLint static analysis |
| `npm test` | `C:\PROJECT AI\haishin` | Run frontend unit tests (`node:test`) |
| `npx tsc --noEmit` | `C:\PROJECT AI\haishin` | Run TypeScript strict type check |

### Backend

| Command | Working Directory | Description |
|---|---|---|
| `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000` | `C:\PROJECT AI\haishin` | Start backend server |
| `python -m pytest backend/tests/ -v` | `C:\PROJECT AI\haishin` | Run backend test suite |

---

## Operational & Security Rules

1. **No External API Keys:** Haishin v0.2 does not communicate with OpenAI, Anthropic, or any third-party cloud inference provider.
2. **Strictly Local Binding:** The backend binds to `127.0.0.1` and CORS is restricted to `localhost:3000`. It is never exposed publicly.
3. **No Hidden Fallbacks:** When `Haishin Local` is selected, failure states (backend offline, Ollama offline, model missing, timeout) are reported honestly with exact instructions. The UI never silently swaps to mock responses.
4. **Honest Labeling:** Messages produced by local inference carry a `"local"` pill badge, while mock messages carry a `"mock"` pill badge.

---

## License

Private — Haitian (H-Y-C-E-A-N).
