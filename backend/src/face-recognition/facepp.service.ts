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

  // Built-in default Face++ credentials so cloud deployments work out-of-the-box even if env vars are omitted
  private readonly apiKey =
    process.env.FACEPP_API_KEY || 'hI4Br1q7878QKPEv7j9mozjozQJ00KK_';
  private readonly apiSecret =
    process.env.FACEPP_API_SECRET || '3l4Dz2lg0Xq-hPkPuKXOEu-Sh8KyK6uR';
  private readonly baseUrl = (
    process.env.FACEPP_BASE_URL ||
    process.env.FACEPP_API_URL ||
    'https://api-us.faceplusplus.com/facepp/v3'
  ).replace(/\/$/, '');
  // Strict 1e-5 FAR threshold (default 80%) to prevent false-positive matches across students
  private readonly minConfidence = Number(process.env.FACEPP_CONFIDENCE_THRESHOLD || 80);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insightFace: InsightFaceService,
  ) {}

  private ensureConfigured() {
    if (!this.apiKey || !this.apiSecret) {
      throw new BadRequestException(
        'Face++ API credentials (FACEPP_API_KEY and FACEPP_API_SECRET) are not configured.',
      );
    }
  }

  /**
   * Resolves a base64 JPEG string from a student's imagePaths (supports both local files and inline data:image/* URIs for ephemeral cloud hosts like Render).
   */
  private extractReferenceBase64(imagePaths: string[] | null | undefined): string | null {
    if (!imagePaths || !Array.isArray(imagePaths)) return null;

    for (const p of imagePaths) {
      if (!p) continue;
      if (p.startsWith('data:image/')) {
        const commaIdx = p.indexOf(',');
        if (commaIdx !== -1) {
          return p.slice(commaIdx + 1);
        }
      } else if (existsSync(p)) {
        try {
          return readFileSync(p).toString('base64');
        } catch {
          // continue checking other paths
        }
      }
    }
    return null;
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
    // Only call local InsightFace if INSIGHTFACE_SERVICE_URL is explicitly configured
    if (!process.env.INSIGHTFACE_SERVICE_URL) {
      return [];
    }
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
   * Evaluates ALL enrolled candidates (or uses optional indexNumber hint first) and returns ONLY the highest-confidence match above the strict 1e-5 threshold.
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
        indexNumber: true,
        azurePersonId: true,
        imagePaths: true,
        faceEmbedding: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const orderedCandidates = enrolled.filter(
      (s) =>
        Boolean(s.azurePersonId) ||
        Boolean(this.extractReferenceBase64(s.imagePaths)),
    );

    if (orderedCandidates.length === 0) {
      throw new BadRequestException(
        'No enrolled students with reference photos or Face++ tokens found in this class.',
      );
    }

    const probeBase64 = imageBuffer.toString('base64');

    let bestMatch: {
      studentId: string;
      fullName: string;
      personId?: string;
      confidence100: number;
      requiredScore: number;
    } | null = null;

    for (const candidate of orderedCandidates) {
      const refBase64 = this.extractReferenceBase64(candidate.imagePaths);
      const compareParams: Record<string, string> = {
        image_base64_2: probeBase64,
      };

      if (refBase64) {
        compareParams.image_base64_1 = refBase64;
      } else if (candidate.azurePersonId) {
        compareParams.face_token1 = candidate.azurePersonId;
      } else {
        continue;
      }

      try {
        const cmpRes = await this.postFacePP('/compare', compareParams);
        const confidence100 = Number(cmpRes.confidence || 0);
        // Use Face++'s strictest 1e-5 (0.001% false accept rate) threshold or minConfidence (80%), whichever is higher
        const strictThreshold = Number(
          cmpRes.thresholds?.['1e-5'] ?? cmpRes.thresholds?.['1e-4'] ?? this.minConfidence,
        );
        const requiredScore = Math.max(strictThreshold, this.minConfidence);

        this.logger.log(
          `Face++ /compare against ${candidate.fullName} (${candidate.indexNumber}): confidence=${confidence100.toFixed(2)}% (required=${requiredScore.toFixed(2)}%)`,
        );

        if (confidence100 >= requiredScore) {
          if (!bestMatch || confidence100 > bestMatch.confidence100) {
            bestMatch = {
              studentId: candidate.id,
              fullName: candidate.fullName,
              personId: candidate.azurePersonId || undefined,
              confidence100,
              requiredScore,
            };
          }
          // Short-circuit only if it's an unmistakable >= 90% match of the exact same person
          if (confidence100 >= 90) {
            break;
          }
        }
      } catch (err: any) {
        this.logger.warn(
          `Face++ /compare skipped for ${candidate.fullName}: ${err.message}`,
        );
      }
    }

    if (bestMatch) {
      this.logger.log(
        `Face++ BEST MATCH selected: ${bestMatch.fullName} with ${bestMatch.confidence100.toFixed(2)}% confidence`,
      );
      return {
        studentId: bestMatch.studentId,
        personId: bestMatch.personId,
        confidence: Number((bestMatch.confidence100 / 100).toFixed(4)),
      };
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
      const buffers: Buffer[] = [];
      for (const p of student.imagePaths || []) {
        if (p.startsWith('data:image/')) {
          const commaIdx = p.indexOf(',');
          if (commaIdx !== -1) {
            buffers.push(Buffer.from(p.slice(commaIdx + 1), 'base64'));
          }
        } else if (existsSync(p)) {
          buffers.push(readFileSync(p));
        }
      }

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
