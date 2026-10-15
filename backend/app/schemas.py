from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class MessagePayload(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., min_length=1, description="Message text cannot be empty")

class ChatCompletionRequest(BaseModel):
    conversation_id: Optional[str] = None
    messages: List[MessagePayload] = Field(..., min_length=1, description="At least one message is required")
    model: Optional[str] = Field(None, description="Requested model ID. Uses default if not specified.")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)

class UsageStats(BaseModel):
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None

class AssistantMessage(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str

class ChatCompletionResponse(BaseModel):
    id: str
    model: str
    mode: Literal["local"] = "local"
    message: AssistantMessage
    usage: Optional[UsageStats] = None
    inference_duration_ms: Optional[int] = None

class RuntimeInfo(BaseModel):
    type: str = "ollama"
    available: bool
    url: str

class ModelInfo(BaseModel):
    configured_id: Optional[str] = None
    ready: bool
    details: str

class HealthResponse(BaseModel):
    status: str
    service: str = "haishin-backend"
    version: str = "0.2.0"
    runtime: RuntimeInfo
    model: ModelInfo

class LocalModelItem(BaseModel):
    id: str
    name: str
    provider: str = "ollama"
    size_bytes: Optional[int] = None
    status: Literal["available", "coming_soon"] = "available"
    is_default: bool = False

class ModelsListResponse(BaseModel):
    models: List[LocalModelItem]
    default_model: Optional[str] = None
    runtime_available: bool
