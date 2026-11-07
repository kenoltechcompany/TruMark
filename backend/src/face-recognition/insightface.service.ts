import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import {
  IFaceRecognitionService,
  CandidateStudentEmbedding,
  SyncStudentResult,
} from './face-recognition.interface';

@Injectable()
export class InsightFaceService implements IFaceRecognitionService {
  readonly providerName = 'insightface';
  private readonly logger = new Logger(InsightFaceService.name);
  private readonly baseUrl: string;

  constructor() {
    const mode = (process.env.INSIGHTFACE_MODE || 'local').toLowerCase();
    const defaultUrl = mode === 'remote' ? 'https://face-engine.internal:8000' : 'http://localhost:8000';
    this.baseUrl = (
      process.env.INSIGHTFACE_SERVICE_URL ||
      process.env.FACE_SERVICE_URL ||
      defaultUrl
    ).replace(/\/$/, '');
    this.logger.log(`InsightFaceService initialized in [${mode.toUpperCase()}] mode targeting: ${this.baseUrl}`);
  }

  private async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Face service returned error ${response.status}: ${errorText}`);
        throw new BadRequestException(`Face service error: ${errorText || response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Failed to connect to face service at ${url}: ${err.message}`);
      throw new ServiceUnavailableException(
        'The local facial recognition service is currently unreachable. Please make sure face-service is running.',
      );
    }
  }

  async extractEmbedding(imageBuffers: Buffer[]): Promise<number[]> {
    if (!imageBuffers.length) {
      throw new BadRequestException('At least one image is required for face embedding extraction.');
    }

    const formData = new FormData();
    for (let i = 0; i < imageBuffers.length; i++) {
      const blob = new Blob([new Uint8Array(imageBuffers[i])], { type: 'image/jpeg' });
      formData.append('files', blob, `photo_${i}.jpg`);
    }

    const res = await this.postFormData<{
      success: boolean;
      faces_detected: number;
      embedding?: number[];
      message: string;
    }>('/extract-student-embeddings', formData);

    if (!res.success || !res.embedding) {
      throw new BadRequestException(res.message || 'No face detected in the provided images.');
    }

    return res.embedding;
  }

  async identifyFace(
    classId: string,
    imageBuffer: Buffer,
    candidates: CandidateStudentEmbedding[] = [],
  ): Promise<{ studentId?: string; confidence: number } | null> {
    if (!candidates.length) {
      this.logger.warn(`identifyFace called for class ${classId} with 0 candidate embeddings.`);
      return null;
    }

    const formData = new FormData();
    const probeBlob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
    formData.append('file', probeBlob, 'probe_selfie.jpg');

    const formattedCandidates = candidates.map((c) => ({
      student_id: c.studentId,
      embedding: c.embedding,
    }));
    formData.append('candidates_json', JSON.stringify(formattedCandidates));

    const res = await this.postFormData<{
      matched: boolean;
      student_id?: string;
      confidence: number;
      message: string;
    }>('/verify-face', formData);

    if (!res.matched || !res.student_id) {
      return null;
    }

    return {
      studentId: res.student_id,
      confidence: res.confidence,
    };
  }

  async syncClass(
    classId: string,
    className: string,
    students: { id: string; fullName: string; imagePaths: string[] }[],
  ): Promise<SyncStudentResult[]> {
    this.logger.log(`Processing InsightFace embeddings for class ${classId} (${className})...`);
    const results: SyncStudentResult[] = [];

    for (const student of students) {
      const buffers: Buffer[] = [];
      for (const p of student.imagePaths) {
        if (existsSync(p)) {
          try {
            buffers.push(readFileSync(p));
          } catch (e) {
            this.logger.warn(`Could not read image file ${p} for student ${student.fullName}: ${e}`);
          }
        }
      }

      if (!buffers.length) {
        this.logger.warn(`No valid image files found on disk for student ${student.fullName}`);
        continue;
      }

      try {
        const embedding = await this.extractEmbedding(buffers);
        results.push({
          id: student.id,
          faceEmbedding: embedding,
        });
        this.logger.log(`Extracted 512-d embedding for student ${student.fullName} (${student.id})`);
      } catch (err: any) {
        this.logger.warn(`Failed extracting embedding for ${student.fullName}: ${err.message}`);
      }
    }

    return results;
  }
}
