import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { InsightFaceService } from './insightface.service';
import {
  IFaceRecognitionService,
  CandidateStudentEmbedding,
  SyncStudentResult,
} from './face-recognition.interface';

@Injectable()
export class FacePlusPlusService implements IFaceRecognitionService {
  readonly providerName = 'facepp';
  private readonly logger = new Logger(FacePlusPlusService.name);

  private readonly apiKey = process.env.FACEPP_API_KEY || '';
  private readonly apiSecret = process.env.FACEPP_API_SECRET || '';
  private readonly baseUrl = (
    process.env.FACEPP_BASE_URL || 'https://api-us.faceplusplus.com/facepp/v3'
  ).replace(/\/$/, '');
  private readonly minConfidence = Number(process.env.FACEPP_CONFIDENCE_THRESHOLD || 70);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insightFace: InsightFaceService,
  ) {}

  private ensureConfigured() {
    if (!this.apiKey || !this.apiSecret) {
      throw new BadRequestException(
        'Face++ API credentials (FACEPP_API_KEY and FACEPP_API_SECRET) are not configured in .env.',
      );
    }
  }

  /**
   * Calls Face++ REST API with automatic backoff retry on CONCURRENCY_LIMIT_EXCEEDED.
   */
  async postFacePP(
    endpoint: string,
    params: Record<string, string>,
    retries = 4,
  ): Promise<any> {
    this.ensureConfigured();

    const body = new URLSearchParams({
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      ...params,
    });

    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data: any = await response.json().catch(() => ({}));

      if (response.ok && !data.error_message) {
        return data;
      }

      const errMsg: string = data.error_message || `HTTP ${response.status}`;

      // Retry automatically when hitting Face++ QPS rate limits
      if (errMsg.includes('CONCURRENCY_LIMIT_EXCEEDED') && attempt < retries) {
        const delayMs = attempt * 650 + Math.floor(Math.random() * 250);
        this.logger.warn(
          `Face++ rate limit hit on ${endpoint}, retrying in ${delayMs}ms (attempt ${attempt}/${retries})...`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      throw new Error(`Face++ API error (${endpoint}): ${errMsg}`);
    }
  }

  async extractEmbedding(imageBuffers: Buffer[]): Promise<number[]> {
    // Also extract local 512-d vector if local service is available for <1ms candidate pre-ranking
    try {
      return await this.insightFace.extractEmbedding(imageBuffers);
    } catch {
      return [];
    }
  }

  /**
   * Validates a student's reference photo(s) via Face++ /detect and returns the primary face_token.
   */
  async enrollStudentFace(_classId: string, imageBuffers: Buffer[]): Promise<string | null> {
    for (const buf of imageBuffers) {
      try {
        const detectRes = await this.postFacePP('/detect', {
          image_base64: buf.toString('base64'),
        });

        const faces = detectRes.faces || [];
        if (faces.length === 0) continue;

        const faceToken: string = faces[0].face_token;
        this.logger.log(`Detected & enrolled Face++ face_token: ${faceToken}`);
        return faceToken;
      } catch (err: any) {
        this.logger.warn(`Face++ detect attempt failed: ${err.message}`);
      }
    }
    return null;
  }

  /**
   * Identifies a check-in selfie against enrolled students in the class using Face++ /compare.
   * Uses local 512-d vectors (when available) to shortlist the top candidate in <1ms so only
   * a single Face++ /compare call is needed per check-in.
   */
  async identifyFace(
    classId: string,
    imageBuffer: Buffer,
    _candidates?: CandidateStudentEmbedding[],
  ): Promise<{ studentId?: string; personId?: string; confidence: number } | null> {
    const enrolled = await this.prisma.student.findMany({
      where: { classId },
      select: {
        id: true,
        fullName: true,
        azurePersonId: true,
        imagePaths: true,
        faceEmbedding: true,
      },
    });

    // Keep students who have either a reference photo on disk or a Face++ face_token
    let orderedCandidates = enrolled.filter(
      (s) =>
        Boolean(s.azurePersonId) ||
        (s.imagePaths && s.imagePaths.some((p) => existsSync(p))),
    );

    // Pre-rank with local 512-d embedding if available so the matching student is checked first
    const withEmbeddings = enrolled.filter(
      (s) => s.faceEmbedding && s.faceEmbedding.length > 0,
    );
    if (withEmbeddings.length > 0) {
      try {
        const localMatch = await this.insightFace.identifyFace(
          classId,
          imageBuffer,
          withEmbeddings.map((s) => ({
            studentId: s.id,
            embedding: s.faceEmbedding,
          })),
        );
        if (localMatch?.studentId) {
          const topStudent = enrolled.find((s) => s.id === localMatch.studentId);
          if (topStudent) {
            orderedCandidates = [
              topStudent,
              ...orderedCandidates.filter((s) => s.id !== topStudent.id),
            ];
          }
        }
      } catch {
        // Ignore if local service is offline; fall back to direct Face++ /compare
      }
    }

    if (orderedCandidates.length === 0) {
      throw new BadRequestException(
        'No enrolled students with reference photos or Face++ tokens found in this class.',
      );
    }

    const probeBase64 = imageBuffer.toString('base64');

    for (const candidate of orderedCandidates) {
      const validImagePath = (candidate.imagePaths || []).find((p) => existsSync(p));
      const compareParams: Record<string, string> = {
        image_base64_2: probeBase64,
      };

      if (validImagePath) {
        compareParams.image_base64_1 = readFileSync(validImagePath).toString('base64');
      } else if (candidate.azurePersonId) {
        compareParams.face_token1 = candidate.azurePersonId;
      } else {
        continue;
      }

      try {
        const cmpRes = await this.postFacePP('/compare', compareParams);
        const confidence100 = Number(cmpRes.confidence || 0);
        const dynamicThreshold = Number(cmpRes.thresholds?.['1e-4'] ?? this.minConfidence);
        const requiredScore = Math.max(dynamicThreshold, this.minConfidence);

        this.logger.log(
          `Face++ /compare against ${candidate.fullName}: confidence=${confidence100.toFixed(2)}% (threshold=${requiredScore.toFixed(2)}%)`,
        );

        if (confidence100 >= requiredScore) {
          return {
            studentId: candidate.id,
            personId: candidate.azurePersonId || undefined,
            confidence: Number((confidence100 / 100).toFixed(4)),
          };
        }
      } catch (err: any) {
        this.logger.warn(
          `Face++ /compare skipped for ${candidate.fullName}: ${err.message}`,
        );
      }
    }

    return null;
  }

  /**
   * Syncs unsynced students in a class with Face++ /detect (and local embeddings if available).
   */
  async syncClass(
    classId: string,
    _className: string,
    students: { id: string; fullName: string; imagePaths: string[] }[],
  ): Promise<SyncStudentResult[]> {
    const synced: SyncStudentResult[] = [];

    for (const student of students) {
      const buffers = (student.imagePaths || [])
        .filter((p) => existsSync(p))
        .map((p) => readFileSync(p));

      if (buffers.length === 0) continue;

      const faceToken = await this.enrollStudentFace(classId, buffers);
      const faceEmbedding = await this.extractEmbedding(buffers);

      if (faceToken || faceEmbedding.length > 0) {
        synced.push({
          id: student.id,
          azurePersonId: faceToken || undefined,
          faceEmbedding: faceEmbedding.length > 0 ? faceEmbedding : undefined,
        });
      }
    }

    return synced;
  }
}
