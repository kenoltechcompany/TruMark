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
    // Default to 'facepp' in cloud deployments unless explicitly set to 'azure' or 'insightface'
    const rawProvider = process.env.FACE_PROVIDER;
    const hasInsightFaceUrl = Boolean(process.env.INSIGHTFACE_SERVICE_URL);
    const configuredProvider = (
      rawProvider || (hasInsightFaceUrl ? 'insightface' : 'facepp')
    ).toLowerCase();

    if (configuredProvider === 'facepp' || configuredProvider === 'face++') {
      this.activeService = this.facePlusPlusService;
      this.logger.log('Face Recognition active provider: Face++ (Megvii Cloud API)');
    } else if (configuredProvider === 'azure') {
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
  ): Promise<{ studentId?: string; personId?: string; confidence: number } | null> {
    return this.activeService.identifyFace(classId, imageBuffer, candidates);
  }

  syncClass(
    classId: string,
    className: string,
    students: { id: string; fullName: string; imagePaths: string[] }[],
  ): Promise<SyncStudentResult[]> {
    return this.activeService.syncClass(classId, className, students);
  }
}
