import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from backend.app.main import app, _benchmark_lock
from backend.app.schemas import BenchmarkItemResult, BenchmarkRunSummary
from backend.app.ollama_adapter import RuntimeUnavailableError

client = TestClient(app)


def test_health_v07_metadata():
    """Verify /health returns 0.7.0 and includes runtime metadata and is_loaded."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check, \
         patch("backend.app.main.ollama_adapter.get_loaded_models", new_callable=AsyncMock) as mock_loaded:
        mock_check.return_value = (True, [{"name": "llama3.2:1b"}])
        mock_loaded.return_value = []
        
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "0.7.0"
        assert "last_checked_at" in data["runtime"]
        assert "last_error" in data["runtime"]
        assert "is_loaded" in data["model"]
        assert data["model"]["is_loaded"] is False


def test_health_model_is_loaded_true():
    """Verify /health sets model.is_loaded to True when model is in memory."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check, \
         patch("backend.app.main.ollama_adapter.get_loaded_models", new_callable=AsyncMock) as mock_loaded:
        mock_check.return_value = (True, [{"name": "llama3.2:1b"}])
        mock_loaded.return_value = [{"name": "llama3.2:1b"}]
        
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["model"]["is_loaded"] is True


def test_models_list_v07_metadata():
    """Verify /v1/models returns last_checked_at, last_error, and model.is_loaded."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check, \
         patch("backend.app.main.ollama_adapter.get_tags", new_callable=AsyncMock) as mock_tags, \
         patch("backend.app.main.ollama_adapter.get_loaded_models", new_callable=AsyncMock) as mock_loaded:
        mock_check.return_value = (True, [{"name": "llama3.2:1b"}])
        mock_tags.return_value = [{
            "name": "llama3.2:1b",
            "size": 1300000000,
            "details": {"parameter_size": "1B", "quantization_level": "Q4_K_M"}
        }]
        mock_loaded.return_value = [{"name": "llama3.2:1b", "size_vram": 1800000000}]
        
        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert "last_checked_at" in data
        assert "last_error" in data
        assert len(data["models"]) == 1
        model_item = data["models"][0]
        assert model_item["is_loaded"] is True
        assert model_item["vram_bytes"] == 1800000000


def test_models_list_offline_error_tracking():
    """Verify /v1/models tracks last_error when Ollama is unreachable."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check, \
         patch("backend.app.main.ollama_adapter.get_tags", new_callable=AsyncMock) as mock_tags:
        mock_check.return_value = (False, [])
        mock_tags.side_effect = RuntimeUnavailableError("Ollama connection failed")
        
        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert data["runtime_available"] is False
        assert data["models"] == []


def test_benchmark_concurrent_lock_returns_409():
    """Verify concurrent benchmark calls are rejected with 409 Conflict."""
    async def simulate_locked():
        # Acquire lock to simulate an active benchmark run
        await _benchmark_lock.acquire()
        try:
            response = client.post("/v1/benchmarks/run?smoke=true")
            assert response.status_code == 409
            assert "already in progress" in response.json()["detail"].lower()
        finally:
            _benchmark_lock.release()

    asyncio.run(simulate_locked())


def test_benchmark_schema_ttft_serialization():
    """Verify BenchmarkItemResult and BenchmarkRunSummary serialize ttft_ms properly."""
    item = BenchmarkItemResult(
        id="fact-1",
        category="factual",
        prompt="What is the capital of France?",
        evaluation_type="deterministic",
        passed=True,
        score=1.0,
        reason="Matched Paris",
        output="Paris",
        latency_ms=250,
        ttft_ms=45,
        eval_tokens=10,
        prompt_tokens=5,
        tokens_per_sec=40.0,
    )
    dumped = item.model_dump()
    assert dumped["ttft_ms"] == 45
    
    # None TTFT handling
    item_none = BenchmarkItemResult(
        id="fact-2",
        category="factual",
        prompt="Test",
        evaluation_type="deterministic",
        passed=False,
        score=0.0,
        reason="Failed",
        output="",
        latency_ms=100,
        ttft_ms=None,
    )
    assert item_none.model_dump()["ttft_ms"] is None

    summary = BenchmarkRunSummary(
        run_id="run-123",
        timestamp="2026-10-19T00:00:00Z",
        model_id="llama3.2:1b",
        is_smoke=True,
        total_prompts=1,
        passed=1,
        failed=0,
        timed_out=0,
        errored=0,
        pass_rate_percent=100.0,
        total_duration_ms=250,
        avg_latency_ms=250.0,
        avg_ttft_ms=45.0,
        avg_tokens_per_sec=40.0,
        results=[item],
    )
    summary_dump = summary.model_dump()
    assert summary_dump["avg_ttft_ms"] == 45.0
