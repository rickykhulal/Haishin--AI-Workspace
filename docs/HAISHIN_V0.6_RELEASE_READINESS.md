# Haishin v0.6 — Release Readiness Guide

## Overview

Haishin is a premium local AI workspace by Haitian (H-Y-C-E-A-N). It provides a dark-themed chat interface backed by local Ollama inference — no cloud APIs, no external data transmission.

## Architecture

| Component | Technology | Default URL |
|-----------|-----------|-------------|
| Frontend | Next.js 16.4 (App Router), React 19, Tailwind CSS | `http://localhost:3000` |
| Backend | Python 3.10+, FastAPI | `http://127.0.0.1:8000` |
| Inference | Ollama (local) | `http://127.0.0.1:11434` |
| Default Model | `llama3.2:1b` (1.3 GB, fits 4 GB VRAM) | — |

## Prerequisites

| Requirement | Version | Notes |
|------------|---------|-------|
| Node.js | ≥ 20 LTS | Tested with v24 |
| npm | ≥ 10 | Comes with Node.js |
| Python | ≥ 3.10 | Tested with v3.14 |
| Ollama | ≥ 0.3.0 | Tested with v0.40.4 |
| Git | ≥ 2.40 | Source control |
| GPU (optional) | NVIDIA with ≥ 4 GB VRAM | GTX 1650 tested; CPU fallback works |

## Installation

### 1. Clone and install frontend dependencies

```powershell
cd "C:\PROJECT AI\haishin"
npm install
```

### 2. Install backend dependencies

```powershell
python -m pip install -r backend/requirements.txt
```

### 3. Install Ollama and a model

```powershell
# Verify Ollama is installed and running
ollama --version
curl.exe http://127.0.0.1:11434/api/tags

# Download the recommended 1B model (~1.3 GB)
ollama pull llama3.2:1b
```

## Configuration

Copy `backend/.env.example` to `backend/.env` and adjust if needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `HAISHIN_HOST` | `127.0.0.1` | Backend bind address (loopback only) |
| `HAISHIN_PORT` | `8000` | Backend port |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama HTTP endpoint |
| `HAISHIN_DEFAULT_MODEL` | `llama3.2:1b` | Default model for inference |
| `HAISHIN_INFERENCE_TIMEOUT` | `120.0` | Per-request timeout in seconds |
| `HAISHIN_CORS_ORIGINS` | `http://localhost:3000,...` | Allowed frontend origins |

> **Security:** The backend binds to `127.0.0.1` by default. Never expose it publicly. Do not commit `.env` files with secrets.

### Configuration validation (v0.6)

The backend validates configuration at startup:
- Invalid ports (outside 1–65535) fall back to 8000.
- Invalid Ollama URLs (missing `http://` or `https://`) fall back to the default.
- Negative or zero timeouts fall back to 120.0 seconds.
- Empty model names fall back to `llama3.2:1b`.

Validation warnings are printed to stderr with `[Haishin Config]` prefix.

## Starting the Application

### Terminal 1 — Backend

```powershell
cd "C:\PROJECT AI\haishin"
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

### Terminal 2 — Frontend

```powershell
cd "C:\PROJECT AI\haishin"
npm run dev
```

Open `http://localhost:3000` in your browser.

## Running Tests

| Command | Description |
|---------|-------------|
| `python -m pytest backend/tests -v` | Backend test suite |
| `npm test` | Frontend test suite |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript strict check |
| `npm run build` | Production build |

## Running Benchmarks

```powershell
# Smoke test (3 prompts, ~1 minute)
curl.exe -X POST "http://127.0.0.1:8000/v1/benchmarks/run?smoke=true"

# Full suite (18 prompts, ~5 minutes)
curl.exe -X POST "http://127.0.0.1:8000/v1/benchmarks/run"

# CLI runner
python -m backend.benchmarks.runner --smoke
```

Results are saved in `backend/benchmarks/results/`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Backend + Ollama health status |
| `GET` | `/v1/models` | List installed Ollama models |
| `POST` | `/v1/models/refresh` | Refresh model cache |
| `POST` | `/v1/chat/completions` | Chat inference (streaming + non-streaming) |
| `GET` | `/v1/system/resources` | CPU, RAM, GPU telemetry |
| `GET` | `/v1/benchmarks/latest` | Latest benchmark result |
| `GET` | `/v1/benchmarks/history` | Benchmark history (last 10 runs) |
| `POST` | `/v1/benchmarks/run` | Run benchmark suite |

## Features (v0.6)

- Local chat inference via Ollama (no cloud APIs)
- Progressive response streaming with SSE
- Generation cancellation (stop button)
- Conversation persistence (survives browser refresh)
- Conversation isolation (no cross-talk)
- Markdown rendering with syntax highlighting
- Message copy to clipboard
- Conversation management (create, rename, delete)
- Demo mode with labeled mock responses
- Model discovery and selection
- Performance dashboard (CPU, RAM, GPU, VRAM telemetry)
- Benchmark runner with deterministic evaluators
- Configuration validation at startup
- Safe error handling (no traceback leaks)

## Troubleshooting

### Backend won't start
- Check if port 8000 is already in use: `netstat -ano | findstr :8000`
- Kill the existing process or change `HAISHIN_PORT`
- Verify Python: `python --version` (must be ≥ 3.10)

### Ollama unreachable
- Verify Ollama is running: `curl.exe http://127.0.0.1:11434/api/tags`
- If not running, start it from the system tray or run `ollama serve`
- Check Windows Firewall isn't blocking loopback connections

### Model not found
- List installed models: `ollama list`
- Pull the default model: `ollama pull llama3.2:1b`
- The configured model must match an installed model name exactly

### Inference is slow
- First request after restart loads the model into GPU memory (cold start)
- Larger models (7B+) may not fit in 4 GB VRAM and will offload to CPU
- Use `llama3.2:1b` for best speed on GTX 1650

### Frontend shows "Backend unreachable"
- Ensure the backend is running on port 8000
- Ensure CORS allows `http://localhost:3000`

## Known Limitations

- Single-user local application (no authentication)
- Conversations stored in browser localStorage (cleared if browser data is cleared)
- Benchmark evaluation uses heuristic string matching, not a reference model
- GPU telemetry requires `nvidia-smi` in PATH (NVIDIA GPUs only)
- No multi-turn context window management (full history sent to model)

## Hardware Tested

- Windows 11, 16 GB RAM, NVIDIA GeForce GTX 1650 (4 GB VRAM)
- Model: `llama3.2:1b` (Q4, ~1.3 GB download, ~1.8 GB VRAM)
