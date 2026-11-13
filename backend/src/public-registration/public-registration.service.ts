import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { FaceRecognitionService } from '../face-recognition/face-recognition.service';

@Injectable()
export class PublicRegistrationService {
  private readonly logger = new Logger(PublicRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faceRecognition: FaceRecognitionService,
  ) {}

  /**
   * Checks whether a class has registrationLinkActive = true.
   * Returns the class name + status so the frontend can render the state.
   */
  async checkRegistrationStatus(classId: string) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found.');

    return {
      active: cls.registrationLinkActive,
      className: cls.name,
    };
  }

  /**
   * Registers a new student via the public self-onboarding flow.
   * If using InsightFace, extracts the 512-d biometric embedding immediately.
   */
  async registerStudent(
    classId: string,
    data: { fullName: string; indexNumber: string },
    images: (Buffer | string)[],
  ) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found.');
    if (!cls.registrationLinkActive) {
      throw new ForbiddenException('Registration is not currently active for this class.');
    }

    const existing = await this.prisma.student.findUnique({
      where: { indexNumber: data.indexNumber },
    });
    if (existing) {
      throw new BadRequestException('A student with this index number already exists in the system.');
    }

    // Extract facial embedding in-memory
    let faceEmbedding: number[] = [];
    if (this.faceRecognition.providerName === 'insightface') {
      try {
        const buffers: Buffer[] = [];
        for (const item of images) {
          if (Buffer.isBuffer(item)) {
            buffers.push(item);
          } else if (typeof item === 'string' && existsSync(item)) {
            buffers.push(readFileSync(item));
          }
        }
        if (buffers.length > 0) {
          faceEmbedding = await this.faceRecognition.extractEmbedding(buffers);
          this.logger.log(`Extracted 512-d facial embedding for new student: ${data.fullName}`);
        }
        // Explicitly clear references to free V8 heap immediately
        buffers.length = 0;
      } catch (err: any) {
        this.logger.warn(`Could not extract facial embedding during registration: ${err.message}`);
      }
    }

    return this.prisma.student.create({
      data: {
        fullName: data.fullName,
        indexNumber: data.indexNumber,
        classId,
        imagePaths: [], // Zero disk persistence - purely vector-based
        faceEmbedding,
      },
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        createdAt: true,
      },
    });
  }

  /**
   * Allows students (via mobile or web) to check their attendance records
   * and percentage by their unique index number.
   */
  async getStudentAttendanceHistory(indexNumber: string) {
    const student = await this.prisma.student.findUnique({
      where: { indexNumber: indexNumber.trim() },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            sessions: {
              select: { id: true, name: true, startTime: true, endTime: true },
              orderBy: { startTime: 'desc' },
            },
          },
        },
        attendance: {
          select: { sessionId: true, createdAt: true, confidence: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student index number not found in any class.');
    }

    const attendedSet = new Map(student.attendance.map((a) => [a.sessionId, a]));
    const totalSessions = student.class.sessions.length;
    const attendedCount = student.attendance.length;
    const percentage = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 0;

    const sessionHistory = student.class.sessions.map((sess) => {
      const att = attendedSet.get(sess.id);
      return {
        sessionId: sess.id,
        sessionName: sess.name,
        startTime: sess.startTime,
        endTime: sess.endTime,
        status: att ? 'PRESENT' : 'ABSENT',
        checkedInAt: att?.createdAt ?? null,
      };
    });

    return {
      student: {
        fullName: student.fullName,
        indexNumber: student.indexNumber,
        className: student.class.name,
        hasFaceEnrolled: Boolean(student.faceEmbedding?.length || student.azurePersonId),
      },
      summary: {
        totalSessions,
        attendedCount,
        percentage,
      },
      history: sessionHistory,
    };
  }

  /**
   * Returns session details with an isActive flag computed dynamically
   * by checking if the current server time falls between startTime and endTime.
   */
  async getSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        class: true,
        classroom: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found.');

    const settings = await this.getPublicSettings();
    const now = new Date();
    const isWithinTime = now >= session.startTime && now <= session.endTime;
    const isVirtual = Boolean(
      session.classroom.isVirtual ||
        session.classroom.name.toLowerCase().includes('online') ||
        session.classroom.name.toLowerCase().includes('virtual'),
    );

    return {
      id: session.id,
      name: session.name,
      startTime: session.startTime,
      endTime: session.endTime,
      className: session.class.name,
      classroomName: session.classroom.name,
      classroomBoundaries: {
        gpsLatitude: session.classroom.gpsLatitude,
        gpsLongitude: session.classroom.gpsLongitude,
        radiusMeters: session.classroom.radiusMeters,
      },
      isLocked: session.isLocked,
      isActive: !session.isLocked && isWithinTime,
      isVirtual,
      enableBiometricValidation: settings.enableBiometricValidation,
      enableGeofencing: settings.enableGeofencing,
    };
  }

  /**
   * Fetches public system settings such as landing page, biometric, and geofencing validation flags.
   */
  async getPublicSettings() {
    let settings = await this.prisma.systemSetting.findUnique({
      where: { id: 'default' },
    });
    if (!settings) {
      settings = await this.prisma.systemSetting.create({
        data: {
          id: 'default',
          enableLandingPage: true,
          enableBiometricValidation: true,
          enableGeofencing: true,
        },
      });
    }
    return {
      enableLandingPage: settings.enableLandingPage,
      enableBiometricValidation: settings.enableBiometricValidation,
      enableGeofencing: settings.enableGeofencing,
    };
  }

  /**
   * Core check-in flow:
   * 1. Validate session is active and unlocked
   * 2. Geofence check via Haversine (if enableGeofencing is true)
   * 3. Biometric face verification (if enableBiometricValidation is true)
   *    or Index Number verification (if enableBiometricValidation is false)
   * 4. Mark attendance
   */
  async checkIn(
    sessionId: string,
    optionsOrLat:
      | {
          latitude?: number;
          longitude?: number;
          imageBuffer?: Buffer;
          indexNumber?: string;
        }
      | number,
    longitude?: number,
    imageBuffer?: Buffer,
  ) {
    const options =
      typeof optionsOrLat === 'number'
        ? { latitude: optionsOrLat, longitude, imageBuffer }
        : optionsOrLat;
    // Fetch session with class + classroom
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        class: { select: { id: true, name: true } },
        classroom: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found.');

    if (session.isLocked) {
      throw new BadRequestException('Attendance for this session has been locked.');
    }

    // Physical check-in is disabled for Online / Virtual sessions
    const isVirtual = Boolean(
      session.classroom.isVirtual ||
        session.classroom.name.toLowerCase().includes('online') ||
        session.classroom.name.toLowerCase().includes('virtual'),
    );
    if (isVirtual) {
      throw new BadRequestException(
        'Physical biometric check-in is disabled for Online/Virtual sessions. Attendance is conducted online via the meeting bot.',
      );
    }

    // 1. Time validation
    const now = new Date();
    if (now < session.startTime || now > session.endTime) {
      throw new BadRequestException('Session is not currently active.');
    }

    const settings = await this.getPublicSettings();
    let student: { id: string; fullName: string; indexNumber: string } | null = null;
    let confidence = 1.0;

    // 2. Geofence validation (enforced independently when enableGeofencing is true)
    if (settings.enableGeofencing) {
      if (options.latitude == null || options.longitude == null) {
        throw new BadRequestException('GPS coordinates are required for classroom geofence verification.');
      }

      const distance = this.haversineDistance(
        options.latitude,
        options.longitude,
        session.classroom.gpsLatitude,
        session.classroom.gpsLongitude,
      );
      const allowedRadius = session.classroom.radiusMeters + 5; // 5m tolerance for GPS drift
      if (distance > allowedRadius) {
        throw new BadRequestException(
          `Outside classroom boundary. You are ${Math.round(distance)}m away (max ${allowedRadius}m).`,
        );
      }
    }

    // 3. Biometric Face Identification vs Index Number Check-In
    if (settings.enableBiometricValidation) {
      if (!options.imageBuffer) {
        throw new BadRequestException('A selfie image is required for biometric face verification.');
      }

      let matchedStudentId: string | null = null;

      if (this.faceRecognition.providerName === 'insightface') {
        const enrolledStudents = await this.prisma.student.findMany({
          where: { classId: session.classId },
          select: { id: true, faceEmbedding: true },
        });

        const candidates = enrolledStudents
          .filter((s) => s.faceEmbedding && s.faceEmbedding.length > 0)
          .map((s) => ({ studentId: s.id, embedding: s.faceEmbedding }));

        if (!candidates.length) {
          throw new BadRequestException(
            'No enrolled students with facial biometric data found in this class yet.',
          );
        }

        const match = await this.faceRecognition.identifyFace(
          session.classId,
          options.imageBuffer,
          candidates,
        );

        if (!match || !match.studentId) {
          throw new BadRequestException('Face not recognized or confidence too low.');
        }

        matchedStudentId = match.studentId;
        confidence = match.confidence;
      } else {
        // Azure Face identification fallback
        const match = await this.faceRecognition.identifyFace(session.classId, options.imageBuffer);
        if (!match || !match.personId) {
          throw new BadRequestException('Face not recognized or confidence too low.');
        }

        const azureStudent = await this.prisma.student.findFirst({
          where: { azurePersonId: match.personId, classId: session.classId },
          select: { id: true },
        });
        if (!azureStudent) {
          throw new BadRequestException('Identified face does not match any enrolled student.');
        }

        matchedStudentId = azureStudent.id;
        confidence = match.confidence;
      }

      student = await this.prisma.student.findUnique({
        where: { id: matchedStudentId },
        select: { id: true, fullName: true, indexNumber: true },
      });
      if (!student) {
        throw new BadRequestException('Identified face does not match any enrolled student.');
      }
    } else {
      // Biometric validation is DISABLED -> Geofencing is NOT checked!
      // Resolve student via indexNumber (or fallback to photo face recognition if provided)
      if (options.indexNumber && options.indexNumber.trim()) {
        const found = await this.prisma.student.findFirst({
          where: { indexNumber: options.indexNumber.trim(), classId: session.classId },
          select: { id: true, fullName: true, indexNumber: true },
        });
        if (!found) {
          const inOtherClass = await this.prisma.student.findUnique({
            where: { indexNumber: options.indexNumber.trim() },
            include: { class: true },
          });
          if (inOtherClass) {
            throw new BadRequestException(
              `Student "${inOtherClass.fullName}" (${inOtherClass.indexNumber}) is enrolled in "${inOtherClass.class.name}", not this session's class (${session.class.name}).`,
            );
          }
          throw new BadRequestException(
            `No enrolled student found with index number "${options.indexNumber}".`,
          );
        }
        student = found;
        confidence = 1.0;
      } else if (options.imageBuffer) {
        // If image was supplied in non-biometric mode, attempt optional face match
        try {
          const enrolledStudents = await this.prisma.student.findMany({
            where: { classId: session.classId },
            select: { id: true, faceEmbedding: true },
          });
          const candidates = enrolledStudents
            .filter((s) => s.faceEmbedding && s.faceEmbedding.length > 0)
            .map((s) => ({ studentId: s.id, embedding: s.faceEmbedding }));

          if (candidates.length > 0) {
            const match = await this.faceRecognition.identifyFace(
              session.classId,
              options.imageBuffer,
              candidates,
            );
            if (match && match.studentId) {
              student = await this.prisma.student.findUnique({
                where: { id: match.studentId },
                select: { id: true, fullName: true, indexNumber: true },
              });
              confidence = match.confidence;
            }
          }
        } catch {
          // Fall through
        }
        if (!student) {
          throw new BadRequestException(
            'Biometric validation is disabled. Please provide your student index number to check in.',
          );
        }
      } else {
        throw new BadRequestException(
          'Student index number is required for attendance check-in.',
        );
      }
    }

    // 4. Prevent duplicate check-in
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { studentId_sessionId: { studentId: student.id, sessionId } },
    });
    if (existing) {
      throw new BadRequestException('You have already checked in to this session.');
    }

    // 5. Create attendance record
    await this.prisma.attendanceRecord.create({
      data: {
        studentId: student.id,
        sessionId,
        confidence,
      },
    });

    return {
      success: true,
      message: 'Check-in successful!',
      student: { fullName: student.fullName, indexNumber: student.indexNumber },
      confidence,
    };
  }

  /**
   * Haversine formula to calculate distance in meters between two GPS coordinates.
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
