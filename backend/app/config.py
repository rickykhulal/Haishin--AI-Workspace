import os
import sys
from typing import List
from pydantic import BaseModel, field_validator


class Settings(BaseModel):
    """Runtime configuration for Haishin backend with validation."""
    host: str = os.getenv("HAISHIN_HOST", "127.0.0.1")
    port: int = int(os.getenv("HAISHIN_PORT", "8000"))
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    default_model: str = os.getenv("HAISHIN_DEFAULT_MODEL", "llama3.2:1b").strip()
    inference_timeout: float = float(os.getenv("HAISHIN_INFERENCE_TIMEOUT", "180.0"))
    cors_origins: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "HAISHIN_CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ]

    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not (1 <= v <= 65535):
            print(f"[Haishin Config] Invalid HAISHIN_PORT={v}. Must be 1–65535. Using default 8000.", file=sys.stderr)
            return 8000
        return v

    @field_validator("ollama_base_url")
    @classmethod
    def validate_ollama_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            print(f"[Haishin Config] Invalid OLLAMA_BASE_URL='{v}'. Must start with http:// or https://. Using default.", file=sys.stderr)
            return "http://127.0.0.1:11434"
        return v

    @field_validator("inference_timeout")
    @classmethod
    def validate_timeout(cls, v: float) -> float:
        if v <= 0:
            print(f"[Haishin Config] Invalid HAISHIN_INFERENCE_TIMEOUT={v}. Must be positive. Using default 180.0.", file=sys.stderr)
            return 180.0
        if v > 600:
            print(f"[Haishin Config] Warning: HAISHIN_INFERENCE_TIMEOUT={v}s is very high.", file=sys.stderr)
        return v

    @field_validator("default_model")
    @classmethod
    def validate_model(cls, v: str) -> str:
        if not v:
            print("[Haishin Config] HAISHIN_DEFAULT_MODEL is empty. Using 'llama3.2:1b'.", file=sys.stderr)
            return "llama3.2:1b"
        return v


settings = Settings()
