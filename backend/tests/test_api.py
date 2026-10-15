import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.ollama_adapter import (
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
