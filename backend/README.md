# Haishin Local AI Backend (FastAPI + Ollama)

The backend service for Haishin v0.2. It interfaces with a locally running [Ollama](https://ollama.com/) instance to deliver genuine offline language model inference without cloud APIs or external API keys.

---

## Architecture

```
Frontend (Next.js :3000)
       │
       ▼  HTTP (JSON / CORS restricted)
Backend (FastAPI :8000)
       │
       ▼  HTTP (127.0.0.1:11434)
Ollama Runtime (llama-server / GPU+CPU)
```

- **Host & Port:** `127.0.0.1:8000` (strictly local, never exposed publicly).
- **Runtime:** Ollama local daemon (`http://127.0.0.1:11434`).
- **Adapter:** Replaceable `OllamaAdapter` with timeout, connection retry, and structured error handling.
- **Hardware Profile:** Tested on NVIDIA GeForce GTX 1650 (4 GB VRAM) + 16 GB RAM with CPU fallback.

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Reports service health, Ollama availability, and local model readiness. |
| `GET` | `/v1/models` | Lists all models currently pulled in Ollama and the active default. |
| `POST` | `/v1/chat/completions` | Executes validated local inference and returns tokens, latency, and assistant response. |

### Error Handling

- `422 Unprocessable Entity`: Message payload validation failure (empty message, invalid role).
- `404 Not Found`: Requested model is not pulled in Ollama.
- `503 Service Unavailable`: Ollama service is not running or unreachable.
- `504 Gateway Timeout`: Inference exceeded timeout threshold (e.g., cold model load).

---

## Setup & Running on Windows

### 1. Prerequisites

- Python ≥ 3.10
- Ollama installed and running (`ollama --version`)

### 2. Install Dependencies

Open PowerShell in the project directory:

```powershell
cd "C:\PROJECT AI\haishin"
python -m pip install -r backend/requirements.txt
```

### 3. Start Ollama (if not already running)

Ensure Ollama is running in the background or system tray. Verify reachability:

```powershell
curl.exe http://127.0.0.1:11434/api/tags
```

### 4. Configure Environment (Optional)

Copy `.env.example` if you wish to override default host/port or specify a default model:

```powershell
cd "C:\PROJECT AI\haishin\backend"
Copy-Item .env.example .env
```

### 5. Start Backend Server

From `C:\PROJECT AI\haishin`:

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## Running Automated Tests

```powershell
cd "C:\PROJECT AI\haishin"
python -m pytest backend/tests/ -v
```
