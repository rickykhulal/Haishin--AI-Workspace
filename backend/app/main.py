import asyncio
import uuid
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .schemas import (
    HealthResponse,
    RuntimeInfo,
    ModelInfo,
    ModelsListResponse,
    LocalModelItem,
    ChatCompletionRequest,
    ChatCompletionResponse,
    AssistantMessage,
    UsageStats,
    SystemResourceInfo,
    BenchmarkRunSummary,
)
from .ollama_adapter import (
    OllamaAdapter,
    RuntimeUnavailableError,
    ModelNotFoundError,
    InferenceTimeoutError,
    InferenceError,
)
from .system_resources import get_system_resources
from backend.benchmarks.runner import (
    run_benchmark,
    get_latest_benchmark_result,
    get_benchmark_history,
)

ollama_adapter = OllamaAdapter()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safe startup logging (no secrets)
    print(f"[Haishin Backend] Starting on {settings.host}:{settings.port}")
    print(f"[Haishin Backend] Runtime URL: {settings.ollama_base_url}")
    print(f"[Haishin Backend] Allowed CORS origins: {settings.cors_origins}")
    yield
    await ollama_adapter.close()
    print("[Haishin Backend] Shutting down.")

app = FastAPI(
    title="Haishin Local AI Backend",
    version="0.7.0",
    description="Local AI inference backend for Haishin workspace by Haitian.",
    lifespan=lifespan,
)

# Restrictive CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def get_health():
    """Report backend health and local model runtime availability with telemetry."""
    try:
        available, models = await asyncio.wait_for(
            ollama_adapter.check_runtime(),
            timeout=3.0,
        )
    except Exception as exc:
        available, models = False, []
        if not ollama_adapter.last_error:
            ollama_adapter.last_error = str(exc)

    if not available:
        return HealthResponse(
            status="degraded",
            runtime=RuntimeInfo(
                type="ollama",
                available=False,
                url=settings.ollama_base_url,
                last_checked_at=ollama_adapter.last_checked_at,
                last_error=ollama_adapter.last_error or "Runtime unreachable",
            ),
            model=ModelInfo(
                configured_id=settings.default_model or None,
                ready=False,
                details=f"Ollama local runtime is unreachable at {settings.ollama_base_url}. Please ensure Ollama is running.",
                is_loaded=False,
            ),
        )

    if not models:
        return HealthResponse(
            status="warning",
            runtime=RuntimeInfo(
                type="ollama",
                available=True,
                url=settings.ollama_base_url,
                last_checked_at=ollama_adapter.last_checked_at,
                last_error=None,
            ),
            model=ModelInfo(
                configured_id=settings.default_model or None,
                ready=False,
                details="Ollama is running, but no models are installed. Run 'ollama pull <model_id>' to download one.",
                is_loaded=False,
            ),
        )

    # Runtime is online with at least one model
    installed_names = [m.get("name", "") for m in models if m.get("name")]
    configured = settings.default_model
    ready = False
    active_model = configured or (installed_names[0] if installed_names else "unknown")

    if configured:
        if configured in installed_names:
            active_model = configured
            ready = True
            details = f"Local model '{active_model}' is ready for inference."
        else:
            # Check prefix match (e.g. 'llama3.2:1b' matching full tag)
            matched = [name for name in installed_names if name.startswith(configured)]
            if matched:
                active_model = matched[0]
                ready = True
                details = f"Local model '{active_model}' is ready for inference."
            else:
                ready = False
                details = f"Configured model '{configured}' is not installed in Ollama. Available: {', '.join(installed_names)}."
    else:
        ready = bool(installed_names)
        details = f"Local model '{active_model}' is ready for inference." if ready else "No models installed."

    loaded_models = await ollama_adapter.get_loaded_models()
    is_active_loaded = any(
        lm.get("name") == active_model or (lm.get("name") and lm.get("name", "").startswith(active_model))
        for lm in loaded_models
    )

    return HealthResponse(
        status="ok" if ready else "warning",
        runtime=RuntimeInfo(
            type="ollama",
            available=True,
            url=settings.ollama_base_url,
            last_checked_at=ollama_adapter.last_checked_at,
            last_error=None,
        ),
        model=ModelInfo(
            configured_id=active_model,
            ready=ready,
            details=details,
            is_loaded=is_active_loaded,
        ),
    )


@app.get("/v1/models", response_model=ModelsListResponse, tags=["Models"])
async def get_models():
    """Return list of locally installed models from Ollama with loaded states."""
    try:
        available, raw_models = await asyncio.wait_for(
            ollama_adapter.check_runtime(),
            timeout=3.0,
        )
    except Exception as exc:
        available, raw_models = False, []
        if not ollama_adapter.last_error:
            ollama_adapter.last_error = str(exc)

    if not available:
        return ModelsListResponse(
            models=[],
            default_model=None,
            runtime_available=False,
            last_checked_at=ollama_adapter.last_checked_at,
            last_error=ollama_adapter.last_error or "Runtime unreachable",
        )

    # Check which models are actively loaded into memory
    loaded_models = await ollama_adapter.get_loaded_models()
    loaded_lookup = {lm.get("name"): lm for lm in loaded_models if lm.get("name")}

    items = []
    default_id = None

    for i, m in enumerate(raw_models):
        m_name = m.get("name", "")
        # Check exact match or prefix match with settings.default_model
        is_default = False
        if settings.default_model:
            is_default = (m_name == settings.default_model or m_name.startswith(settings.default_model))
        elif i == 0:
            is_default = True

        if is_default and default_id is None:
            default_id = m_name

        loaded_info = loaded_lookup.get(m_name)
        details = m.get("details", {}) or {}

        items.append(
            LocalModelItem(
                id=m_name,
                name=m_name,
                provider="ollama",
                size_bytes=m.get("size"),
                parameter_size=details.get("parameter_size"),
                quantization=details.get("quantization_level"),
                family=details.get("family"),
                modified_at=m.get("modified_at"),
                digest=m.get("digest"),
                is_loaded=bool(loaded_info),
                vram_bytes=loaded_info.get("size_vram") if loaded_info else None,
                status="available",
                is_default=is_default,
            )
        )

    return ModelsListResponse(
        models=items,
        default_model=default_id or (items[0].id if items else None),
        runtime_available=True,
        last_checked_at=ollama_adapter.last_checked_at,
        last_error=None,
    )


@app.post("/v1/models/refresh", response_model=ModelsListResponse, tags=["Models"])
async def refresh_models():
    """Invalidate model caches and fetch latest models from Ollama runtime."""
    ollama_adapter.refresh()
    return await get_models()


@app.get("/v1/system/resources", response_model=SystemResourceInfo, tags=["System"])
async def get_system_resources_endpoint():
    """Return lightweight CPU, RAM, and GPU/VRAM hardware resource metrics."""
    data = await asyncio.to_thread(get_system_resources)
    return SystemResourceInfo(**data)


@app.get("/v1/benchmarks/latest", tags=["Benchmarks"])
async def get_latest_benchmark():
    """Return the most recent benchmark run summary."""
    latest = get_latest_benchmark_result()
    if not latest:
        return {"status": "empty", "message": "No benchmarks have been run yet."}
    return latest


@app.get("/v1/benchmarks/history", tags=["Benchmarks"])
async def get_benchmarks_history():
    """Return past benchmark run summaries."""
    return get_benchmark_history()


_benchmark_lock = asyncio.Lock()


@app.post("/v1/benchmarks/run", response_model=BenchmarkRunSummary, tags=["Benchmarks"])
async def run_benchmark_endpoint(smoke: bool = False, model: Optional[str] = None):
    """
    Run the repeatable evaluation benchmark suite against the local Ollama runtime.
    Use smoke=True for a rapid 3-prompt sanity check.
    Prevents overlapping concurrent runs via lock.
    """
    if _benchmark_lock.locked():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A benchmark run is already in progress. Please wait for it to complete.",
        )

    async with _benchmark_lock:
        try:
            summary = await asyncio.wait_for(
                run_benchmark(
                    model_id=model,
                    smoke_only=smoke,
                    base_url=ollama_adapter.base_url,
                ),
                timeout=600.0 if not smoke else 120.0,
            )
            return summary
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Benchmark execution failed: {str(exc)}",
            ) from exc


@app.post(
    "/v1/chat/completions",
    response_model=ChatCompletionResponse,
    tags=["Inference"],
)
async def chat_completions(request: ChatCompletionRequest):
    """
    Accept validated chat messages and return genuine local model completion.
    Translates errors to standard HTTP status codes.
    """
    messages_payload = [
        {"role": msg.role, "content": msg.content}
        for msg in request.messages
    ]

    if request.stream:
        return StreamingResponse(
            ollama_adapter.chat_stream(
                messages=messages_payload,
                model=request.model,
                temperature=request.temperature,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    try:
        result = await ollama_adapter.chat(
            messages=messages_payload,
            model=request.model,
            temperature=request.temperature,
        )
    except RuntimeUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ModelNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except InferenceTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc
    except InferenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        print(f"[Haishin] Internal inference error: {exc}", flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during inference. Check server logs for details.",
        ) from exc

    return ChatCompletionResponse(
        id=str(uuid.uuid4()),
        model=result["model"],
        mode="local",
        message=AssistantMessage(role="assistant", content=result["content"]),
        usage=UsageStats(
            prompt_tokens=result.get("prompt_tokens"),
            completion_tokens=result.get("completion_tokens"),
            total_tokens=result.get("total_tokens"),
        ),
        inference_duration_ms=result.get("duration_ms"),
    )
