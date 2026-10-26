import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.benchmarks.prompts import BENCHMARK_PROMPTS, get_prompts
from backend.benchmarks.evaluator import evaluate_output
from backend.benchmarks.runner import generate_markdown_report

client = TestClient(app)


def test_system_resources_endpoint():
    """Verify /v1/system/resources returns valid hardware metrics."""
    response = client.get("/v1/system/resources")
    assert response.status_code == 200
    data = response.json()
    assert "cpu_percent" in data
    assert "ram_total_mb" in data
    assert "ram_percent" in data
    assert "gpu_available" in data
    assert isinstance(data["gpu_available"], bool)
    if data["gpu_available"]:
        assert data["gpu_name"] is not None
        assert data["vram_total_mb"] is not None


def test_models_loaded_distinction():
    """Verify installed models correctly distinguish loaded state and VRAM."""
    fake_installed = [
        {"name": "llama3.2:1b", "size": 1321098329, "details": {"parameter_size": "1.2B"}},
        {"name": "qwen2.5:1.5b", "size": 1800000000, "details": {"parameter_size": "1.5B"}},
    ]
    fake_loaded = [
        {"name": "llama3.2:1b", "size_vram": 1321098329},
    ]

    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check, \
         patch("backend.app.main.ollama_adapter.get_loaded_models", new_callable=AsyncMock) as mock_loaded:
        mock_check.return_value = (True, fake_installed)
        mock_loaded.return_value = fake_loaded

        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        models = data["models"]
        assert len(models) == 2

        llama = next(m for m in models if m["id"] == "llama3.2:1b")
        assert llama["is_loaded"] is True
        assert llama["vram_bytes"] == 1321098329
        assert llama["parameter_size"] == "1.2B"

        qwen = next(m for m in models if m["id"] == "qwen2.5:1.5b")
        assert qwen["is_loaded"] is False
        assert qwen["vram_bytes"] is None


def test_models_refresh_endpoint():
    """Verify /v1/models/refresh calls adapter.refresh() and returns updated list."""
    with patch("backend.app.main.ollama_adapter.refresh") as mock_refresh, \
         patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check, \
         patch("backend.app.main.ollama_adapter.get_loaded_models", new_callable=AsyncMock) as mock_loaded:
        mock_check.return_value = (True, [{"name": "llama3.2:1b"}])
        mock_loaded.return_value = []

        response = client.post("/v1/models/refresh")
        assert response.status_code == 200
        assert mock_refresh.call_count == 1
        data = response.json()
        assert len(data["models"]) == 1


def test_invalid_model_selection_rejected():
    """Verify requesting an uninstalled model returns 404 rather than silently breaking."""
    fake_installed = [{"name": "llama3.2:1b"}]
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = (True, fake_installed)
        response = client.post(
            "/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": "hi"}],
                "model": "non-existent-model-xyz",
            },
        )
        assert response.status_code == 404
        assert "not installed in Ollama" in response.json()["detail"]


def test_benchmark_prompts_coverage():
    """Verify benchmark prompts cover required categories with valid schemas."""
    assert len(BENCHMARK_PROMPTS) >= 15
    categories = {p["category"] for p in BENCHMARK_PROMPTS}
    expected_categories = {
        "factual",
        "reasoning",
        "instruction_following",
        "coding",
        "summarization",
        "structured_output",
    }
    assert expected_categories.issubset(categories)

    smoke_prompts = get_prompts(smoke_only=True)
    assert len(smoke_prompts) >= 2
    for p in BENCHMARK_PROMPTS:
        assert p["id"]
        assert p["prompt"]
        assert p["timeout"] > 0
        assert p["evaluation_type"] in ("deterministic", "approximate")


def test_benchmark_evaluators_logic():
    """Verify deterministic evaluators accurately pass and fail outputs."""
    # Factual
    passed, _, _ = evaluate_output("fact-capital-nepal", "The capital of Nepal is Kathmandu.")
    assert passed is True
    failed, _, _ = evaluate_output("fact-capital-nepal", "The capital is London.")
    assert failed is False

    # Arithmetic
    passed, _, _ = evaluate_output("reason-mult-17x4", "The answer is 68.")
    assert passed is True
    failed, _, _ = evaluate_output("reason-mult-17x4", "The answer is 72.")
    assert failed is False

    # Instruction: all caps
    passed, _, _ = evaluate_output("inst-all-caps-confirmed", "CONFIRMED")
    assert passed is True
    failed, _, _ = evaluate_output("inst-all-caps-confirmed", "confirmed, thank you")
    assert failed is False

    # Structured: JSON
    passed, _, _ = evaluate_output("struct-json-book", '{"title": "1984", "author": "George Orwell", "year": 1949}')
    assert passed is True
    failed, _, _ = evaluate_output("struct-json-book", 'Not a json document')
    assert failed is False


def test_generate_markdown_report():
    """Verify Markdown report generator formats summaries cleanly."""
    fake_summary = {
        "benchmark_version": "1.0",
        "run_id": "bench_test_123",
        "timestamp": "2026-10-16T10:00:00Z",
        "model_id": "llama3.2:1b",
        "is_smoke": True,
        "total_prompts": 3,
        "passed": 3,
        "failed": 0,
        "timed_out": 0,
        "errored": 0,
        "pass_rate_percent": 100.0,
        "total_duration_ms": 3200,
        "avg_latency_ms": 1066.7,
        "avg_tokens_per_sec": 38.5,
        "results": [
            {
                "id": "fact-capital-nepal",
                "category": "factual",
                "evaluation_type": "deterministic",
                "passed": True,
                "latency_ms": 950,
                "tokens_per_sec": 40.2,
                "reason": "Correctly identified Kathmandu.",
            }
        ],
    }
    md = generate_markdown_report(fake_summary)
    assert "# Haishin Benchmark Report" in md
    assert "bench_test_123" in md
    assert "100.0%" in md
    assert "llama3.2:1b" in md
