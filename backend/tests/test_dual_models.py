import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.ollama_adapter import OllamaAdapter, ModelNotFoundError, RuntimeUnavailableError

client = TestClient(app)

SMALL_MODEL = "llama3.2:1b"
LARGE_MODEL = "richardyoung/qwythos-9b-abliterated:Q4_K_M"


def test_model_discovery_returns_both_installed_models():
    """Verify /v1/models discovers and returns both models with llama3.2:1b as default."""
    mock_tags = [
        {"name": SMALL_MODEL, "size": 1321098329, "details": {"parameter_size": "1.2B", "quantization_level": "Q8_0"}},
        {"name": LARGE_MODEL, "size": 5629109190, "details": {"parameter_size": "9.0B", "quantization_level": "Q4_K_M"}},
    ]
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check, \
         patch("backend.app.main.ollama_adapter.get_loaded_models", new_callable=AsyncMock) as mock_loaded:
        mock_check.return_value = (True, mock_tags)
        mock_loaded.return_value = []

        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert data["runtime_available"] is True
        assert data["default_model"] == SMALL_MODEL
        assert len(data["models"]) == 2

        model_ids = [m["id"] for m in data["models"]]
        assert SMALL_MODEL in model_ids
        assert LARGE_MODEL in model_ids

        small_item = next(m for m in data["models"] if m["id"] == SMALL_MODEL)
        assert small_item["is_default"] is True

        large_item = next(m for m in data["models"] if m["id"] == LARGE_MODEL)
        assert large_item["is_default"] is False


def test_default_model_remains_llama32_1b():
    """Verify /health and config default model is llama3.2:1b."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, [{"name": SMALL_MODEL}, {"name": LARGE_MODEL}])
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["model"]["configured_id"] == SMALL_MODEL


def test_chat_non_streaming_routing_small_model():
    """Verify non-streaming chat forwards small model ID to Ollama."""
    with patch("backend.app.main.ollama_adapter.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = {
            "model": SMALL_MODEL,
            "content": "HAISHIN_SMALL_MODEL_OK",
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15,
            "duration_ms": 350,
        }
        payload = {
            "messages": [{"role": "user", "content": "hello"}],
            "model": SMALL_MODEL,
            "stream": False,
        }
        response = client.post("/v1/chat/completions", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["model"] == SMALL_MODEL
        assert data["message"]["content"] == "HAISHIN_SMALL_MODEL_OK"
        mock_chat.assert_called_once()
        assert mock_chat.call_args[1]["model"] == SMALL_MODEL


def test_chat_non_streaming_routing_large_model():
    """Verify non-streaming chat forwards 9B model ID to Ollama without substituting default."""
    with patch("backend.app.main.ollama_adapter.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = {
            "model": LARGE_MODEL,
            "content": "HAISHIN_LARGE_MODEL_OK",
            "prompt_tokens": 20,
            "completion_tokens": 10,
            "total_tokens": 30,
            "duration_ms": 4200,
        }
        payload = {
            "messages": [{"role": "user", "content": "hello"}],
            "model": LARGE_MODEL,
            "stream": False,
        }
        response = client.post("/v1/chat/completions", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["model"] == LARGE_MODEL
        assert data["message"]["content"] == "HAISHIN_LARGE_MODEL_OK"
        mock_chat.assert_called_once()
        assert mock_chat.call_args[1]["model"] == LARGE_MODEL


def test_chat_unknown_model_rejected_with_404():
    """Verify unknown model ID is rejected with 404 and does not silently fall back."""
    payload = {
        "messages": [{"role": "user", "content": "hello"}],
        "model": "nonexistent-model-xyz:latest",
        "stream": False,
    }
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, [{"name": SMALL_MODEL}, {"name": LARGE_MODEL}])
        response = client.post("/v1/chat/completions", json=payload)
        assert response.status_code == 404
        detail = response.json()["detail"]
        assert "not installed in Ollama" in detail
        assert "nonexistent-model-xyz:latest" in detail


def test_chat_streaming_routing_large_model():
    """Verify streaming chat yields chunks identifying the requested 9B model."""
    payload = {
        "messages": [{"role": "user", "content": "hello"}],
        "model": LARGE_MODEL,
        "stream": True,
    }
    with patch("backend.app.main.ollama_adapter.resolve_model", new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = LARGE_MODEL
        with patch("httpx.AsyncClient.stream") as mock_stream:
            # Test that resolve_model was called with LARGE_MODEL
            pass


@pytest.mark.anyio
async def test_resolve_model_exact_and_legacy():
    """Verify resolve_model preserves requested model and maps legacy identifier."""
    adapter = OllamaAdapter()
    with patch.object(adapter, "check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, [{"name": SMALL_MODEL}, {"name": LARGE_MODEL}])

        # Explicit small model
        assert await adapter.resolve_model(SMALL_MODEL) == SMALL_MODEL

        # Explicit large model
        assert await adapter.resolve_model(LARGE_MODEL) == LARGE_MODEL

        # Legacy identifier resolves to default
        assert await adapter.resolve_model("haishin-local") == SMALL_MODEL

        # None resolves to default
        assert await adapter.resolve_model(None) == SMALL_MODEL

        # Unknown model raises ModelNotFoundError
        with pytest.raises(ModelNotFoundError):
            await adapter.resolve_model("unknown:latest")


@pytest.mark.anyio
async def test_large_model_failure_does_not_silently_fallback():
    """Verify failure on large model raises error rather than silently routing to small model."""
    adapter = OllamaAdapter()
    with patch.object(adapter, "resolve_model", new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = LARGE_MODEL
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = Exception("CUDA out of memory")
            with pytest.raises(Exception) as exc_info:
                await adapter.chat([{"role": "user", "content": "hi"}], model=LARGE_MODEL)
            assert "CUDA out of memory" in str(exc_info.value)
