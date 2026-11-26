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
    process.env.FACEPP_API_KEY || 'HgBygdnQNF5vAkHU4_Bbuizojb0PEssW';
  private readonly apiSecret =
    process.env.FACEPP_API_SECRET || 'IX4zugBmfSeOQO-i9dqSWEj0FiC4xfyo';
  private readonly baseUrl = (
    process.env.FACEPP_BASE_URL ||
    process.env.FACEPP_API_URL ||
    'https://api-us.faceplusplus.com/facepp/v3'
  ).replace(/\/$/, '');
  // Strict 1e-5 FAR+ threshold (default 78%) to eliminate false-positive matches for unregistered faces
  private readonly minConfidence = Number(process.env.FACEPP_CONFIDENCE_THRESHOLD || 78);

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

        if (
          errMsg.includes('FREE_CALL_COUNT_LIMIT') ||
          errMsg.includes('INSUFFICIENT_BALANCE')
        ) {
          throw new BadRequestException(
            'Facial recognition API quota has been reached (Face++ FREE_CALL_COUNT_LIMIT). Please contact your administrator to top up or update the Face++ API credentials.',
          );
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
   * Identifies a check-in selfie against enrolled students in the class:
   * 1. Calls /detect ONCE on the probe selfie to validate a clear face exists and get a lightweight `probeFaceToken`.
   * 2. If indexNumberHint is provided, performs an instant O(1) 1:1 /compare against that student.
   * 3. Attempts Face++ /search using `probeFaceToken`; if /search returns empty/unmatched, falls back to fast token-to-token /compare (prioritizing newest & tokenized students, short-circuiting at >= 80%).
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
      },
      orderBy: { createdAt: 'desc' },
    });

    if (enrolled.length === 0) {
      throw new BadRequestException(
        'No enrolled students with reference photos or Face++ tokens found in this class.',
      );
    }

    const probeBase64 = imageBuffer.toString('base64');

    // Step 1: Validate probe image via Face++ /detect once (~200ms) to get a lightweight face_token
    const detectRes = await this.postFacePP('/detect', {
      image_base64: probeBase64,
    });
    const detectedFaces: any[] = Array.isArray(detectRes.faces) ? detectRes.faces : [];
    if (detectedFaces.length === 0 || !detectedFaces[0]?.face_token) {
      throw new BadRequestException(
        'No clear face detected in the camera frame. Please tilt your camera or sit back so your eyes, nose, and mouth are all inside the oval.',
      );
    }
    const probeFaceToken: string = detectedFaces[0].face_token;

    // Helper to lazily load imagePaths only when a student lacks a valid azurePersonId
    const loadImagePathsMap = async (studentIds: string[]): Promise<Map<string, string[]>> => {
      if (studentIds.length === 0) return new Map();
      const rows = await this.prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, imagePaths: true },
      });
      return new Map(rows.map((r) => [r.id, r.imagePaths]));
    };

    // ── Fast Path 1: Strict 1:1 Verification when Index Number is supplied ──
    if (indexNumberHint && indexNumberHint.trim()) {
      const cleanId = indexNumberHint.trim();
      const target = enrolled.find(
        (s) => s.indexNumber.toLowerCase() === cleanId.toLowerCase(),
      );
      if (!target) {
        throw new BadRequestException(
          `No student with Index Number "${cleanId}" is enrolled in this class.`,
        );
      }

      const pathsMap = target.azurePersonId
        ? new Map<string, string[]>()
        : await loadImagePathsMap([target.id]);
      const targetPaths = pathsMap.get(target.id) || [];
      const hasAnyBiometric =
        Boolean(target.azurePersonId) || Boolean(this.extractReferenceBase64(targetPaths));

      if (!hasAnyBiometric) {
        throw new BadRequestException(
          `No facial biometric data is enrolled yet for ${target.fullName} (${cleanId}). Please enroll your face first.`,
        );
      }

      let seenConf = 0;
      const match = await this.compareSingleCandidate(
        classId,
        { ...target, imagePaths: targetPaths },
        probeBase64,
        probeFaceToken,
        (c) => {
          seenConf = c;
        },
        true,
      );
      if (match) return match;

      throw new BadRequestException(
        seenConf > 0
          ? `Face does not match the enrolled profile for ${target.fullName} (${cleanId}) (${seenConf.toFixed(1)}% vs ${this.minConfidence.toFixed(1)}% required).`
          : `Could not verify face for ${target.fullName} (${cleanId}). Please try again in clear lighting.`,
      );
    }

    // ── Fast Path 2: O(1) FaceSet /search using probeFaceToken ──
    const studentsWithTokens = enrolled.filter((s) => Boolean(s.azurePersonId));
    let highestSearchConfidence = 0;

    if (studentsWithTokens.length > 0) {
      const outerId = this.getOuterId(classId);
      try {
        const searchRes = await this.postFacePP('/search', {
          face_token: probeFaceToken,
          outer_id: outerId,
          return_result_count: '5',
        });

        const results: any[] = Array.isArray(searchRes.results) ? searchRes.results : [];
        const strictThreshold = Number(
          searchRes.thresholds?.['1e-5'] ??
            searchRes.thresholds?.['1e-4'] ??
            this.minConfidence,
        );
        const requiredScore = Math.max(strictThreshold, this.minConfidence);

        for (const r of results) {
          if (!r?.face_token) continue;
          const owner = studentsWithTokens.find((s) => s.azurePersonId === r.face_token);
          if (!owner) continue;
          const conf = Number(r.confidence || 0);
          if (conf > highestSearchConfidence) highestSearchConfidence = conf;
          if (conf >= requiredScore) {
            this.logger.log(
              `Face++ /search matched ${owner.fullName} (${owner.indexNumber}): confidence=${conf.toFixed(2)}%`,
            );
            return {
              studentId: owner.id,
              personId: owner.azurePersonId || undefined,
              confidence: Number((conf / 100).toFixed(4)),
            };
          }
        }
      } catch (err: any) {
        this.logger.warn(`Face++ /search fallback to /compare: ${err.message}`);
      }
    }

    // ── Path 3: Fast token-to-token /compare fallback (when /search returns empty or no match) ──
    // Prioritize students WITH azurePersonId (token-to-token ~200ms/call) then students without tokens
    const candidatesToCompare = [
      ...studentsWithTokens,
      ...enrolled.filter((s) => !s.azurePersonId),
    ];

    const missingTokenIds = enrolled.filter((s) => !s.azurePersonId).map((s) => s.id);
    const pathsMap = await loadImagePathsMap(missingTokenIds);

    let bestMatch: {
      studentId: string;
      fullName: string;
      personId?: string;
      confidence100: number;
    } | null = null;
    let secondBestConfidence100 = 0;
    let highestSeenConfidence = highestSearchConfidence;

    for (const candidate of candidatesToCompare) {
      const imagePaths = pathsMap.get(candidate.id) || [];
      if (!candidate.azurePersonId && !this.extractReferenceBase64(imagePaths)) {
        continue;
      }
      const res = await this.compareSingleCandidate(
        classId,
        { ...candidate, imagePaths },
        probeBase64,
        probeFaceToken,
        (seenConf) => {
          if (seenConf > highestSeenConfidence) highestSeenConfidence = seenConf;
        },
      );
      if (res) {
        const conf100 = res.confidence * 100;
        if (!bestMatch || conf100 > bestMatch.confidence100) {
          if (bestMatch) {
            secondBestConfidence100 = Math.max(
              secondBestConfidence100,
              bestMatch.confidence100,
            );
          }
          bestMatch = {
            studentId: candidate.id,
            fullName: candidate.fullName,
            personId: res.personId,
            confidence100: conf100,
          };
        } else {
          secondBestConfidence100 = Math.max(secondBestConfidence100, conf100);
        }
        // Only short-circuit early on high-certainty matches (>= 88%)
        if (conf100 >= 88) {
          break;
        }
      }
    }

    if (bestMatch) {
      // Reject ambiguous borderline matches where two different students score within 3% below 85%
      if (
        bestMatch.confidence100 < 85 &&
        secondBestConfidence100 > 0 &&
        bestMatch.confidence100 - secondBestConfidence100 < 3
      ) {
        this.logger.warn(
          `Ambiguous Face++ match rejected: ${bestMatch.fullName} (${bestMatch.confidence100.toFixed(2)}%) vs runner-up (${secondBestConfidence100.toFixed(2)}%)`,
        );
        throw new BadRequestException(
          'Face not recognized with sufficient certainty. Please ensure you are enrolled in this class and try again in clear lighting.',
        );
      }
      return {
        studentId: bestMatch.studentId,
        personId: bestMatch.personId,
        confidence: Number((bestMatch.confidence100 / 100).toFixed(4)),
      };
    }

    if (highestSeenConfidence > 0) {
      throw new BadRequestException(
        `Face confidence too low (best match ${highestSeenConfidence.toFixed(1)}% vs ${this.minConfidence.toFixed(1)}% required). Please center your face in good lighting and try again.`,
      );
    }

    return null;
  }

  /**
   * Compares a single candidate against the probe selfie (using `probeFaceToken` when available) and automatically caches `face_token1` if missing.
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
    probeFaceToken?: string,
    onConfidenceSeen?: (confidence100: number) => void,
    rethrowApiErrors = false,
  ): Promise<{ studentId: string; personId?: string; confidence: number } | null> {
    const compareParams: Record<string, string> = probeFaceToken
      ? { face_token2: probeFaceToken }
      : { image_base64_2: probeBase64 };

    let refBase64: string | null = null;
    if (candidate.azurePersonId) {
      compareParams.face_token1 = candidate.azurePersonId;
    } else {
      refBase64 = this.extractReferenceBase64(candidate.imagePaths);
      if (!refBase64) return null;
      compareParams.image_base64_1 = refBase64;
    }

    try {
      let cmpRes: any;
      try {
        cmpRes = await this.postFacePP('/compare', compareParams);
      } catch (innerErr: any) {
        // If stored face_token1 expired on Face++, lazily fetch imagePaths and retry with image_base64_1
        if (candidate.azurePersonId) {
          if (!refBase64) {
            const row = await this.prisma.student.findUnique({
              where: { id: candidate.id },
              select: { imagePaths: true },
            });
            refBase64 = this.extractReferenceBase64(row?.imagePaths);
          }
          if (refBase64) {
            delete compareParams.face_token1;
            compareParams.image_base64_1 = refBase64;
            cmpRes = await this.postFacePP('/compare', compareParams);
          } else {
            throw innerErr;
          }
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
      if (onConfidenceSeen) onConfidenceSeen(confidence100);

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
      const msg = String(err?.message || '');
      if (
        msg.includes('FREE_CALL_COUNT_LIMIT') ||
        msg.includes('INSUFFICIENT_BALANCE') ||
        msg.includes('AUTHENTICATION_ERROR')
      ) {
        throw new BadRequestException(
          'Facial recognition API quota has been reached (Face++ FREE_CALL_COUNT_LIMIT). Please contact your administrator to update or top up the Face++ API credentials.',
        );
      }
      if (msg.includes('CONCURRENCY_LIMIT_EXCEEDED') && rethrowApiErrors) {
        throw new BadRequestException(
          'Facial recognition service is momentarily busy (rate limit). Please wait 2 seconds and tap Try Again.',
        );
      }
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
