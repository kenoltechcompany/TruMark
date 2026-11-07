import os
from dataclasses import dataclass

@dataclass
class Settings:
    MODEL_NAME: str = os.getenv("FACE_MODEL_NAME", "buffalo_l")
    DET_SIZE: int = int(os.getenv("FACE_DET_SIZE", "640"))
    SIMILARITY_THRESHOLD: float = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.65"))
    PORT: int = int(os.getenv("FACE_SERVICE_PORT", "8000"))
    HOST: str = os.getenv("FACE_SERVICE_HOST", "0.0.0.0")

settings = Settings()
