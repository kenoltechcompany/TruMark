# TruMark Face Recognition Microservice

A high-performance, privacy-first biometric facial recognition service powered by **InsightFace** (ArcFace + SCRFD) and **ONNX Runtime (CPU Execution Provider)**.

## Features
- **Local & Federated:** Runs 100% on-premises on CPU; biometric face vectors never leave the school's server.
- **Sub-100ms Inference:** Face detection & alignment via SCRFD, 512-d feature vector extraction via ArcFace.
- **Batch Cosine Similarity:** Fast vector dot-product matching across enrolled students in under 1 millisecond.
- **REST Endpoints:**
  - `GET /health`: Health check and loaded model info.
  - `POST /extract-face`: Extracts a 512-dimensional embedding from a single image.
  - `POST /extract-student-embeddings`: Extracts and averages multiple registration photos into a single normalized centroid vector.
  - `POST /verify-face`: Matches a probe selfie against a list of enrolled student vectors with configurable threshold.

## Local Setup with `uv`

```powershell
cd face-service
uv venv --python 3.10 venv
uv pip install --python .\venv\Scripts\python.exe -r requirements.txt
```

### Running the Service:
```powershell
.\run_service.ps1
# Or directly:
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Running Tests:
```powershell
# Benchmark CPU performance
.\venv\Scripts\python.exe test_local.py

# Integration test all FastAPI endpoints
.\venv\Scripts\python.exe test_api.py
```
