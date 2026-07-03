import { Injectable, Logger } from '@nestjs/common';
import FaceClient, { isUnexpected } from '@azure-rest/ai-vision-face';
import { readFileSync } from 'fs';

/**
 * Azure Face API integration for TruMark.
 *
 * Manages LargePersonGroups (one per class), person registration with 3 photos,
 * face detection, and identification for attendance check-in.
 */
@Injectable()
export class AzureFaceService {
  private readonly logger = new Logger(AzureFaceService.name);
  private client: ReturnType<typeof FaceClient>;

  constructor() {
    const endpoint = process.env.AZURE_FACE_ENDPOINT;
    const key = process.env.AZURE_FACE_KEY;

    if (!endpoint || !key) {
      this.logger.warn(
        'AZURE_FACE_ENDPOINT or AZURE_FACE_KEY not set. Azure Face features will fail at runtime.',
      );
    }

    this.client = FaceClient(endpoint!, { key: key! });
  }

  /**
   * Creates or reuses a LargePersonGroup for the given class.
   * Then creates persons for students missing an azurePersonId,
   * uploads their images, trains the group, and saves the IDs.
   */
  async syncClassToAzure(
    classId: string,
    className: string,
    students: { id: string; fullName: string; imagePaths: string[] }[],
  ) {
    this.logger.log(`Syncing class ${classId} (${className}) to Azure...`);

    // 1. Create or update the LargePersonGroup
    const groupResult = await this.client
      .path('/largepersongroups/{largePersonGroupId}', classId)
      .put({ body: { name: className, recognitionModel: 'recognition_04' } });
    if (isUnexpected(groupResult)) {
      throw new Error(`Failed to create LargePersonGroup: ${groupResult.body.error.message}`);
    }

    const updatedStudents: { id: string; azurePersonId: string }[] = [];

    for (const student of students) {
      // 2. Create person in the group
      const personResult = await this.client
        .path('/largepersongroups/{largePersonGroupId}/persons', classId)
        .post({ body: { name: student.fullName } });
      if (isUnexpected(personResult)) {
        this.logger.error(`Failed to create person for ${student.fullName}: ${personResult.body.error.message}`);
        continue;
      }

      const personId = personResult.body.personId;
      this.logger.log(`Created person ${personId} for ${student.fullName}`);

      // 3. Upload each of the 3 images
      for (const imagePath of student.imagePaths) {
        try {
          const imageBuffer = readFileSync(imagePath);
          const faceResult = await this.client
            .path(
              '/largepersongroups/{largePersonGroupId}/persons/{personId}/persistedfaces',
              classId,
              personId,
            )
            .post({
              contentType: 'application/octet-stream',
              body: imageBuffer,
              queryParameters: { detectionModel: 'detection_03' },
            });
          if (isUnexpected(faceResult)) {
            this.logger.warn(`Failed to add face for ${student.fullName}: ${faceResult.body.error.message}`);
          }
        } catch (err) {
          this.logger.warn(`Could not read/upload image ${imagePath}: ${err}`);
        }
      }

      updatedStudents.push({ id: student.id, azurePersonId: personId });
    }

    // 4. Train the group
    const trainResult = await this.client
      .path('/largepersongroups/{largePersonGroupId}/train', classId)
      .post();
    if (isUnexpected(trainResult)) {
      throw new Error(`Training failed: ${trainResult.body.error.message}`);
    }

    this.logger.log(`Training initiated for group ${classId}`);

    return updatedStudents;
  }

  /**
   * Detects a face in the image buffer and identifies it against the class's
   * LargePersonGroup. Returns the personId and confidence if a match is found.
   */
  async identifyFace(
    classId: string,
    imageBuffer: Buffer,
  ): Promise<{ personId: string; confidence: number } | null> {
    // 1. Detect face
    const detectResult = await this.client
      .path('/detect')
      .post({
        contentType: 'application/octet-stream',
        body: imageBuffer,
        queryParameters: {
          detectionModel: 'detection_03',
          recognitionModel: 'recognition_04',
          returnFaceId: true,
        },
      });
    if (isUnexpected(detectResult) || !detectResult.body.length) {
      return null; // No face detected
    }

    const faceId = detectResult.body[0].faceId;
    if (!faceId) return null;

    // 2. Identify against the group
    const identifyResult = await this.client
      .path('/identify')
      .post({
        body: {
          largePersonGroupId: classId,
          faceIds: [faceId] as string[],
          maxNumOfCandidatesReturned: 1,
          confidenceThreshold: 0.8,
        },
      });
    if (isUnexpected(identifyResult) || !identifyResult.body.length) {
      return null;
    }

    const candidates = identifyResult.body[0].candidates;
    if (!candidates || !candidates.length) {
      return null;
    }

    return {
      personId: candidates[0].personId,
      confidence: candidates[0].confidence,
    };
  }
}
