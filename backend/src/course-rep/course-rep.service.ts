import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CourseRepService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the class managed by this CourseRep, including registration link status
   * and the list of enrolled students.
   */
  async getMyClass(repId: string) {
    const rep = await this.prisma.courseRep.findUnique({
      where: { id: repId },
      select: { classId: true },
    });
    if (!rep || !rep.classId) {
      throw new NotFoundException('You have not been assigned a class yet.');
    }

    return this.prisma.class.findUnique({
      where: { id: rep.classId },
      include: {
        students: {
          select: { id: true, fullName: true, indexNumber: true, imagePaths: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Toggles the registrationLinkActive flag for the CourseRep's class.
   */
  async toggleRegistration(repId: string) {
    const rep = await this.prisma.courseRep.findUnique({
      where: { id: repId },
      select: { classId: true },
    });
    if (!rep || !rep.classId) {
      throw new NotFoundException('You have not been assigned a class yet.');
    }

    const cls = await this.prisma.class.findUnique({ where: { id: rep.classId } });
    if (!cls) throw new NotFoundException('Class not found.');

    return this.prisma.class.update({
      where: { id: rep.classId },
      data: { registrationLinkActive: !cls.registrationLinkActive },
    });
  }

  /**
   * Manually creates a student in the CourseRep's assigned class with 3 uploaded image paths.
   */
  async createStudent(
    repId: string,
    data: { fullName: string; indexNumber: string },
    imagePaths: string[],
  ) {
    const rep = await this.prisma.courseRep.findUnique({
      where: { id: repId },
      select: { classId: true },
    });
    if (!rep || !rep.classId) {
      throw new NotFoundException('You have not been assigned a class yet.');
    }

    // Check for duplicate index number within the system
    const existing = await this.prisma.student.findUnique({
      where: { indexNumber: data.indexNumber },
    });
    if (existing) {
      throw new BadRequestException('A student with this index number already exists.');
    }

    return this.prisma.student.create({
      data: {
        fullName: data.fullName,
        indexNumber: data.indexNumber,
        classId: rep.classId,
        imagePaths,
      },
    });
  }

  /**
   * Bulk deletes students by IDs — only those belonging to the CourseRep's class.
   */
  async deleteStudents(repId: string, studentIds: string[]) {
    const rep = await this.prisma.courseRep.findUnique({
      where: { id: repId },
      select: { classId: true },
    });
    if (!rep || !rep.classId) {
      throw new NotFoundException('You have not been assigned a class yet.');
    }

    // Only delete students that belong to this rep's class
    const result = await this.prisma.student.deleteMany({
      where: {
        id: { in: studentIds },
        classId: rep.classId,
      },
    });

    return { deleted: result.count };
  }

  /**
   * Creates a new session for the CourseRep's class.
   */
  async createSession(
    repId: string,
    data: { name: string; startTime: string; endTime: string; classroomId: string },
  ) {
    const rep = await this.prisma.courseRep.findUnique({
      where: { id: repId },
      select: { classId: true },
    });
    if (!rep || !rep.classId) {
      throw new NotFoundException('You have not been assigned a class yet.');
    }

    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime.');
    }

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

  /**
   * Returns all sessions for the CourseRep's class, including classroom data.
   */
  async getSessions(repId: string) {
    const rep = await this.prisma.courseRep.findUnique({
      where: { id: repId },
      select: { classId: true },
    });
    if (!rep || !rep.classId) {
      throw new NotFoundException('You have not been assigned a class yet.');
    }

    return this.prisma.session.findMany({
      where: { classId: rep.classId },
      include: { classroom: true },
      orderBy: { startTime: 'desc' },
    });
  }

  /**
   * Bulk deletes sessions by ID — only those belonging to the CourseRep's class.
   */
  async deleteSessions(repId: string, sessionIds: string[]) {
    const rep = await this.prisma.courseRep.findUnique({
      where: { id: repId },
      select: { classId: true },
    });
    if (!rep || !rep.classId) {
      throw new NotFoundException('You have not been assigned a class yet.');
    }

    const result = await this.prisma.session.deleteMany({
      where: { id: { in: sessionIds }, classId: rep.classId },
    });

    return { deleted: result.count };
  }
}
