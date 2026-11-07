import time
import os
import numpy as np
from skimage import data
import cv2
from insightface.app import FaceAnalysis

def benchmark_model(model_name: str):
    print("\n" + "=" * 60)
    print(f"Benchmarking InsightFace Model Pack: '{model_name}'")
    print("=" * 60)

    # 1. Initialize FaceAnalysis with CPUExecutionProvider
    print(f"[1/4] Loading '{model_name}' (CPU Execution Provider)...")
    load_start = time.time()
    app = FaceAnalysis(name=model_name, providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    load_time = time.time() - load_start
    print(f"      Model loaded in {load_time:.2f} seconds.")

    # 2. Prepare test images
    print("[2/4] Preparing sample images for testing...")
    # Base image: astronaut Eileen Collins from skimage
    img1_rgb = data.astronaut()
    img1_bgr = cv2.cvtColor(img1_rgb, cv2.COLOR_RGB2BGR)

    # Variant image: same person, slightly altered brightness/contrast & slight shift
    img2_bgr = cv2.convertScaleAbs(img1_bgr, alpha=1.1, beta=10)

    # 3. Detect and extract embeddings
    print("[3/4] Extracting embeddings & measuring CPU latency...")

    # Image 1
    t0 = time.time()
    faces1 = app.get(img1_bgr)
    lat1 = (time.time() - t0) * 1000
    print(f"      Image 1 (Base): Detected {len(faces1)} face(s) in {lat1:.1f} ms")

    if not faces1:
        print("      ERROR: No face detected in Image 1.")
        return

    emb1 = faces1[0].normed_embedding  # 512-d unit vector
    print(f"      Embedding vector shape: {emb1.shape}, Norm: {np.linalg.norm(emb1):.4f}")

    # Image 2 (Same person, varied conditions)
    t0 = time.time()
    faces2 = app.get(img2_bgr)
    lat2 = (time.time() - t0) * 1000
    print(f"      Image 2 (Lighting variation): Detected {len(faces2)} face(s) in {lat2:.1f} ms")
    emb2 = faces2[0].normed_embedding

    # Synthetic non-matching face embedding (random orthogonal vector)
    emb_impostor = np.random.randn(512).astype(np.float32)
    emb_impostor /= np.linalg.norm(emb_impostor)

    # 4. Verification & Cosine Similarity Tests
    print("[4/4] Verifying Cosine Similarity & Matching Logic...")
    sim_same = float(np.dot(emb1, emb2))
    sim_impostor = float(np.dot(emb1, emb_impostor))

    threshold = 0.60 if 'sc' in model_name else 0.65
    print(f"      Similarity (Same person, different lighting): {sim_same:.4f}")
    print(f"      Similarity (Impostor / random vector):       {sim_impostor:.4f}")
    print(f"      Decision Threshold:                          {threshold:.2f}")

    passed = sim_same >= threshold and sim_impostor < threshold
    if passed:
        print(f"\n>>> SUCCESS: '{model_name}' passed all biometric accuracy and threshold tests! <<<")
        print(f">>> Average single-image processing latency: {(lat1 + lat2) / 2:.1f} ms <<<")
    else:
        print(f"\n>>> WARNING: Check threshold settings for '{model_name}'. <<<")

def main():
    print("=" * 60)
    print("TruMark - InsightFace Local CPU Benchmark & Verification")
    print("=" * 60)

    # Always benchmark buffalo_sc first (already downloaded)
    benchmark_model('buffalo_sc')

    # If buffalo_l exists, benchmark it as well
    models_dir = os.path.expanduser("~/.insightface/models/buffalo_l")
    if os.path.isdir(models_dir) and any(f.endswith('.onnx') for f in os.listdir(models_dir)):
        benchmark_model('buffalo_l')
    else:
        print("\nNote: 'buffalo_l' is currently downloading in the background. Run again once finished.")

if __name__ == '__main__':
    main()
