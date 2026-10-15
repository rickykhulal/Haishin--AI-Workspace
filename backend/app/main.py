import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
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
)
from .ollama_adapter import (
    OllamaAdapter,
    RuntimeUnavailableError,
    ModelNotFoundError,
    InferenceTimeoutError,
    InferenceError,
)

ollama_adapter = OllamaAdapter()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safe startup logging (no secrets)
    print(f"[Haishin Backend] Starting on {settings.host}:{settings.port}")
    print(f"[Haishin Backend] Runtime URL: {settings.ollama_base_url}")
    print(f"[Haishin Backend] Allowed CORS origins: {settings.cors_origins}")
    yield
    print("[Haishin Backend] Shutting down.")

app = FastAPI(
    title="Haishin Local AI Backend",
    version="0.2.0",
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
    """Report backend health and local model runtime availability."""
    available, models = await ollama_adapter.check_runtime()

    if not available:
        return HealthResponse(
            status="degraded",
            runtime=RuntimeInfo(
                type="ollama",
                available=False,
                url=settings.ollama_base_url,
            ),
            model=ModelInfo(
                configured_id=settings.default_model or None,
                ready=False,
                details=f"Ollama local runtime is unreachable at {settings.ollama_base_url}. Please ensure Ollama is running.",
            ),
        )

    if not models:
        return HealthResponse(
            status="warning",
            runtime=RuntimeInfo(
                type="ollama",
                available=True,
                url=settings.ollama_base_url,
            ),
            model=ModelInfo(
                configured_id=settings.default_model or None,
                ready=False,
                details="Ollama is running, but no models are installed. Run 'ollama pull <model_id>' to download one.",
            ),
        )

    # Runtime is online with at least one model
    active_model = settings.default_model or models[0].get("name", "unknown")
    return HealthResponse(
        status="ok",
        runtime=RuntimeInfo(
            type="ollama",
            available=True,
            url=settings.ollama_base_url,
        ),
        model=ModelInfo(
            configured_id=active_model,
            ready=True,
            details=f"Local model '{active_model}' is ready for inference.",
        ),
    )


@app.get("/v1/models", response_model=ModelsListResponse, tags=["Models"])
async def get_models():
    """Return list of locally installed models from Ollama."""
    available, raw_models = await ollama_adapter.check_runtime()

    if not available:
        return ModelsListResponse(
            models=[],
            default_model=None,
            runtime_available=False,
        )

    items = []
    default_id = None

    for i, m in enumerate(raw_models):
        m_name = m.get("name", "")
        is_default = (m_name == settings.default_model) if settings.default_model else (i == 0)
        if is_default:
            default_id = m_name

        items.append(
            LocalModelItem(
                id=m_name,
                name=m_name,
                provider="ollama",
                size_bytes=m.get("size"),
                status="available",
                is_default=is_default,
            )
        )

    return ModelsListResponse(
        models=items,
        default_model=default_id or (items[0].id if items else None),
        runtime_available=True,
    )


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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal inference failure: {str(exc)}",
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
