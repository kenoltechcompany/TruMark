export interface FaceMatchResult {
  matched: boolean;
  studentId: string | null;
  confidence: number;
  message?: string;
}

export interface CandidateStudentEmbedding {
  studentId: string;
  embedding: number[];
}

export interface SyncStudentResult {
  id: string;
  azurePersonId?: string;
  faceEmbedding?: number[];
}

export interface IFaceRecognitionService {
  providerName: 'insightface' | 'azure' | 'facepp';

  /**
   * Extracts face embedding from one or more reference photos.
   * Returns a 512-dimensional vector (InsightFace).
   */
  extractEmbedding(imageBuffers: Buffer[]): Promise<number[]>;

  /**
   * Enrolls a single student's reference photos into a cloud FaceSet (Face++).
   * Returns the cloud face_token / personId if applicable.
   */
  enrollStudentFace?(classId: string, imageBuffers: Buffer[]): Promise<string | null>;

  /**
   * Identifies an attendance check-in selfie against a class session.
   * Returns matched studentId / personId and confidence score.
   */
  identifyFace(
    classId: string,
    imageBuffer: Buffer,
    candidates?: CandidateStudentEmbedding[],
  ): Promise<{ studentId?: string; personId?: string; confidence: number } | null>;

  /**
   * Syncs / processes biometric data for a class.
   */
  syncClass(
    classId: string,
    className: string,
    students: { id: string; fullName: string; imagePaths: string[] }[],
  ): Promise<SyncStudentResult[]>;
}
