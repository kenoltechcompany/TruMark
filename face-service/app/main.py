import json
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import settings
from .schemas import (
    ExtractResponse,
    VerifyResponse,
    HealthResponse,
    CandidateStudent,
)
from .engine import FaceEngine, get_engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up engine on startup
    eng = get_engine()
    yield

app = FastAPI(
    title="TruMark Face Recognition Service",
    description="Privacy-first, on-premises biometric face recognition powered by InsightFace and ONNX Runtime.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse)
def health_check(engine: FaceEngine = Depends(get_engine)):
    return HealthResponse(
        status="healthy",
        model_name=engine.model_name,
        providers=["CPUExecutionProvider"],
        threshold=settings.SIMILARITY_THRESHOLD,
    )

@app.post("/extract-face", response_model=ExtractResponse)
async def extract_face(
    file: UploadFile = File(...),
    engine: FaceEngine = Depends(get_engine)
):
    content = await file.read()
    emb, count, msg = engine.extract_embedding(content)
    if emb is None:
        return ExtractResponse(
            success=False,
            faces_detected=count,
            embedding=None,
            message=msg
        )

    return ExtractResponse(
        success=True,
        faces_detected=count,
        embedding=emb,
        message=msg
    )

@app.post("/extract-student-embeddings", response_model=ExtractResponse)
async def extract_student_embeddings(
    files: List[UploadFile] = File(...),
    engine: FaceEngine = Depends(get_engine)
):
    if not files:
        raise HTTPException(status_code=400, detail="At least one image file is required.")

    images_bytes = []
    for f in files:
        b = await f.read()
        images_bytes.append(b)

    centroid, valid_count, msg = engine.extract_centroid_embedding(images_bytes)
    if centroid is None:
        return ExtractResponse(
            success=False,
            faces_detected=valid_count,
            embedding=None,
            message=msg
        )

    return ExtractResponse(
        success=True,
        faces_detected=valid_count,
        embedding=centroid,
        message=msg
    )

@app.post("/verify-face", response_model=VerifyResponse)
async def verify_face(
    file: UploadFile = File(...),
    candidates_json: str = Form(..., description="JSON serialized array of CandidateStudent objects"),
    threshold: Optional[float] = Form(None),
    engine: FaceEngine = Depends(get_engine)
):
    try:
        raw_candidates = json.loads(candidates_json)
        candidates = [CandidateStudent(**c) for c in raw_candidates]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid candidates_json: {str(e)}")

    content = await file.read()
    matched, student_id, conf, msg = engine.match_against_candidates(
        content,
        candidates,
        threshold=threshold
    )

    return VerifyResponse(
        matched=matched,
        student_id=student_id,
        confidence=round(conf, 4),
        message=msg
    )
