import os
import cv2
import numpy as np
from typing import List, Optional, Tuple
from insightface.app import FaceAnalysis
from .config import settings
from .schemas import CandidateStudent

class FaceEngine:
    def __init__(self):
        model_name = settings.MODEL_NAME
        models_root = os.path.expanduser("~/.insightface/models")
        preferred_path = os.path.join(models_root, model_name)

        # Fallback to buffalo_sc if preferred model is not yet available
        if not (os.path.isdir(preferred_path) and any(f.endswith('.onnx') for f in os.listdir(preferred_path))):
            sc_path = os.path.join(models_root, "buffalo_sc")
            if os.path.isdir(sc_path) and any(f.endswith('.onnx') for f in os.listdir(sc_path)):
                print(f"[FaceEngine] Notice: '{model_name}' not ready yet. Using 'buffalo_sc'.")
                model_name = "buffalo_sc"

        self.model_name = model_name
        print(f"[FaceEngine] Initializing FaceAnalysis with model pack '{self.model_name}' on CPU...")
        self.app = FaceAnalysis(name=self.model_name, providers=['CPUExecutionProvider'])
        self.app.prepare(ctx_id=-1, det_size=(settings.DET_SIZE, settings.DET_SIZE))
        print(f"[FaceEngine] FaceAnalysis '{self.model_name}' ready.")

    def decode_image(self, image_bytes: bytes) -> Optional[np.ndarray]:
        """Converts raw image bytes to an OpenCV BGR numpy array."""
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img

    def extract_embedding(self, image_bytes: bytes) -> Tuple[Optional[List[float]], int, str]:
        """
        Detects faces in image bytes and returns the 512-d normalized embedding
        of the most prominent face (largest bounding box).
        """
        img = self.decode_image(image_bytes)
        if img is None:
            return None, 0, "Invalid image format or corrupted bytes."

        faces = self.app.get(img)
        if not faces:
            return None, 0, "No face detected in the image."

        # If multiple faces, pick the largest by bounding box area
        if len(faces) > 1:
            faces = sorted(
                faces,
                key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
                reverse=True
            )

        best_face = faces[0]
        normed = best_face.normed_embedding  # 512-d float unit vector
        return normed.tolist(), len(faces), "Face detected and embedding extracted successfully."

    def extract_centroid_embedding(self, images_bytes_list: List[bytes]) -> Tuple[Optional[List[float]], int, str]:
        """
        Extracts embeddings across multiple reference photos (e.g. 3 photos during registration)
        and computes the normalized average (centroid) vector for robust representation.
        """
        valid_embeddings = []
        for b in images_bytes_list:
            emb, count, _ = self.extract_embedding(b)
            if emb is not None:
                valid_embeddings.append(emb)

        if not valid_embeddings:
            return None, 0, "Could not detect a clear face in any of the provided images."

        matrix = np.array(valid_embeddings, dtype=np.float32)
        mean_vec = np.mean(matrix, axis=0)
        norm = np.linalg.norm(mean_vec)
        if norm > 0:
            mean_vec = mean_vec / norm

        return mean_vec.tolist(), len(valid_embeddings), f"Extracted centroid embedding from {len(valid_embeddings)} valid photos."

    def match_against_candidates(
        self,
        probe_image_bytes: bytes,
        candidates: List[CandidateStudent],
        threshold: Optional[float] = None
    ) -> Tuple[bool, Optional[str], float, str]:
        """
        Extracts probe selfie embedding and matches it against candidate embeddings
        using batch cosine similarity.
        """
        if not candidates:
            return False, None, 0.0, "No enrolled students with facial data in this session."

        thresh = threshold if threshold is not None else settings.SIMILARITY_THRESHOLD

        probe_emb, face_count, msg = self.extract_embedding(probe_image_bytes)
        if probe_emb is None:
            return False, None, 0.0, msg

        probe_vec = np.array(probe_emb, dtype=np.float32)

        # Build candidate matrix (N, 512)
        candidate_matrix = np.array([c.embedding for c in candidates], dtype=np.float32)

        # Batch cosine similarity (unit vectors dot product)
        similarities = np.dot(candidate_matrix, probe_vec)

        best_idx = int(np.argmax(similarities))
        best_score = float(similarities[best_idx])
        best_candidate = candidates[best_idx]

        if best_score >= thresh:
            return True, best_candidate.student_id, best_score, "Face verified successfully."
        else:
            return False, None, best_score, f"Face not recognized (similarity: {best_score:.3f} below threshold: {thresh:.2f})."

engine: Optional[FaceEngine] = None

def get_engine() -> FaceEngine:
    global engine
    if engine is None:
        engine = FaceEngine()
    return engine
