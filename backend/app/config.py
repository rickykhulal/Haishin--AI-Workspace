import os
from typing import List
from pydantic import BaseModel

class Settings(BaseModel):
    """Runtime configuration for Haishin backend."""
    host: str = os.getenv("HAISHIN_HOST", "127.0.0.1")
    port: int = int(os.getenv("HAISHIN_PORT", "8000"))
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    default_model: str = os.getenv("HAISHIN_DEFAULT_MODEL", "").strip()
    inference_timeout: float = float(os.getenv("HAISHIN_INFERENCE_TIMEOUT", "120.0"))
    cors_origins: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "HAISHIN_CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ]

settings = Settings()
