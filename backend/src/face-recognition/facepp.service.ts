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

  // Global Face++ API serialization queue to prevent CONCURRENCY_LIMIT_EXCEEDED when multiple students check in simultaneously
  private apiQueue: Promise<any> = Promise.resolve();
  // In-memory cache of classId -> FaceSet outer_id once synced
  private readonly syncedFaceSets = new Set<string>();

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

  private getOuterId(classId: string): string {
    return `trumark_class_${classId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
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
   * Serializes and calls Face++ REST API with automatic backoff retry on CONCURRENCY_LIMIT_EXCEEDED.
   */
  async postFacePP(
    endpoint: string,
    params: Record<string, string>,
    retries = 5,
  ): Promise<any> {
    this.ensureConfigured();

    const executeRequest = async () => {
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
          const delayMs = attempt * 450 + Math.floor(Math.random() * 200);
          this.logger.warn(
            `Face++ rate limit hit on ${endpoint}, retrying in ${delayMs}ms (attempt ${attempt}/${retries})...`,
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        throw new Error(`Face++ API error (${endpoint}): ${errMsg}`);
      }
    };

    const next = this.apiQueue.then(executeRequest, executeRequest);
    this.apiQueue = next.catch(() => {});
    return next;
  }

  async extractEmbedding(imageBuffers: Buffer[]): Promise<number[]> {
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
   * Ensures a permanent Face++ FaceSet exists for the class and adds the face_token to it so it never expires and supports O(1) /search.
   */
  private async addTokenToClassFaceSet(classId: string, faceToken: string): Promise<void> {
    const outerId = this.getOuterId(classId);
    try {
      await this.postFacePP('/faceset/create', {
        outer_id: outerId,
        display_name: outerId,
        face_tokens: faceToken,
        force_merge: '1',
      });
    } catch (err: any) {
      this.logger.warn(`FaceSet add token warning (${outerId}): ${err.message}`);
    }
  }

  /**
   * Validates a student's reference photo(s) via Face++ /detect, permanently binds the face_token to the class FaceSet, and returns the primary face_token.
   */
  async enrollStudentFace(classId: string, imageBuffers: Buffer[]): Promise<string | null> {
    for (const buf of imageBuffers) {
      try {
        const detectRes = await this.postFacePP('/detect', {
          image_base64: buf.toString('base64'),
        });

        const faces = detectRes.faces || [];
        if (faces.length === 0) continue;

        const faceToken: string = faces[0].face_token;
        await this.addTokenToClassFaceSet(classId, faceToken);
        this.logger.log(`Detected & enrolled Face++ face_token into FaceSet: ${faceToken}`);
        return faceToken;
      } catch (err: any) {
        this.logger.warn(`Face++ detect attempt failed: ${err.message}`);
      }
    }
    return null;
  }

  /**
   * Identifies a check-in selfie against enrolled students in the class in < 1.5s:
   * 1. If indexNumberHint is provided, performs an instant O(1) 1:1 /compare against that student first.
   * 2. Otherwise attempts an O(1) Face++ /search against the class FaceSet.
   * 3. Backfills any missing `azurePersonId` tokens and adds them to the class FaceSet automatically so subsequent check-ins are O(1).
   */
  async identifyFace(
    classId: string,
    imageBuffer: Buffer,
    _candidates?: CandidateStudentEmbedding[],
    indexNumberHint?: string,
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

    // ── Fast Path 1: Instant 1:1 Verification if Index Number Hint was supplied ──
    if (indexNumberHint && indexNumberHint.trim()) {
      const target = orderedCandidates.find(
        (s) => s.indexNumber.toLowerCase() === indexNumberHint.trim().toLowerCase(),
      );
      if (target) {
        const match = await this.compareSingleCandidate(classId, target, probeBase64);
        if (match) return match;
      }
    }

    // ── Fast Path 2: O(1) FaceSet /search across all students with azurePersonId ──
    const studentsWithTokens = orderedCandidates.filter((s) => Boolean(s.azurePersonId));
    if (studentsWithTokens.length > 0) {
      const outerId = this.getOuterId(classId);
      // Ensure existing tokens are registered in the class FaceSet once per server boot
      if (!this.syncedFaceSets.has(classId)) {
        try {
          const tokenChunks: string[][] = [];
          const allTokens = studentsWithTokens
            .map((s) => s.azurePersonId!)
            .filter(Boolean);
          for (let i = 0; i < allTokens.length; i += 5) {
            tokenChunks.push(allTokens.slice(i, i + 5));
          }
          for (const chunk of tokenChunks) {
            await this.postFacePP('/faceset/create', {
              outer_id: outerId,
              display_name: outerId,
              face_tokens: chunk.join(','),
              force_merge: '1',
            });
          }
          this.syncedFaceSets.add(classId);
        } catch {
          // Fall through if FaceSet sync fails
        }
      }

      try {
        const searchRes = await this.postFacePP('/search', {
          image_base64: probeBase64,
          outer_id: outerId,
          return_result_count: '1',
        });

        const topResult = searchRes.results?.[0];
        if (topResult && topResult.face_token) {
          const confidence100 = Number(topResult.confidence || 0);
          const strictThreshold = Number(
            searchRes.thresholds?.['1e-5'] ??
              searchRes.thresholds?.['1e-4'] ??
              this.minConfidence,
          );
          const requiredScore = Math.max(strictThreshold, this.minConfidence);

          const matchedStudent = studentsWithTokens.find(
            (s) => s.azurePersonId === topResult.face_token,
          );

          if (matchedStudent && confidence100 >= requiredScore) {
            this.logger.log(
              `Face++ O(1) /search matched ${matchedStudent.fullName} (${matchedStudent.indexNumber}): confidence=${confidence100.toFixed(2)}%`,
            );
            return {
              studentId: matchedStudent.id,
              personId: matchedStudent.azurePersonId || undefined,
              confidence: Number((confidence100 / 100).toFixed(4)),
            };
          }
        }
      } catch (err: any) {
        this.logger.warn(`Face++ /search fallback to /compare: ${err.message}`);
      }
    }

    // ── Path 3: Compare against candidates (prioritizing students missing azurePersonId & caching their new face_token) ──
    const candidatesToCompare = [
      ...orderedCandidates.filter((s) => !s.azurePersonId),
      ...orderedCandidates.filter((s) => Boolean(s.azurePersonId)),
    ];

    let bestMatch: {
      studentId: string;
      fullName: string;
      personId?: string;
      confidence100: number;
    } | null = null;

    for (const candidate of candidatesToCompare) {
      const res = await this.compareSingleCandidate(classId, candidate, probeBase64);
      if (res) {
        const conf100 = res.confidence * 100;
        if (!bestMatch || conf100 > bestMatch.confidence100) {
          bestMatch = {
            studentId: candidate.id,
            fullName: candidate.fullName,
            personId: res.personId,
            confidence100: conf100,
          };
        }
        // Short-circuit immediately on >= 86% confidence to keep latency low
        if (conf100 >= 86) {
          break;
        }
      }
    }

    if (bestMatch) {
      return {
        studentId: bestMatch.studentId,
        personId: bestMatch.personId,
        confidence: Number((bestMatch.confidence100 / 100).toFixed(4)),
      };
    }

    return null;
  }

  /**
   * Compares a single candidate against the probe selfie and automatically caches `face_token1` into `azurePersonId` + class FaceSet if missing.
   */
  private async compareSingleCandidate(
    classId: string,
    candidate: {
      id: string;
      fullName: string;
      indexNumber: string;
      azurePersonId: string | null;
      imagePaths: string[];
    },
    probeBase64: string,
  ): Promise<{ studentId: string; personId?: string; confidence: number } | null> {
    const refBase64 = this.extractReferenceBase64(candidate.imagePaths);
    const compareParams: Record<string, string> = {
      image_base64_2: probeBase64,
    };

    if (candidate.azurePersonId) {
      compareParams.face_token1 = candidate.azurePersonId;
    } else if (refBase64) {
      compareParams.image_base64_1 = refBase64;
    } else {
      return null;
    }

    try {
      let cmpRes: any;
      try {
        cmpRes = await this.postFacePP('/compare', compareParams);
      } catch (innerErr: any) {
        // If stored face_token1 expired on Face++, retry using raw reference base64 image
        if (candidate.azurePersonId && refBase64) {
          delete compareParams.face_token1;
          compareParams.image_base64_1 = refBase64;
          cmpRes = await this.postFacePP('/compare', compareParams);
        } else {
          throw innerErr;
        }
      }

      // Auto-cache face_token1 onto student record & FaceSet if it wasn't saved yet
      const detectedRefToken: string | undefined = cmpRes.faces1?.[0]?.face_token;
      if (detectedRefToken && detectedRefToken !== candidate.azurePersonId) {
        candidate.azurePersonId = detectedRefToken;
        this.prisma.student
          .update({
            where: { id: candidate.id },
            data: { azurePersonId: detectedRefToken },
          })
          .catch(() => {});
        this.addTokenToClassFaceSet(classId, detectedRefToken).catch(() => {});
      }

      const confidence100 = Number(cmpRes.confidence || 0);
      const strictThreshold = Number(
        cmpRes.thresholds?.['1e-5'] ?? cmpRes.thresholds?.['1e-4'] ?? this.minConfidence,
      );
      const requiredScore = Math.max(strictThreshold, this.minConfidence);

      this.logger.log(
        `Face++ /compare against ${candidate.fullName} (${candidate.indexNumber}): confidence=${confidence100.toFixed(2)}% (required=${requiredScore.toFixed(2)}%)`,
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
