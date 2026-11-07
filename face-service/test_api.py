import io
import json
import cv2
import numpy as np
from skimage import data
from fastapi.testclient import TestClient
from app.main import app

def create_encoded_image(img_rgb) -> bytes:
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    success, encoded = cv2.imencode('.jpg', img_bgr)
    assert success
    return encoded.tobytes()

def main():
    print("=" * 60)
    print("Testing TruMark Face Recognition FastAPI Endpoints")
    print("=" * 60)

    client = TestClient(app)

    # 1. Test /health
    print("\n[1/4] Testing GET /health...")
    resp = client.get("/health")
    print(f"      Status: {resp.status_code}, Body: {resp.json()}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

    # 2. Test /extract-face
    print("\n[2/4] Testing POST /extract-face...")
    img1_bytes = create_encoded_image(data.astronaut())
    resp = client.post(
        "/extract-face",
        files={"file": ("astronaut.jpg", io.BytesIO(img1_bytes), "image/jpeg")}
    )
    print(f"      Status: {resp.status_code}")
    body = resp.json()
    assert resp.status_code == 200
    assert body["success"] is True
    assert len(body["embedding"]) == 512
    print(f"      Face detected: {body['faces_detected']}, Embedding dimension: {len(body['embedding'])}")
    emb_student1 = body["embedding"]

    # 3. Test /extract-student-embeddings (multi-photo centroid)
    print("\n[3/4] Testing POST /extract-student-embeddings...")
    img2_rgb = cv2.convertScaleAbs(data.astronaut(), alpha=1.05, beta=5)
    img2_bytes = create_encoded_image(img2_rgb)

    resp = client.post(
        "/extract-student-embeddings",
        files=[
            ("files", ("photo1.jpg", io.BytesIO(img1_bytes), "image/jpeg")),
            ("files", ("photo2.jpg", io.BytesIO(img2_bytes), "image/jpeg")),
        ]
    )
    print(f"      Status: {resp.status_code}")
    body = resp.json()
    assert resp.status_code == 200
    assert body["success"] is True
    assert len(body["embedding"]) == 512
    print(f"      Centroid extracted across photos. Success: {body['success']}")
    student1_centroid = body["embedding"]

    # 4. Test /verify-face (matching probe selfie against candidates)
    print("\n[4/4] Testing POST /verify-face...")
    # Candidate 1: Real student (with centroid)
    # Candidate 2: Dummy random vector
    dummy_vec = np.random.randn(512).astype(np.float32)
    dummy_vec /= np.linalg.norm(dummy_vec)

    candidates = [
        {"student_id": "student-uuid-1111", "embedding": student1_centroid},
        {"student_id": "student-uuid-2222", "embedding": dummy_vec.tolist()},
    ]

    # Probe selfie is img1
    resp = client.post(
        "/verify-face",
        files={"file": ("probe_selfie.jpg", io.BytesIO(img1_bytes), "image/jpeg")},
        data={"candidates_json": json.dumps(candidates)}
    )
    print(f"      Status: {resp.status_code}, Response: {resp.json()}")
    body = resp.json()
    assert resp.status_code == 200
    assert body["matched"] is True
    assert body["student_id"] == "student-uuid-1111"
    assert body["confidence"] > 0.90

    print("\n>>> ALL FASTAPI ENDPOINTS VERIFIED AND WORKING PERFECTLY! <<<")

if __name__ == '__main__':
    main()
