import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from backend.app.main import app, _active_continuation_locks
from backend.app.ollama_adapter import (
    OllamaAdapter,
    VisionUnsupportedError,
    InferenceError,
)

client = TestClient(app)

SMALL_MODEL = "llama3.2:1b"
LARGE_MODEL = "richardyoung/qwythos-9b-abliterated:Q4_K_M"


def test_chat_continuation_success_non_streaming():
    """Verify /v1/chat/continue executes prefix continuation and returns continuation text."""
    with patch("backend.app.main.ollama_adapter.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = {
            "model": SMALL_MODEL,
            "content": " 3, 4, 5.",
            "prompt_tokens": 12,
            "completion_tokens": 6,
            "total_tokens": 18,
            "duration_ms": 250,
            "done_reason": "stop",
        }
        payload = {
            "conversation_id": "conv-123",
            "parent_message_id": "msg-assistant-1",
            "messages": [
                {"role": "user", "content": "Count from 1 to 5."},
                {"role": "assistant", "content": "1, 2,"},
            ],
            "model": SMALL_MODEL,
            "stream": False,
        }
        response = client.post("/v1/chat/continue", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["parent_message_id"] == "msg-assistant-1"
        assert data["continuation"] == " 3, 4, 5."
        assert data["done_reason"] == "stop"
        assert data["model"] == SMALL_MODEL
        mock_chat.assert_called_once()
        sent_messages = mock_chat.call_args[1]["messages"]
        assert sent_messages[-1]["role"] == "assistant"
        assert sent_messages[-1]["content"] == "1, 2,"


def test_chat_continuation_rejected_when_last_msg_is_not_assistant():
    """Verify /v1/chat/continue rejects when last message in history is a user turn."""
    payload = {
        "parent_message_id": "msg-123",
        "messages": [
            {"role": "user", "content": "Hello"},
        ],
        "model": SMALL_MODEL,
    }
    response = client.post("/v1/chat/continue", json=payload)
    assert response.status_code == 400
    assert "must have role 'assistant'" in response.json()["detail"]


def test_chat_continuation_rejected_when_assistant_content_empty():
    """Verify /v1/chat/continue rejects continuation of an empty message."""
    payload = {
        "parent_message_id": "msg-123",
        "messages": [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "   "},
        ],
        "model": SMALL_MODEL,
    }
    response = client.post("/v1/chat/continue", json=payload)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_chat_continuation_concurrent_lock_returns_409():
    """Verify concurrent continuation request on same message is rejected with 409."""
    _active_continuation_locks.add("msg-locked-456")
    try:
        payload = {
            "parent_message_id": "msg-locked-456",
            "messages": [
                {"role": "user", "content": "Count to 5"},
                {"role": "assistant", "content": "1, 2"},
            ],
            "model": SMALL_MODEL,
        }
        response = client.post("/v1/chat/continue", json=payload)
        assert response.status_code == 409
        assert "already active" in response.json()["detail"].lower()
    finally:
        _active_continuation_locks.discard("msg-locked-456")


def test_chat_options_forwarding():
    """Verify num_predict and num_ctx generation options are forwarded to adapter."""
    with patch("backend.app.main.ollama_adapter.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = {
            "model": SMALL_MODEL,
            "content": "Test response",
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15,
            "duration_ms": 300,
            "done_reason": "length",
        }
        payload = {
            "messages": [{"role": "user", "content": "Say test"}],
            "model": SMALL_MODEL,
            "temperature": 0.5,
            "num_predict": 50,
            "num_ctx": 4096,
        }
        response = client.post("/v1/chat/completions", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["done_reason"] == "length"
        mock_chat.assert_called_once()
        kwargs = mock_chat.call_args[1]
        assert kwargs["temperature"] == 0.5
        assert kwargs["num_predict"] == 50
        assert kwargs["num_ctx"] == 4096


def test_thinking_token_fallback():
    """Verify adapter falls back to thinking when content is empty."""
    adapter = OllamaAdapter()
    raw_data = {
        "model": "richardyoung/qwythos-9b-abliterated:Q4_K_M",
        "message": {
            "role": "assistant",
            "content": "",
            "thinking": "1. Analyze step by step. Conclusion reached.",
        },
        "done": True,
        "done_reason": "length",
        "eval_count": 25,
        "prompt_eval_count": 10,
    }
    with patch.object(adapter, "resolve_model", new_callable=AsyncMock) as mock_resolve, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_resolve.return_value = LARGE_MODEL
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = raw_data
        mock_post.return_value = mock_response

        result = asyncio.run(adapter.chat([{"role": "user", "content": "Reason"}], model=LARGE_MODEL))
        assert result["content"] == "1. Analyze step by step. Conclusion reached."
        assert result["thinking"] == "1. Analyze step by step. Conclusion reached."
        assert result["done_reason"] == "length"


def test_vision_unsupported_error_on_text_model():
    """Verify passing an image to text-only model returns HTTP 400."""
    with patch("backend.app.main.ollama_adapter.check_runtime", new_callable=AsyncMock) as mock_check, \
         patch("backend.app.main.ollama_adapter.is_vision_model", new_callable=AsyncMock) as mock_vision:
        mock_check.return_value = (True, [{"name": SMALL_MODEL}])
        mock_vision.return_value = False
        payload = {
            "messages": [
                {
                    "role": "user",
                    "content": "Describe this image",
                    "images": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="],
                }
            ],
            "model": SMALL_MODEL,
        }
        response = client.post("/v1/chat/completions", json=payload)
        assert response.status_code == 400
        assert "text-only" in response.json()["detail"].lower()
