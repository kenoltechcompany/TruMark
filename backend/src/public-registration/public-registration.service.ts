import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AzureFaceService } from '../azure-face/azure-face.service';

@Injectable()
export class PublicRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly azureFace: AzureFaceService,
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
   * Rejects if registration is not active or if the index number is taken.
   */
  async registerStudent(
    classId: string,
    data: { fullName: string; indexNumber: string },
    imagePaths: string[],
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

    return this.prisma.student.create({
      data: {
        fullName: data.fullName,
        indexNumber: data.indexNumber,
        classId,
        imagePaths,
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
   * Returns session details with an isActive flag computed dynamically
   * by checking if the current server time falls between startTime and endTime.
   */
  async getSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        class: { select: { name: true } },
        classroom: { select: { name: true, gpsLatitude: true, gpsLongitude: true, radiusMeters: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found.');

    const now = new Date();
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
      isActive: now >= session.startTime && now <= session.endTime,
    };
  }

  /**
   * Core check-in flow:
   * 1. Validate session is active
   * 2. Geofence check via Haversine
   * 3. Azure Face identification
   * 4. Mark attendance
   */
  async checkIn(
    sessionId: string,
    latitude: number,
    longitude: number,
    imageBuffer: Buffer,
  ) {
    // Fetch session with class + classroom
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        class: { select: { id: true, name: true } },
        classroom: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found.');

    // 1. Time validation
    const now = new Date();
    if (now < session.startTime || now > session.endTime) {
      throw new BadRequestException('Session is not currently active.');
    }

    // 2. Geofence validation via Haversine
    const distance = this.haversineDistance(
      latitude,
      longitude,
      session.classroom.gpsLatitude,
      session.classroom.gpsLongitude,
    );
    const allowedRadius = session.classroom.radiusMeters + 5; // 5m tolerance for GPS drift
    if (distance > allowedRadius) {
      throw new BadRequestException(
        `Outside classroom boundary. You are ${Math.round(distance)}m away (max ${allowedRadius}m).`,
      );
    }

    // 3. Azure Face identification
    const match = await this.azureFace.identifyFace(session.classId, imageBuffer);
    if (!match) {
      throw new BadRequestException('Face not recognized or confidence too low.');
    }

    // 4. Map azure personId to a local student in this class
    const student = await this.prisma.student.findFirst({
      where: { azurePersonId: match.personId, classId: session.classId },
    });
    if (!student) {
      throw new BadRequestException('Identified face does not match any enrolled student.');
    }

    // 5. Prevent duplicate check-in
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { studentId_sessionId: { studentId: student.id, sessionId } },
    });
    if (existing) {
      throw new BadRequestException('You have already checked in to this session.');
    }

    // 6. Create attendance record
    await this.prisma.attendanceRecord.create({
      data: {
        studentId: student.id,
        sessionId,
        confidence: match.confidence,
      },
    });

    return {
      success: true,
      message: 'Check-in successful!',
      student: { fullName: student.fullName, indexNumber: student.indexNumber },
      confidence: match.confidence,
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
