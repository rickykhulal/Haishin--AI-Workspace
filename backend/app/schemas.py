from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class MessagePayload(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., min_length=1, description="Message text cannot be empty")
    images: Optional[List[str]] = Field(None, description="Optional list of base64-encoded image strings")

class ChatCompletionRequest(BaseModel):
    conversation_id: Optional[str] = None
    messages: List[MessagePayload] = Field(..., min_length=1, description="At least one message is required")
    model: Optional[str] = Field(None, description="Requested model ID. Uses default if not specified.")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    stream: Optional[bool] = Field(False, description="Whether to stream response chunks via SSE")
    num_predict: Optional[int] = Field(None, ge=1, le=8192, description="Maximum output tokens to predict")
    num_ctx: Optional[int] = Field(None, ge=512, le=131072, description="Context window size in tokens")
    parent_message_id: Optional[str] = Field(None, description="Optional parent message ID")

class ChatContinuationRequest(BaseModel):
    conversation_id: Optional[str] = None
    messages: List[MessagePayload] = Field(..., min_length=1, description="Conversation history ending with the target assistant turn")
    parent_message_id: str = Field(..., min_length=1, description="ID of the assistant message to continue")
    model: Optional[str] = Field(None, description="Requested model ID. Uses default if not specified.")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    stream: Optional[bool] = Field(False, description="Whether to stream continuation chunks via SSE")
    num_predict: Optional[int] = Field(None, ge=1, le=8192, description="Maximum output tokens to predict")
    num_ctx: Optional[int] = Field(None, ge=512, le=131072, description="Context window size in tokens")

class UsageStats(BaseModel):
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None

class AssistantMessage(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str
    thinking: Optional[str] = None

class ChatCompletionResponse(BaseModel):
    id: str
    model: str
    mode: Literal["local"] = "local"
    message: AssistantMessage
    usage: Optional[UsageStats] = None
    inference_duration_ms: Optional[int] = None
    done_reason: Optional[str] = None

class ChatContinuationResponse(BaseModel):
    id: str
    parent_message_id: str
    model: str
    mode: Literal["local"] = "local"
    continuation: str
    done_reason: Optional[str] = None
    usage: Optional[UsageStats] = None
    inference_duration_ms: Optional[int] = None

class RuntimeInfo(BaseModel):
    type: str = "ollama"
    available: bool
    url: str
    last_checked_at: Optional[str] = None
    last_error: Optional[str] = None

class ModelInfo(BaseModel):
    configured_id: Optional[str] = None
    ready: bool
    details: str
    is_loaded: bool = False

class HealthResponse(BaseModel):
    status: str
    service: str = "haishin-backend"
    version: str = "0.8.0"
    runtime: RuntimeInfo
    model: ModelInfo

class LocalModelItem(BaseModel):
    id: str
    name: str
    provider: str = "ollama"
    size_bytes: Optional[int] = None
    parameter_size: Optional[str] = None
    quantization: Optional[str] = None
    family: Optional[str] = None
    modified_at: Optional[str] = None
    digest: Optional[str] = None
    is_loaded: bool = False
    vram_bytes: Optional[int] = None
    status: Literal["available", "coming_soon"] = "available"
    is_default: bool = False

class ModelsListResponse(BaseModel):
    models: List[LocalModelItem]
    default_model: Optional[str] = None
    runtime_available: bool
    last_checked_at: Optional[str] = None
    last_error: Optional[str] = None

class SystemResourceInfo(BaseModel):
    cpu_percent: float
    ram_total_mb: float
    ram_used_mb: float
    ram_percent: float
    gpu_available: bool
    gpu_name: Optional[str] = None
    vram_total_mb: Optional[float] = None
    vram_used_mb: Optional[float] = None
    vram_free_mb: Optional[float] = None
    gpu_utilization_percent: Optional[float] = None
    details: str

class BenchmarkItemResult(BaseModel):
    id: str
    category: str
    prompt: str
    evaluation_type: Literal["deterministic", "approximate"]
    passed: bool
    score: float
    reason: str
    output: str
    latency_ms: int
    ttft_ms: Optional[int] = None
    eval_tokens: Optional[int] = None
    prompt_tokens: Optional[int] = None
    tokens_per_sec: Optional[float] = None
    error: Optional[str] = None

class BenchmarkRunSummary(BaseModel):
    benchmark_version: str = "1.0"
    run_id: str
    timestamp: str
    model_id: str
    is_smoke: bool
    total_prompts: int
    passed: int
    failed: int
    timed_out: int
    errored: int
    pass_rate_percent: float
    total_duration_ms: int
    avg_latency_ms: float
    avg_ttft_ms: Optional[float] = None
    avg_tokens_per_sec: Optional[float] = None
    results: List[BenchmarkItemResult]

