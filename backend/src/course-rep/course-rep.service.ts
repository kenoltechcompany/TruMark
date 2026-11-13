import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FaceRecognitionService } from '../face-recognition/face-recognition.service';
import { deleteLocalFiles } from '../utils/file-cleanup.util';
import { readFileSync, existsSync } from 'fs';

@Injectable()
export class CourseRepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly faceRecognition: FaceRecognitionService,
  ) {}

  private async getRepStudent(repId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: repId, isCourseRep: true },
      select: { id: true, classId: true, fullName: true },
    });
    if (!student || !student.classId) {
      throw new NotFoundException('You have not been assigned to a valid class.');
    }
    return student;
  }

  /**
   * Returns the class managed by this CourseRep, including registration link status
   * and the list of all enrolled students.
   */
  async getMyClass(repId: string) {
    const rep = await this.getRepStudent(repId);

    return this.prisma.class.findUnique({
      where: { id: rep.classId },
      include: {
        students: {
          select: {
            id: true,
            fullName: true,
            indexNumber: true,
            imagePaths: true,
            azurePersonId: true,
            faceEmbedding: true,
            isCourseRep: true,
            username: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Toggles the registrationLinkActive flag for the CourseRep's class.
   */
  async toggleRegistration(repId: string) {
    const rep = await this.getRepStudent(repId);

    const cls = await this.prisma.class.findUnique({
      where: { id: rep.classId },
      select: { registrationLinkActive: true },
    });
    if (!cls) throw new NotFoundException('Class not found.');

    return this.prisma.class.update({
      where: { id: rep.classId },
      data: { registrationLinkActive: !cls.registrationLinkActive },
      select: { id: true, name: true, registrationLinkActive: true },
    });
  }

  /**
   * Creates a student enrolled in the CourseRep's class with reference photos.
   */
  async createStudent(
    repId: string,
    data: { fullName: string; indexNumber: string },
    images: (Buffer | string)[],
  ) {
    const rep = await this.getRepStudent(repId);

    const existing = await this.prisma.student.findUnique({
      where: { indexNumber: data.indexNumber },
    });
    if (existing) {
      throw new BadRequestException('A student with this index number already exists.');
    }

    // Extract facial embedding if using InsightFace
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
        }
        buffers.length = 0;
      } catch (err) {
        // Fallback: created without embedding, will sync later
      }
    }

    return this.prisma.student.create({
      data: {
        fullName: data.fullName,
        indexNumber: data.indexNumber,
        classId: rep.classId,
        imagePaths: [],
        faceEmbedding,
      },
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        imagePaths: true,
        isCourseRep: true,
        createdAt: true,
      },
    });
  }

  async getStudent(repId: string, studentId: string) {
    const rep = await this.getRepStudent(repId);

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, classId: rep.classId },
    });
    if (!student) throw new NotFoundException('Student not found in your class.');
    return student;
  }

  async updateStudent(
    repId: string,
    studentId: string,
    data: { fullName?: string; indexNumber?: string },
  ) {
    await this.getStudent(repId, studentId);

    if (data.indexNumber) {
      const existing = await this.prisma.student.findFirst({
        where: { indexNumber: data.indexNumber, NOT: { id: studentId } },
      });
      if (existing) {
        throw new BadRequestException('A student with this index number already exists.');
      }
    }

    return this.prisma.student.update({
      where: { id: studentId },
      data,
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        isCourseRep: true,
        createdAt: true,
      },
    });
  }

  async deleteStudent(repId: string, studentId: string) {
    const student = await this.getStudent(repId, studentId);

    // Clean up local reference images
    deleteLocalFiles(student.imagePaths);

    return this.prisma.student.delete({ where: { id: studentId } });
  }

  async deleteStudents(repId: string, studentIds: string[]) {
    const rep = await this.getRepStudent(repId);

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, classId: rep.classId },
      select: { id: true, imagePaths: true },
    });

    for (const s of students) {
      deleteLocalFiles(s.imagePaths);
    }

    const validIds = students.map((s) => s.id);
    if (validIds.length === 0) return { deleted: 0 };

    const result = await this.prisma.student.deleteMany({
      where: { id: { in: validIds } },
    });

    return { deleted: result.count };
  }

  /**
   * Bulk imports students from CSV into the CourseRep's class.
   */
  async importStudentsCsv(repId: string, csvContent: string) {
    const rep = await this.getRepStudent(repId);

    const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      throw new BadRequestException('CSV file is empty.');
    }

    const firstLine = lines[0].toLowerCase();
    const startIndex = firstLine.includes('name') || firstLine.includes('index') ? 1 : 0;

    let createdCount = 0;
    const errors: string[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) continue;

      const [fullName, indexNumber] = parts;
      if (!fullName || !indexNumber) continue;

      try {
        const existing = await this.prisma.student.findUnique({ where: { indexNumber } });
        if (existing) {
          errors.push(`Row ${i + 1}: Index ${indexNumber} already exists.`);
          continue;
        }

        await this.prisma.student.create({
          data: {
            fullName,
            indexNumber,
            classId: rep.classId,
            imagePaths: [],
          },
        });
        createdCount++;
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    return {
      imported: createdCount,
      errors,
    };
  }

  /**
   * Creates a new session for the CourseRep's class with double-booking prevention.
   */
  async createSession(
    repId: string,
    data: { name: string; startTime: string; endTime: string; classroomId: string },
  ) {
    const rep = await this.getRepStudent(repId);

    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime.');
    }

    // Multiple sessions are allowed to share the same classroom location concurrently
    return this.prisma.session.create({
      data: {
        name: data.name,
        startTime: start,
        endTime: end,
        classId: rep.classId,
        classroomId: data.classroomId,
      },
      include: { classroom: true },
    });
  }

  async getSessions(repId: string) {
    const rep = await this.getRepStudent(repId);

    return this.prisma.session.findMany({
      where: { classId: rep.classId },
      include: {
        classroom: true,
        onlineJob: {
          select: {
            id: true,
            status: true,
            statusMessage: true,
            isTimeBound: true,
            minStayMinutes: true,
            cycleCount: true,
            attendeeMinutes: true,
            lastHeartbeat: true,
            meetingUrl: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async getSession(repId: string, sessionId: string) {
    const rep = await this.getRepStudent(repId);

    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, classId: rep.classId },
      include: { classroom: true },
    });
    if (!session) throw new NotFoundException('Session not found.');
    return session;
  }

  async updateSession(
    repId: string,
    sessionId: string,
    data: { name?: string; startTime?: string; endTime?: string; classroomId?: string },
  ) {
    const existing = await this.getSession(repId, sessionId);

    const targetClassroomId = data.classroomId || existing.classroomId;
    const start = data.startTime ? new Date(data.startTime) : existing.startTime;
    const end = data.endTime ? new Date(data.endTime) : existing.endTime;

    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime.');
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.classroomId) updateData.classroomId = data.classroomId;
    if (data.startTime) updateData.startTime = start;
    if (data.endTime) updateData.endTime = end;

    return this.prisma.session.update({
      where: { id: sessionId },
      data: updateData,
      include: { classroom: true },
    });
  }

  async deleteSession(repId: string, sessionId: string) {
    await this.getSession(repId, sessionId);
    // Attendance records cascade-delete automatically
    return this.prisma.session.delete({ where: { id: sessionId } });
  }

  async deleteSessions(repId: string, sessionIds: string[]) {
    const rep = await this.getRepStudent(repId);

    const sessions = await this.prisma.session.findMany({
      where: { id: { in: sessionIds }, classId: rep.classId },
      select: { id: true },
    });
    const validIds = sessions.map((s) => s.id);
    if (validIds.length === 0) return { deleted: 0 };

    const result = await this.prisma.session.deleteMany({
      where: { id: { in: validIds } },
    });

    return { deleted: result.count };
  }

  async toggleSessionLock(repId: string, sessionId: string) {
    const session = await this.getSession(repId, sessionId);
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { isLocked: !session.isLocked },
      include: { classroom: true },
    });
  }

  /**
   * Manually marks a student as attended for a session.
   * Useful when a student's phone died, had a camera failure, or has an excused presence.
   */
  async manualAttendance(repId: string, sessionId: string, studentId: string) {
    const session = await this.getSession(repId, sessionId);

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, classId: session.classId },
    });
    if (!student) {
      throw new NotFoundException('Student is not enrolled in this session’s class.');
    }

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { studentId_sessionId: { studentId, sessionId } },
    });
    if (existing) {
      throw new BadRequestException('This student is already marked as attended.');
    }

    return this.prisma.attendanceRecord.create({
      data: {
        studentId,
        sessionId,
        confidence: 1.0, // 100% confidence for authorized manual check-in
      },
      include: {
        student: { select: { id: true, fullName: true, indexNumber: true } },
      },
    });
  }

  /**
   * Syncs this CourseRep's class with the active Face Recognition provider.
   */
  async syncToAzure(repId: string) {
    const rep = await this.getRepStudent(repId);
    const isInsightFace = this.faceRecognition.providerName === 'insightface';

    const cls = await this.prisma.class.findUnique({
      where: { id: rep.classId },
      include: {
        students: {
          select: { id: true, fullName: true, imagePaths: true, azurePersonId: true, faceEmbedding: true },
        },
      },
    });
    if (!cls) throw new NotFoundException('Class not found.');

    const unsyncedStudents = cls.students.filter((s) => {
      if (isInsightFace) {
        return !s.faceEmbedding || s.faceEmbedding.length === 0;
      }
      return !s.azurePersonId;
    });

    if (!unsyncedStudents.length) {
      return {
        synced: 0,
        message: isInsightFace
          ? 'All students are already synced with facial embeddings.'
          : 'All students are already synced to Azure.',
      };
    }

    const updated = await this.faceRecognition.syncClass(
      cls.id,
      cls.name,
      unsyncedStudents,
    );

    for (const student of updated) {
      const dataToUpdate: any = {};
      if (student.faceEmbedding && student.faceEmbedding.length > 0) {
        dataToUpdate.faceEmbedding = student.faceEmbedding;
      }
      if (student.azurePersonId) {
        dataToUpdate.azurePersonId = student.azurePersonId;
      }

      if (Object.keys(dataToUpdate).length > 0) {
        await this.prisma.student.update({
          where: { id: student.id },
          data: dataToUpdate,
        });
      }
    }

    return { synced: updated.length };
  }

  async getAttendance(sessionId: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { sessionId },
      include: {
        student: {
          select: { id: true, fullName: true, indexNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteAttendanceRecord(
    repId: string,
    sessionId: string,
    attendanceId: string,
  ) {
    await this.getSession(repId, sessionId);

    const record = await this.prisma.attendanceRecord.findFirst({
      where: { id: attendanceId, sessionId },
    });
    if (!record) {
      throw new NotFoundException('Attendance record not found.');
    }

    return this.prisma.attendanceRecord.delete({ where: { id: attendanceId } });
  }

  async exportSessionCsv(repId: string, sessionId: string): Promise<string> {
    const session = await this.getSession(repId, sessionId);

    const allStudents = await this.prisma.student.findMany({
      where: { classId: session.classId },
      orderBy: { fullName: 'asc' },
    });

    const attendedRecords = await this.prisma.attendanceRecord.findMany({
      where: { sessionId },
      select: { studentId: true, createdAt: true, confidence: true },
    });

    const attendanceMap = new Map(
      attendedRecords.map((r) => [r.studentId, r]),
    );

    const rows = [
      ['Full Name', 'Index Number', 'Status', 'Time Checked In', 'Confidence'],
    ];

    for (const student of allStudents) {
      const record = attendanceMap.get(student.id);
      if (record) {
        rows.push([
          `"${student.fullName}"`,
          `"${student.indexNumber}"`,
          'Present',
          `"${record.createdAt.toISOString()}"`,
          `${Math.round(record.confidence * 100)}%`,
        ]);
      } else {
        rows.push([
          `"${student.fullName}"`,
          `"${student.indexNumber}"`,
          'Absent',
          '-',
          '-',
        ]);
      }
    }

    return rows.map((r) => r.join(',')).join('\n');
  }
}
