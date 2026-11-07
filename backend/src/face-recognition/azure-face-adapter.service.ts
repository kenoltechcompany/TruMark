import { Injectable } from '@nestjs/common';
import { AzureFaceService } from '../azure-face/azure-face.service';
import {
  IFaceRecognitionService,
  CandidateStudentEmbedding,
  SyncStudentResult,
} from './face-recognition.interface';

@Injectable()
export class AzureFaceAdapterService implements IFaceRecognitionService {
  readonly providerName = 'azure';

  constructor(private readonly azureFace: AzureFaceService) {}

  async extractEmbedding(_imageBuffers: Buffer[]): Promise<number[]> {
    // Azure Face does not expose raw feature vectors; person registration is managed in cloud LargePersonGroups.
    return [];
  }

  async identifyFace(
    classId: string,
    imageBuffer: Buffer,
    _candidates?: CandidateStudentEmbedding[],
  ): Promise<{ personId?: string; confidence: number } | null> {
    const result = await this.azureFace.identifyFace(classId, imageBuffer);
    if (!result) return null;
    return {
      personId: result.personId,
      confidence: result.confidence,
    };
  }

  async syncClass(
    classId: string,
    className: string,
    students: { id: string; fullName: string; imagePaths: string[] }[],
  ): Promise<SyncStudentResult[]> {
    const res = await this.azureFace.syncClassToAzure(classId, className, students);
    return res.map((r) => ({
      id: r.id,
      azurePersonId: r.azurePersonId,
    }));
  }
}
