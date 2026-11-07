import { Injectable, Logger } from '@nestjs/common';
import {
  IFaceRecognitionService,
  CandidateStudentEmbedding,
  SyncStudentResult,
} from './face-recognition.interface';
import { InsightFaceService } from './insightface.service';
import { AzureFaceAdapterService } from './azure-face-adapter.service';

@Injectable()
export class FaceRecognitionService implements IFaceRecognitionService {
  private readonly logger = new Logger(FaceRecognitionService.name);
  private activeService: IFaceRecognitionService;

  constructor(
    private readonly insightFaceService: InsightFaceService,
    private readonly azureAdapterService: AzureFaceAdapterService,
  ) {
    const configuredProvider = (process.env.FACE_PROVIDER || 'insightface').toLowerCase();

    if (configuredProvider === 'azure') {
      this.activeService = this.azureAdapterService;
      this.logger.log('Face Recognition active provider: Azure Face');
    } else {
      this.activeService = this.insightFaceService;
      this.logger.log('Face Recognition active provider: InsightFace (Local on-premises)');
    }
  }

  get providerName(): 'insightface' | 'azure' {
    return this.activeService.providerName;
  }

  extractEmbedding(imageBuffers: Buffer[]): Promise<number[]> {
    return this.activeService.extractEmbedding(imageBuffers);
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
