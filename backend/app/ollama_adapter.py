import asyncio
import json
import time
import httpx
from typing import List, Dict, Any, Tuple, Optional, AsyncGenerator
from .config import settings

# Bounded timeouts for lightweight model-listing and health operations
TAGS_CONNECT_TIMEOUT = 1.5
TAGS_READ_TIMEOUT = 2.0
TAGS_TOTAL_TIMEOUT = 2.5
TAGS_CACHE_TTL = 2.0  # seconds cache to prevent I/O stampede on Ollama

class OllamaError(Exception):
    """Base exception for Ollama adapter."""
    pass

class RuntimeUnavailableError(OllamaError):
    """Raised when Ollama local HTTP service is unreachable."""
    pass

class ModelNotFoundError(OllamaError):
    """Raised when the requested model is not installed in Ollama."""
    pass

class InferenceTimeoutError(OllamaError):
    """Raised when inference takes longer than configured timeout."""
    pass

class InferenceError(OllamaError):
    """Raised when Ollama returns an error status or malformed output."""
    pass


class OllamaAdapter:
    """Decoupled client adapter for local Ollama HTTP API with status telemetry."""

    def __init__(self, base_url: Optional[str] = None, timeout: Optional[float] = None):
        raw_url = (base_url or settings.ollama_base_url).rstrip("/")
        # Normalize localhost to 127.0.0.1 on Windows to avoid IPv6 connect delays
        if "://localhost" in raw_url:
            raw_url = raw_url.replace("://localhost", "://127.0.0.1")
        self.base_url = raw_url
        self.timeout = timeout or settings.inference_timeout
        self._client: Optional[httpx.AsyncClient] = None
        self._cached_tags: List[Dict[str, Any]] = []
        self._tags_cache_time: float = 0.0
        self._lock: Optional[asyncio.Lock] = None
        self.last_checked_at: Optional[str] = None
        self.last_error: Optional[str] = None

    def _get_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
                trust_env=False,  # Bypass system proxy for local loopback IPC
            )
        return self._client

    async def close(self) -> None:
        """Close persistent HTTP client session cleanly."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def get_tags(self) -> List[Dict[str, Any]]:
        """
        Fetch installed models from Ollama /api/tags with bounded timeout.
        Does NOT load model weights or run inference.
        Uses asyncio.Lock to avoid stampede / duplicate concurrent queries.
        """
        now = time.monotonic()
        if self._cached_tags and (now - self._tags_cache_time) < TAGS_CACHE_TTL:
            return self._cached_tags

        async with self._get_lock():
            # Recheck after acquiring lock in case another task refreshed the cache
            now = time.monotonic()
            if self._cached_tags and (now - self._tags_cache_time) < TAGS_CACHE_TTL:
                return self._cached_tags

            url = f"{self.base_url}/api/tags"
            client = await self._get_client()
            timeout = httpx.Timeout(
                connect=TAGS_CONNECT_TIMEOUT,
                read=TAGS_READ_TIMEOUT,
                write=1.5,
                pool=1.0,
            )

            try:
                response = await asyncio.wait_for(
                    client.get(url, timeout=timeout),
                    timeout=TAGS_TOTAL_TIMEOUT,
                )
                response.raise_for_status()
                data = response.json()
                models = data.get("models", [])
                self._cached_tags = models
                self._tags_cache_time = time.monotonic()
                self.last_checked_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                self.last_error = None
                return models
            except (httpx.TimeoutException, asyncio.TimeoutError) as exc:
                err_msg = f"Ollama local runtime timed out on /api/tags at {self.base_url}."
                self.last_checked_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                self.last_error = err_msg
                raise RuntimeUnavailableError(err_msg) from exc
            except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
                err_msg = f"Ollama local runtime is unreachable at {self.base_url}. Ensure Ollama is running."
                self.last_checked_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                self.last_error = err_msg
                raise RuntimeUnavailableError(err_msg) from exc
            except (httpx.HTTPError, OSError) as exc:
                err_msg = f"Ollama returned HTTP/network error on /api/tags: {exc}"
                self.last_checked_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                self.last_error = err_msg
                raise RuntimeUnavailableError(err_msg) from exc
            except Exception as exc:
                err_msg = f"Failed to fetch models from Ollama runtime: {exc}"
                self.last_checked_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                self.last_error = err_msg
                raise RuntimeUnavailableError(err_msg) from exc

    async def get_loaded_models(self) -> List[Dict[str, Any]]:
        """
        Fetch actively running/loaded models from Ollama /api/ps.
        Returns empty list if Ollama is unreachable or no model is loaded.
        Does NOT block or throw.
        """
        url = f"{self.base_url}/api/ps"
        client = await self._get_client()
        timeout = httpx.Timeout(
            connect=TAGS_CONNECT_TIMEOUT,
            read=TAGS_READ_TIMEOUT,
            write=1.5,
            pool=1.0,
        )
        try:
            response = await asyncio.wait_for(
                client.get(url, timeout=timeout),
                timeout=TAGS_TOTAL_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("models", [])
        except Exception:
            return []

    def refresh(self) -> None:
        """Invalidate cached tags to force a fresh query to Ollama runtime."""
        self._cached_tags = []
        self._tags_cache_time = 0.0

    async def check_runtime(self) -> Tuple[bool, List[Dict[str, Any]]]:
        """Check if runtime is up and retrieve installed models without blocking."""
        try:
            models = await self.get_tags()
            return True, models
        except Exception:
            return False, []

    async def resolve_model(self, requested_model: Optional[str] = None) -> str:
        """
        Determine which model to invoke.
        Precedence:
        1. Explicit valid requested model.
        2. Configured HAISHIN_DEFAULT_MODEL if installed.
        3. First installed model in Ollama.
        """
        available, models = await self.check_runtime()
        if not available:
            raise RuntimeUnavailableError(
                f"Ollama runtime is not reachable at {self.base_url}."
            )

        installed_names = [m.get("name", "") for m in models if m.get("name")]
        # Also include short names (e.g. 'llama3.2:1b' if name is 'llama3.2:1b')
        if not installed_names:
            raise ModelNotFoundError(
                "Ollama is running, but no models are currently installed. "
                "Download a model using: 'ollama pull <model_id>'."
            )

        # 1. If explicitly requested
        if requested_model:
            # Map legacy identifier to configured default model
            if requested_model == "haishin-local":
                requested_model = settings.default_model

            # Match exact or prefix
            if requested_model in installed_names:
                return requested_model
            # Match without tag if requested without tag
            matched = [name for name in installed_names if name.startswith(requested_model)]
            if matched:
                return matched[0]
            raise ModelNotFoundError(
                f"Requested model '{requested_model}' is not installed in Ollama. "
                f"Installed models: {', '.join(installed_names)}."
            )

        # 2. Configured default
        if settings.default_model:
            if settings.default_model in installed_names:
                return settings.default_model
            matched = [name for name in installed_names if name.startswith(settings.default_model)]
            if matched:
                return matched[0]

        # 3. Fallback to first available model
        return installed_names[0]

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Send chat completion to Ollama /api/chat with timing and error translation."""
        target_model = await self.resolve_model(model)
        url = f"{self.base_url}/api/chat"

        payload: Dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "stream": False,
        }
        if temperature is not None:
            payload["options"] = {"temperature": temperature}

        start_time = time.perf_counter()

        try:
            async with httpx.AsyncClient(timeout=self.timeout, trust_env=False) as client:
                response = await client.post(url, json=payload)

                if response.status_code == 404:
                    raise ModelNotFoundError(
                        f"Model '{target_model}' was reported missing by Ollama runtime."
                    )
                response.raise_for_status()
                data = response.json()

        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            raise RuntimeUnavailableError(
                f"Connection to Ollama failed during inference at {url}."
            ) from exc
        except httpx.TimeoutException as exc:
            raise InferenceTimeoutError(
                f"Inference timed out after {self.timeout} seconds for model '{target_model}'. "
                "The model may be too large for available GPU VRAM or busy loading."
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise InferenceError(
                f"Ollama returned HTTP error {exc.response.status_code}: {exc.response.text}"
            ) from exc
        except Exception as exc:
            raise InferenceError(f"Unexpected inference error: {str(exc)}") from exc

        duration_ms = int((time.perf_counter() - start_time) * 1000)

        assistant_msg = data.get("message", {})
        # Validate that Ollama returned actual content; raise if empty to avoid silent failures
        if not isinstance(assistant_msg, dict) or not assistant_msg.get("content"):
            raise InferenceError("Ollama returned empty content for the model response.")
        content = assistant_msg.get("content", "")

        return {
            "model": target_model,
            "content": content,
            "prompt_tokens": data.get("prompt_eval_count"),
            "completion_tokens": data.get("eval_count"),
            "total_tokens": (data.get("prompt_eval_count") or 0) + (data.get("eval_count") or 0),
            "duration_ms": duration_ms,
        }

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Progressively stream chat completion chunks from Ollama /api/chat as SSE events.
        Enforces proper error reporting, clean cancellation on disconnect, and token stats on done.
        """
        try:
            target_model = await self.resolve_model(model)
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc), 'done': True})}\n\n"
            return

        url = f"{self.base_url}/api/chat"
        payload: Dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "stream": True,
        }
        if temperature is not None:
            payload["options"] = {"temperature": temperature}

        start_time = time.perf_counter()
        client = httpx.AsyncClient(timeout=self.timeout, trust_env=False)
        try:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code == 404:
                    err_msg = f"Model '{target_model}' was reported missing by Ollama runtime."
                    yield f"data: {json.dumps({'error': err_msg, 'done': True})}\n\n"
                    return
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line or not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                    except Exception:
                        continue

                    is_done = chunk.get("done", False)
                    delta = chunk.get("message", {}).get("content", "")

                    if delta:
                        chunk_payload = {
                            "delta": delta,
                            "done": False,
                            "model": target_model,
                        }
                        yield f"data: {json.dumps(chunk_payload)}\n\n"

                    if is_done:
                        duration_ms = int((time.perf_counter() - start_time) * 1000)
                        prompt_eval = chunk.get("prompt_eval_count") or 0
                        eval_count = chunk.get("eval_count") or 0
                        done_payload = {
                            "delta": "",
                            "done": True,
                            "model": target_model,
                            "prompt_tokens": prompt_eval,
                            "completion_tokens": eval_count,
                            "total_tokens": prompt_eval + eval_count,
                            "duration_ms": duration_ms,
                        }
                        yield f"data: {json.dumps(done_payload)}\n\n"
                        yield "data: [DONE]\n\n"
                        return
        except (asyncio.CancelledError, GeneratorExit):
            # Client disconnected or aborted request — exit cleanly
            raise
        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            yield f"data: {json.dumps({'error': f'Connection to Ollama failed at {self.base_url}.', 'done': True})}\n\n"
        except httpx.TimeoutException as exc:
            yield f"data: {json.dumps({'error': f'Inference timed out after {self.timeout}s for model {target_model}. The model may be too large for GPU VRAM or busy loading.', 'done': True})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': f'Inference error: {str(exc)}', 'done': True})}\n\n"
        finally:
            await client.aclose()
