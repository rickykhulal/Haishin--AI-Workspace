import time
import httpx
from typing import List, Dict, Any, Tuple, Optional
from .config import settings

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
    """Decoupled client adapter for local Ollama HTTP API."""

    def __init__(self, base_url: Optional[str] = None, timeout: Optional[float] = None):
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.timeout = timeout or settings.inference_timeout

    async def get_tags(self) -> List[Dict[str, Any]]:
        """Fetch installed models from Ollama /api/tags."""
        url = f"{self.base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                return data.get("models", [])
        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            raise RuntimeUnavailableError(
                f"Ollama local runtime is unreachable at {self.base_url}. Ensure Ollama is running."
            ) from exc
        except httpx.HTTPError as exc:
            raise RuntimeUnavailableError(f"Ollama returned HTTP error on /api/tags: {exc}") from exc

    async def check_runtime(self) -> Tuple[bool, List[Dict[str, Any]]]:
        """Check if runtime is up and retrieve installed models."""
        try:
            models = await self.get_tags()
            return True, models
        except RuntimeUnavailableError:
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
            async with httpx.AsyncClient(timeout=self.timeout) as client:
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
        content = assistant_msg.get("content", "")

        return {
            "model": target_model,
            "content": content,
            "prompt_tokens": data.get("prompt_eval_count"),
            "completion_tokens": data.get("eval_count"),
            "total_tokens": (data.get("prompt_eval_count") or 0) + (data.get("eval_count") or 0),
            "duration_ms": duration_ms,
        }
