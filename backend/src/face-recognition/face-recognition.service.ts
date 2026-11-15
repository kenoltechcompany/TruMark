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
}
