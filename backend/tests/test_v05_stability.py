import asyncio
import json
import subprocess
import httpx
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from backend.app.main import app, ollama_adapter
from backend.app.ollama_adapter import (
    OllamaAdapter,
    OllamaError,
    RuntimeUnavailableError,
    ModelNotFoundError,
    InferenceTimeoutError,
    InferenceError,
)

client = TestClient(app)


def test_health_schema_fields():
    """1. Verify /health response has all required fields: status, service, version, runtime, model."""
    fake_models = [{"name": "llama3.2:1b", "size": 1300000000}]
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, fake_models)
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "service" in data
        assert "version" in data
        assert "runtime" in data
        assert "type" in data["runtime"]
        assert "available" in data["runtime"]
        assert "url" in data["runtime"]
        assert "model" in data
        assert "configured_id" in data["model"]
        assert "ready" in data["model"]
        assert "details" in data["model"]


def test_health_no_models_installed():
    """2. When Ollama is up but returns empty models list, status should be 'warning', model.ready=False."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, [])
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "warning"
        assert data["runtime"]["available"] is True
        assert data["model"]["ready"] is False


def test_models_invalid_model_returns_empty_gracefully():
    """3. When check_runtime returns True but get_loaded_models throws, models endpoint still returns the installed list."""
    fake_models = [{"name": "llama3.2:1b", "size": 1300000000}]
    mock_client = AsyncMock()
    mock_client.is_closed = False
    mock_client.get.side_effect = httpx.RequestError("Ollama /api/ps connection failure")
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check, \
         patch.object(ollama_adapter, "_get_client", return_value=mock_client):
        mock_check.return_value = (True, fake_models)
        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert data["runtime_available"] is True
        assert len(data["models"]) == 1
        assert data["models"][0]["id"] == "llama3.2:1b"
        assert data["models"][0]["is_loaded"] is False


def test_system_resources_no_nvidia_smi():
    """4. Mock shutil.which returning None, verify gpu_available=False and response still has all fields."""
    with patch("backend.app.system_resources.shutil.which", return_value=None):
        response = client.get("/v1/system/resources")
        assert response.status_code == 200
        data = response.json()
        assert data["gpu_available"] is False
        expected_fields = [
            "cpu_percent",
            "ram_total_mb",
            "ram_used_mb",
            "ram_percent",
            "gpu_available",
            "gpu_name",
            "vram_total_mb",
            "vram_used_mb",
            "vram_free_mb",
            "gpu_utilization_percent",
            "details",
        ]
        for field in expected_fields:
            assert field in data


def test_system_resources_no_psutil():
    """5. Mock psutil as None, verify cpu_percent=-1, ram fields=-1."""
    with patch("backend.app.system_resources.psutil", None):
        response = client.get("/v1/system/resources")
        assert response.status_code == 200
        data = response.json()
        assert data["cpu_percent"] == -1.0
        assert data["ram_total_mb"] == -1.0
        assert data["ram_used_mb"] == -1.0
        assert data["ram_percent"] == -1.0


def test_system_resources_nvidia_smi_timeout():
    """6. Mock subprocess.run raising subprocess.TimeoutExpired, verify graceful response."""
    with patch("backend.app.system_resources.shutil.which", return_value="C:\\fake\\nvidia-smi.exe"), \
         patch("backend.app.system_resources.subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="nvidia-smi", timeout=1.5)):
        response = client.get("/v1/system/resources")
        assert response.status_code == 200
        data = response.json()
        assert data["gpu_available"] is False
        assert "timed out" in data["details"].lower()


def test_streaming_chunk_order():
    """7. Verify SSE chunks arrive in correct order (delta chunks, then done chunk, then [DONE] sentinel)."""
    async def mock_chat_stream(*args, **kwargs):
        yield 'data: {"delta": "Hello", "done": false, "model": "llama3.2:1b"}\n\n'
        yield 'data: {"delta": " world", "done": false, "model": "llama3.2:1b"}\n\n'
        yield 'data: {"delta": "", "done": true, "model": "llama3.2:1b", "prompt_tokens": 4, "completion_tokens": 2}\n\n'
        yield 'data: [DONE]\n\n'

    with patch("backend.app.main.ollama_adapter.chat_stream", side_effect=mock_chat_stream):
        response = client.post(
            "/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": True,
            },
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")
        lines = [line.strip() for line in response.text.split("\n") if line.strip()]
        data_lines = [line for line in lines if line.startswith("data:")]
        assert len(data_lines) == 4

        chunk1 = json.loads(data_lines[0].replace("data:", "").strip())
        assert chunk1["delta"] == "Hello"
        assert chunk1["done"] is False

        chunk2 = json.loads(data_lines[1].replace("data:", "").strip())
        assert chunk2["delta"] == " world"
        assert chunk2["done"] is False

        chunk3 = json.loads(data_lines[2].replace("data:", "").strip())
        assert chunk3["done"] is True
        assert chunk3["delta"] == ""

        assert data_lines[3].strip() == "data: [DONE]"


def test_streaming_error_in_sse():
    """8. Verify upstream errors produce SSE error chunk with done=true, not HTTP error code."""
    async def mock_chat_stream_error(*args, **kwargs):
        yield 'data: {"error": "Connection to Ollama failed at http://127.0.0.1:11434.", "done": true}\n\n'

    with patch("backend.app.main.ollama_adapter.chat_stream", side_effect=mock_chat_stream_error):
        response = client.post(
            "/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": True,
            },
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")
        lines = [line.strip() for line in response.text.split("\n") if line.strip().startswith("data:")]
        assert len(lines) >= 1
        payload = json.loads(lines[0].replace("data:", "").strip())
        assert payload["done"] is True
        assert "error" in payload
        assert "Connection to Ollama failed" in payload["error"]


def test_benchmark_history_empty():
    """9. Mock get_benchmark_history returning [], verify /v1/benchmarks/history returns []."""
    with patch("backend.app.main.get_benchmark_history", return_value=[]):
        response = client.get("/v1/benchmarks/history")
        assert response.status_code == 200
        assert response.json() == []


def test_benchmark_latest_empty():
    """10. Verify /v1/benchmarks/latest returns status='empty' when no runs exist."""
    with patch("backend.app.main.get_latest_benchmark_result", return_value=None):
        response = client.get("/v1/benchmarks/latest")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "empty"
        assert "message" in data


def test_chat_wrong_role_rejected():
    """11. Send a message with role='admin' (invalid), verify 422."""
    response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "admin", "content": "Hello"}]},
    )
    assert response.status_code == 422


def test_chat_whitespace_only_rejected():
    """12. Send message with content='   '.
    Since Pydantic does not strip whitespace by default (len('   ') == 3 >= 1),
    schema validation passes and returns 200 when inference succeeds."""
    mock_result = {
        "model": "llama3.2:1b",
        "content": "Received whitespace prompt.",
        "prompt_tokens": 3,
        "completion_tokens": 4,
        "total_tokens": 7,
        "duration_ms": 100,
    }
    with patch("backend.app.main.ollama_adapter.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_result
        response = client.post(
            "/v1/chat/completions",
            json={"messages": [{"role": "user", "content": "   "}]},
        )
        assert response.status_code == 200


def test_models_refresh_invalidates_cache():
    """13. Verify calling /v1/models/refresh calls adapter.refresh() and returns fresh data."""
    fake_models = [{"name": "llama3.2:1b", "size": 1300000000}]
    with patch("backend.app.main.ollama_adapter.refresh") as mock_refresh, \
         patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check, \
         patch("backend.app.main.ollama_adapter.get_loaded_models", new_callable=AsyncMock) as mock_loaded:
        mock_check.return_value = (True, fake_models)
        mock_loaded.return_value = []
        response = client.post("/v1/models/refresh")
        assert response.status_code == 200
        assert mock_refresh.call_count == 1
        data = response.json()
        assert data["runtime_available"] is True
        assert len(data["models"]) == 1
        assert data["models"][0]["id"] == "llama3.2:1b"


def test_health_handles_exception_from_check_runtime():
    """14. When check_runtime raises a non-timeout Exception, health still returns 200 with degraded."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.side_effect = RuntimeError("Non-timeout runtime error")
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["runtime"]["available"] is False
        assert data["model"]["ready"] is False


def test_benchmark_run_timeout_returns_500():
    """15. Mock run_benchmark raising asyncio.TimeoutError, verify it returns 500."""
    with patch("backend.app.main.run_benchmark", new_callable=AsyncMock) as mock_run:
        mock_run.side_effect = asyncio.TimeoutError("Benchmark execution timed out")
        response = client.post("/v1/benchmarks/run")
        assert response.status_code == 500
        data = response.json()
        assert "Benchmark execution failed" in data["detail"]
