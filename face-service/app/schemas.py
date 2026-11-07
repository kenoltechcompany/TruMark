from typing import List, Optional
from pydantic import BaseModel, Field

class CandidateStudent(BaseModel):
    student_id: str = Field(..., description="Local database UUID of student")
    embedding: List[float] = Field(..., description="512-dimensional float vector")

class ExtractResponse(BaseModel):
    success: bool
    faces_detected: int
    embedding: Optional[List[float]] = None
    message: str

class VerifyRequest(BaseModel):
    candidates: List[CandidateStudent]
    threshold: Optional[float] = None

class VerifyResponse(BaseModel):
    matched: bool
    student_id: Optional[str] = None
    confidence: float
    message: str

class HealthResponse(BaseModel):
    status: str
    model_name: str
    providers: List[str]
    threshold: float
