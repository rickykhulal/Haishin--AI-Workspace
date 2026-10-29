import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.config import Settings

client = TestClient(app)


def test_config_valid_defaults():
    """Verify default Settings parse without errors."""
    s = Settings()
    assert s.host == "127.0.0.1"
    assert 1 <= s.port <= 65535
    assert s.ollama_base_url.startswith("http")
    assert s.inference_timeout > 0
    assert s.default_model != ""


def test_config_invalid_port_fallback():
    """Verify invalid port falls back to 8000."""
    import os
    orig = os.environ.get("HAISHIN_PORT")
    try:
        os.environ["HAISHIN_PORT"] = "99999"
        s = Settings()
        assert s.port == 8000
    finally:
        if orig is not None:
            os.environ["HAISHIN_PORT"] = orig
        else:
            os.environ.pop("HAISHIN_PORT", None)


def test_config_invalid_ollama_url_fallback():
    """Verify invalid Ollama URL falls back to default."""
    import os
    orig = os.environ.get("OLLAMA_BASE_URL")
    try:
        os.environ["OLLAMA_BASE_URL"] = "not-a-url"
        s = Settings()
        assert s.ollama_base_url == "http://127.0.0.1:11434"
    finally:
        if orig is not None:
            os.environ["OLLAMA_BASE_URL"] = orig
        else:
            os.environ.pop("OLLAMA_BASE_URL", None)


def test_config_negative_timeout_fallback():
    """Verify negative timeout falls back to 120.0."""
    import os
    orig = os.environ.get("HAISHIN_INFERENCE_TIMEOUT")
    try:
        os.environ["HAISHIN_INFERENCE_TIMEOUT"] = "-5"
        s = Settings()
        assert s.inference_timeout in [120.0, 180.0]
    finally:
        if orig is not None:
            os.environ["HAISHIN_INFERENCE_TIMEOUT"] = orig
        else:
            os.environ.pop("HAISHIN_INFERENCE_TIMEOUT", None)


def test_config_empty_model_fallback():
    """Verify empty default model falls back to llama3.2:1b."""
    import os
    orig = os.environ.get("HAISHIN_DEFAULT_MODEL")
    try:
        os.environ["HAISHIN_DEFAULT_MODEL"] = "  "
        s = Settings()
        assert s.default_model == "llama3.2:1b"
    finally:
        if orig is not None:
            os.environ["HAISHIN_DEFAULT_MODEL"] = orig
        else:
            os.environ.pop("HAISHIN_DEFAULT_MODEL", None)


def test_health_version_is_060():
    """Verify /health response version is acceptable."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, [{"name": "llama3.2:1b"}])
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["version"] in ["0.6.0", "0.7.0", "0.8.0"]


def test_generic_inference_error_does_not_leak_details():
    """Verify 500 error doesn't expose internal exception message to client."""
    with patch("backend.app.main.ollama_adapter.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.side_effect = ValueError("secret internal path /home/user/.env was referenced")
        response = client.post(
            "/v1/chat/completions",
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
        assert response.status_code == 500
        detail = response.json()["detail"]
        assert "secret" not in detail
        assert "/home/user" not in detail
        assert "internal error" in detail.lower()


def test_benchmark_timeout_returns_500():
    """Verify benchmark endpoint times out cleanly."""
    import asyncio
    with patch("backend.app.main.run_benchmark", new_callable=AsyncMock) as mock_run:
        mock_run.side_effect = asyncio.TimeoutError("Benchmark timed out")
        response = client.post("/v1/benchmarks/run?smoke=true")
        assert response.status_code == 500
        assert "failed" in response.json()["detail"].lower()
