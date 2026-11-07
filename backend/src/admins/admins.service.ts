import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { deleteLocalFiles } from '../utils/file-cleanup.util';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { username: string; password: string }) {
    const existing = await this.prisma.admin.findUnique({
      where: { username: data.username },
    });
    if (existing) throw new ConflictException('Username already exists');

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.admin.create({
      data: { username: data.username, passwordHash },
      select: { id: true, username: true, createdAt: true },
    });
  }

  async findAll() {
    return this.prisma.admin.findMany({
      select: { id: true, username: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: { id: true, username: true, createdAt: true },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async update(id: string, data: { username?: string; password?: string }) {
    await this.findOne(id);

    if (data.username) {
      const existing = await this.prisma.admin.findFirst({
        where: { username: data.username, NOT: { id } },
      });
      if (existing) throw new ConflictException('Username already taken');
    }

    const updateData: any = {};
    if (data.username) updateData.username = data.username;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.admin.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, createdAt: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const totalAdmins = await this.prisma.admin.count();
    if (totalAdmins <= 1) {
      throw new BadRequestException('Cannot delete the last remaining administrator account.');
    }

    return this.prisma.admin.delete({ where: { id } });
  }

  /** Returns all students across all classes with their class details. */
  async getAllStudents() {
    return this.prisma.student.findMany({
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        isCourseRep: true,
        username: true,
        email: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Direct manual student creation by administrator. */
  async createStudent(
    classId: string,
    data: { fullName: string; indexNumber: string },
  ) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Target class not found.');

    const existing = await this.prisma.student.findUnique({
      where: { indexNumber: data.indexNumber },
    });
    if (existing) {
      throw new ConflictException('A student with this index number already exists.');
    }

    return this.prisma.student.create({
      data: {
        fullName: data.fullName,
        indexNumber: data.indexNumber,
        classId,
        imagePaths: [],
      },
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        classId: true,
        createdAt: true,
      },
    });
  }

  /**
   * Bulk imports students from CSV text format:
   * "FullName,IndexNumber" per line
   */
  async importStudentsCsv(classId: string, csvContent: string) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Target class not found.');

    const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      throw new BadRequestException('CSV file is empty.');
    }

    // Skip header line if present
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
            classId,
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

  /** Updates student details from admin dashboard. */
  async updateStudent(
    studentId: string,
    data: { fullName?: string; indexNumber?: string; classId?: string },
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (data.indexNumber) {
      const existing = await this.prisma.student.findFirst({
        where: { indexNumber: data.indexNumber, NOT: { id: studentId } },
      });
      if (existing) {
        throw new BadRequestException('A student with this index number already exists.');
      }
    }

    if (data.classId) {
      const cls = await this.prisma.class.findUnique({
        where: { id: data.classId },
      });
      if (!cls) throw new NotFoundException('Target class not found');
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
        class: { select: { id: true, name: true } },
      },
    });
  }

  /** Deletes a single student profile and cleans up local reference photos from disk. */
  async deleteStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    // Clean up reference photos on disk
    deleteLocalFiles(student.imagePaths);

    // Prisma cascade deletes attendance records automatically
    return this.prisma.student.delete({
      where: { id: studentId },
    });
  }

  /** Bulk deletes students by ID, cleaning up disk images. */
  async purgeStudents(studentIds: string[]) {
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { imagePaths: true },
    });

    for (const s of students) {
      deleteLocalFiles(s.imagePaths);
    }

    const result = await this.prisma.student.deleteMany({
      where: { id: { in: studentIds } },
    });
    return { deleted: result.count };
  }

  /** Admin visibility into class sessions. */
  async getClassSessions(classId: string) {
    return this.prisma.session.findMany({
      where: { classId },
      include: {
        classroom: true,
        _count: { select: { attendance: true } },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  /** Admin visibility into session attendance. */
  async getSessionAttendance(sessionId: string) {
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

  /** Fetches global system settings, initializing default row if non-existent. */
  async getSettings() {
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
      updatedAt: settings.updatedAt,
    };
  }

  /** Updates global system settings. */
  async updateSettings(data: {
    enableLandingPage?: boolean;
    enableBiometricValidation?: boolean;
    enableGeofencing?: boolean;
  }) {
    await this.getSettings();

    const updated = await this.prisma.systemSetting.update({
      where: { id: 'default' },
      data: {
        ...(typeof data.enableLandingPage === 'boolean'
          ? { enableLandingPage: data.enableLandingPage }
          : {}),
        ...(typeof data.enableBiometricValidation === 'boolean'
          ? { enableBiometricValidation: data.enableBiometricValidation }
          : {}),
        ...(typeof data.enableGeofencing === 'boolean'
          ? { enableGeofencing: data.enableGeofencing }
          : {}),
      },
    });

    return {
      enableLandingPage: updated.enableLandingPage,
      enableBiometricValidation: updated.enableBiometricValidation,
      enableGeofencing: updated.enableGeofencing,
      updatedAt: updated.updatedAt,
    };
  }
}
