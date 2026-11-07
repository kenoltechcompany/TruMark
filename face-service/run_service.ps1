# Starts the InsightFace FastAPI microservice locally
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".\venv\Scripts\python.exe")) {
    Write-Host "Creating virtual environment with uv..."
    uv venv --python 3.10 venv
    uv pip install --python .\venv\Scripts\python.exe -r requirements.txt
}

Write-Host "Starting TruMark Face Recognition Service on http://127.0.0.1:8000 ..."
& .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
