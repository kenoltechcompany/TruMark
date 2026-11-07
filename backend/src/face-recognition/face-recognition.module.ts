import { Module } from '@nestjs/common';
import { AzureFaceModule } from '../azure-face/azure-face.module';
import { InsightFaceService } from './insightface.service';
import { AzureFaceAdapterService } from './azure-face-adapter.service';
import { FaceRecognitionService } from './face-recognition.service';

@Module({
  imports: [AzureFaceModule],
  providers: [
    InsightFaceService,
    AzureFaceAdapterService,
    FaceRecognitionService,
  ],
  exports: [FaceRecognitionService, InsightFaceService],
})
export class FaceRecognitionModule {}
