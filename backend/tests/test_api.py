import asyncio
import httpx
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.ollama_adapter import (
    OllamaAdapter,
    RuntimeUnavailableError,
    ModelNotFoundError,
    InferenceTimeoutError,
)

client = TestClient(app)

def test_health_online():
    """Verify /health returns 200 and model_ready when Ollama is reachable."""
    fake_models = [{"name": "llama3.2:1b", "size": 1300000000}]
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, fake_models)
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["runtime"]["available"] is True
        assert data["model"]["ready"] is True
        assert "llama3.2:1b" in data["model"]["configured_id"]


def test_health_offline():
    """Verify /health reflects runtime unavailable gracefully."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (False, [])
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["runtime"]["available"] is False
        assert data["model"]["ready"] is False
        assert "unreachable" in data["model"]["details"].lower()


def test_models_list_online():
    """Verify /v1/models returns structured local models."""
    fake_models = [
        {"name": "llama3.2:1b", "size": 1300000000},
        {"name": "qwen2.5:1.5b", "size": 1800000000},
    ]
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, fake_models)
        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert data["runtime_available"] is True
        assert len(data["models"]) == 2
        assert data["models"][0]["id"] == "llama3.2:1b"
        assert data["default_model"] == "llama3.2:1b"


def test_models_list_default_selection_when_not_first():
    """Verify /v1/models selects configured llama3.2:1b even when 9B model appears first."""
    fake_models = [
        {"name": "richardyoung/qwythos-9b-abliterated:Q4_K_M", "size": 5629109190},
        {"name": "llama3.2:1b", "size": 1321098329},
    ]
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, fake_models)
        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert data["default_model"] == "llama3.2:1b"
        assert data["models"][0]["id"] == "richardyoung/qwythos-9b-abliterated:Q4_K_M"
        assert data["models"][0]["is_default"] is False
        assert data["models"][1]["id"] == "llama3.2:1b"
        assert data["models"][1]["is_default"] is True


def test_health_online_prefers_configured_model():
    """Verify /health reports configured llama3.2:1b when multiple models are present."""
    fake_models = [
        {"name": "richardyoung/qwythos-9b-abliterated:Q4_K_M", "size": 5629109190},
        {"name": "llama3.2:1b", "size": 1321098329},
    ]
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, fake_models)
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["model"]["configured_id"] == "llama3.2:1b"
        assert data["model"]["ready"] is True


@pytest.mark.anyio
async def test_resolve_model_uses_configured_default():
    """Verify resolve_model chooses llama3.2:1b over other installed models."""
    adapter = OllamaAdapter()
    fake_models = [
        {"name": "richardyoung/qwythos-9b-abliterated:Q4_K_M", "size": 5629109190},
        {"name": "llama3.2:1b", "size": 1321098329},
    ]
    with patch.object(adapter, "check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, fake_models)
        resolved = await adapter.resolve_model(None)
        assert resolved == "llama3.2:1b"


def test_models_list_offline():
    """Verify /v1/models returns empty list and runtime_available=False when offline."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (False, [])
        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert data["runtime_available"] is False
        assert data["models"] == []


def test_chat_validation_empty_body():
    """Verify request validation rejects empty payload."""
    response = client.post("/v1/chat/completions", json={})
    assert response.status_code == 422


def test_chat_validation_empty_messages():
    """Verify request validation rejects messages list with zero items."""
    response = client.post("/v1/chat/completions", json={"messages": []})
    assert response.status_code == 422


def test_chat_validation_empty_content():
    """Verify request validation rejects empty string content."""
    response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": ""}]},
    )
    assert response.status_code == 422


def test_chat_success_mocked():
    """Verify successful local inference with mocked adapter."""
    mock_result = {
        "model": "llama3.2:1b",
        "content": "Hello! I am running on your local machine.",
        "prompt_tokens": 8,
        "completion_tokens": 10,
        "total_tokens": 18,
        "duration_ms": 320,
    }
    with patch("backend.app.main.ollama_adapter.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_result
        response = client.post(
            "/v1/chat/completions",
            json={"messages": [{"role": "user", "content": "Hello local AI"}]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "local"
        assert data["model"] == "llama3.2:1b"
        assert data["message"]["role"] == "assistant"
        assert data["message"]["content"] == "Hello! I am running on your local machine."
        assert data["usage"]["total_tokens"] == 18
        assert data["inference_duration_ms"] == 320


def test_chat_runtime_unavailable_503():
    """Verify 503 is returned when Ollama is unreachable."""
    with patch("backend.app.main.ollama_adapter.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.side_effect = RuntimeUnavailableError("Ollama is offline")
        response = client.post(
            "/v1/chat/completions",
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
        assert response.status_code == 503
        assert "Ollama is offline" in response.json()["detail"]


def test_chat_model_not_found_404():
    """Verify 404 is returned when requested model is not installed."""
    with patch("backend.app.main.ollama_adapter.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.side_effect = ModelNotFoundError("Model not found in Ollama")
        response = client.post(
            "/v1/chat/completions",
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
        assert response.status_code == 404
        assert "Model not found" in response.json()["detail"]


def test_chat_timeout_504():
    """Verify 504 is returned when inference exceeds timeout."""
    with patch("backend.app.main.ollama_adapter.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.side_effect = InferenceTimeoutError("Inference timed out")
        response = client.post(
            "/v1/chat/completions",
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
        assert response.status_code == 504
        assert "timed out" in response.json()["detail"].lower()


def test_models_list_timeout():
    """Verify /v1/models handles timeout gracefully without blocking or hanging."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.side_effect = asyncio.TimeoutError("Call timed out")
        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert data["runtime_available"] is False
        assert data["models"] == []
        assert data["default_model"] is None


def test_health_timeout():
    """Verify /health returns degraded status immediately when check_runtime times out."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.side_effect = asyncio.TimeoutError("Call timed out")
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["runtime"]["available"] is False
        assert data["model"]["ready"] is False


def test_ollama_adapter_url_normalization():
    """Verify OllamaAdapter normalizes localhost to 127.0.0.1 on Windows."""
    adapter = OllamaAdapter(base_url="http://localhost:11434")
    assert adapter.base_url == "http://127.0.0.1:11434"
    assert "localhost" not in adapter.base_url


@pytest.mark.anyio
async def test_ollama_adapter_get_tags_timeout():
    """Verify get_tags() catches httpx TimeoutException and raises RuntimeUnavailableError."""
    adapter = OllamaAdapter(base_url="http://127.0.0.1:11434")
    mock_client = AsyncMock()
    mock_client.is_closed = False
    mock_client.get.side_effect = httpx.ReadTimeout("Read timed out")

    with patch.object(adapter, "_get_client", return_value=mock_client):
        with pytest.raises(RuntimeUnavailableError) as exc_info:
            await adapter.get_tags()
        assert "timed out" in str(exc_info.value).lower()


@pytest.mark.anyio
async def test_ollama_adapter_cache():
    """Verify get_tags() caches results for short TTL to prevent redundant I/O."""
    adapter = OllamaAdapter(base_url="http://127.0.0.1:11434")
    fake_response = MagicMock()
    fake_response.raise_for_status = MagicMock()
    fake_response.json.return_value = {"models": [{"name": "test-model:latest"}]}

    mock_client = AsyncMock()
    mock_client.is_closed = False
    mock_client.get.return_value = fake_response

    with patch.object(adapter, "_get_client", return_value=mock_client):
        # First call fetches from client
        res1 = await adapter.get_tags()
        assert len(res1) == 1
        assert res1[0]["name"] == "test-model:latest"
        assert mock_client.get.call_count == 1

        # Second immediate call returns from cache
        res2 = await adapter.get_tags()
        assert len(res2) == 1
        assert mock_client.get.call_count == 1


def test_chat_completions_streaming_success():
    """Verify /v1/chat/completions with stream=True returns SSE text/event-stream."""
    async def mock_chat_stream(*args, **kwargs):
        yield 'data: {"delta": "Hello", "done": false, "model": "llama3.2:1b"}\n\n'
        yield 'data: {"delta": " world!", "done": false, "model": "llama3.2:1b"}\n\n'
        yield 'data: {"delta": "", "done": true, "model": "llama3.2:1b", "duration_ms": 250}\n\n'
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
        text = response.text
        assert "Hello" in text
        assert "world!" in text
        assert "[DONE]" in text


def test_chat_completions_streaming_error_stream():
    """Verify /v1/chat/completions with stream=True handles runtime errors within SSE stream."""
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
        text = response.text
        assert "Connection to Ollama failed" in text

