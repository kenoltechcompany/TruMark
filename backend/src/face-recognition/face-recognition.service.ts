import { Injectable, Logger } from '@nestjs/common';
import {
  IFaceRecognitionService,
  CandidateStudentEmbedding,
  SyncStudentResult,
} from './face-recognition.interface';
import { InsightFaceService } from './insightface.service';
import { AzureFaceAdapterService } from './azure-face-adapter.service';
import { FacePlusPlusService } from './facepp.service';

@Injectable()
export class FaceRecognitionService implements IFaceRecognitionService {
  private readonly logger = new Logger(FaceRecognitionService.name);
  private activeService: IFaceRecognitionService;

  constructor(
    private readonly insightFaceService: InsightFaceService,
    private readonly azureAdapterService: AzureFaceAdapterService,
    private readonly facePlusPlusService: FacePlusPlusService,
  ) {
    const rawProvider = (process.env.FACE_PROVIDER || 'facepp').toLowerCase();
    const hasFacePPKeys = Boolean(
      process.env.FACEPP_API_KEY ||
      process.env.FACEPP_API_SECRET ||
      rawProvider === 'facepp' ||
      rawProvider === 'face++',
    );

    if (hasFacePPKeys && rawProvider !== 'azure') {
      this.activeService = this.facePlusPlusService;
      this.logger.log('Face Recognition active provider: Face++ (Megvii Cloud API)');
    } else if (rawProvider === 'azure') {
      this.activeService = this.azureAdapterService;
      this.logger.log('Face Recognition active provider: Azure Face');
    } else {
      this.activeService = this.insightFaceService;
      this.logger.log('Face Recognition active provider: InsightFace (Local on-premises)');
    }
  }

  get providerName(): 'insightface' | 'azure' | 'facepp' {
    return this.activeService.providerName;
  }

  extractEmbedding(imageBuffers: Buffer[]): Promise<number[]> {
    return this.activeService.extractEmbedding(imageBuffers);
  }

  async enrollStudentFace(classId: string, imageBuffers: Buffer[]): Promise<string | null> {
    if (this.activeService.enrollStudentFace) {
      return this.activeService.enrollStudentFace(classId, imageBuffers);
    }
    return null;
  }

  identifyFace(
    classId: string,
    imageBuffer: Buffer,
    candidates?: CandidateStudentEmbedding[],
    indexNumberHint?: string,
  ): Promise<{ studentId?: string; personId?: string; confidence: number } | null> {
    return this.activeService.identifyFace(classId, imageBuffer, candidates, indexNumberHint);
  }

  syncClass(
    classId: string,
    className: string,
    students: { id: string; fullName: string; imagePaths: string[] }[],
  ): Promise<SyncStudentResult[]> {
    return this.activeService.syncClass(classId, className, students);
  }

  /**
   * Standalone diagnostic helper: detects a face via Face++ and returns a temporary face_token.
   */
  async testDetectFace(imageBuffer: Buffer): Promise<{
    provider: string;
    detected: boolean;
    faceCount: number;
    faceToken: string | null;
    message: string;
  }> {
    const res = await this.facePlusPlusService.postFacePP('/detect', {
      image_base64: imageBuffer.toString('base64'),
    });
    const faces: any[] = Array.isArray(res.faces) ? res.faces : [];
    return {
      provider: this.providerName,
      detected: faces.length > 0,
      faceCount: faces.length,
      faceToken: faces[0]?.face_token || null,
      message:
        faces.length > 0
          ? `Detected ${faces.length} face(s) via Face++.`
          : 'No face detected. Ensure eyes, nose, and mouth are clearly visible.',
    };
  }

  /**
   * Standalone diagnostic helper: compares a face_token against a second image via Face++ /compare.
   */
  async testCompareFace(
    faceToken1: string,
    imageBuffer2: Buffer,
  ): Promise<{
    provider: string;
    matched: boolean;
    confidence: number;
    requiredThreshold: number;
    message: string;
  }> {
    const res = await this.facePlusPlusService.postFacePP('/compare', {
      face_token1: faceToken1,
      image_base64_2: imageBuffer2.toString('base64'),
    });
    const confidence = Number(res.confidence || 0);
    const strictThreshold = Number(
      res.thresholds?.['1e-4'] ?? res.thresholds?.['1e-5'] ?? 70,
    );
    const requiredThreshold = Math.max(strictThreshold, 70);
    const matched = confidence >= requiredThreshold;
    return {
      provider: this.providerName,
      matched,
      confidence: Number(confidence.toFixed(2)),
      requiredThreshold: Number(requiredThreshold.toFixed(2)),
      message: matched
        ? `Match confirmed (${confidence.toFixed(1)}% >= ${requiredThreshold.toFixed(1)}%).`
        : `Confidence too low (${confidence.toFixed(1)}% < ${requiredThreshold.toFixed(1)}% required).`,
    };
  }
}
