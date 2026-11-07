import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class CourseRepsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new Student and elevates them directly to Course Representative.
   */
  async create(data: {
    fullName: string;
    indexNumber: string;
    classId: string;
    username: string;
    email: string;
    password: string;
  }) {
    // Check uniqueness of username, email, and indexNumber
    const existingUsernameOrEmail = await this.prisma.student.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }],
      },
    });
    if (existingUsernameOrEmail) {
      if (existingUsernameOrEmail.username === data.username) {
        throw new ConflictException('Username already exists');
      }
      throw new ConflictException('Email already exists');
    }

    const existingIndex = await this.prisma.student.findUnique({
      where: { indexNumber: data.indexNumber },
    });
    if (existingIndex) {
      throw new ConflictException('A student with this index number already exists.');
    }

    const cls = await this.prisma.class.findUnique({ where: { id: data.classId } });
    if (!cls) throw new NotFoundException('Target class not found.');

    const passwordHash = await bcrypt.hash(data.password, 10);

    return this.prisma.student.create({
      data: {
        fullName: data.fullName,
        indexNumber: data.indexNumber,
        classId: data.classId,
        imagePaths: [],
        isCourseRep: true,
        username: data.username,
        email: data.email,
        passwordHash,
      },
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        username: true,
        email: true,
        isCourseRep: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Promotes an existing enrolled student to Course Representative.
   */
  async promoteStudent(data: {
    studentId: string;
    username: string;
    email: string;
    password: string;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { id: data.studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const existing = await this.prisma.student.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }],
        NOT: { id: data.studentId },
      },
    });
    if (existing) {
      if (existing.username === data.username) {
        throw new ConflictException('Username already exists');
      }
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    return this.prisma.student.update({
      where: { id: data.studentId },
      data: {
        isCourseRep: true,
        username: data.username,
        email: data.email,
        passwordHash,
      },
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        username: true,
        email: true,
        isCourseRep: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
      },
    });
  }

  async findAll() {
    return this.prisma.student.findMany({
      where: { isCourseRep: true },
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        username: true,
        email: true,
        isCourseRep: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rep = await this.prisma.student.findFirst({
      where: { id, isCourseRep: true },
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        username: true,
        email: true,
        isCourseRep: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
      },
    });
    if (!rep) throw new NotFoundException('Course representative not found');
    return rep;
  }

  async update(
    id: string,
    data: {
      fullName?: string;
      username?: string;
      email?: string;
      password?: string;
      classId?: string;
    },
  ) {
    await this.findOne(id);

    if (data.username || data.email) {
      const existing = await this.prisma.student.findFirst({
        where: {
          OR: [
            ...(data.username ? [{ username: data.username }] : []),
            ...(data.email ? [{ email: data.email }] : []),
          ],
          NOT: { id },
        },
      });
      if (existing) {
        if (existing.username === data.username) {
          throw new ConflictException('Username already exists');
        }
        throw new ConflictException('Email already exists');
      }
    }

    if (data.classId) {
      const cls = await this.prisma.class.findUnique({ where: { id: data.classId } });
      if (!cls) throw new NotFoundException('Target class not found.');
    }

    const updateData: any = {};
    if (data.fullName) updateData.fullName = data.fullName;
    if (data.username) updateData.username = data.username;
    if (data.email) updateData.email = data.email;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }
    if (data.classId) updateData.classId = data.classId;

    return this.prisma.student.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        username: true,
        email: true,
        isCourseRep: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Demotes a Course Representative back to regular student status.
   * Keeps their student identity, enrolled class, and attendance records intact!
   */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.student.update({
      where: { id },
      data: {
        isCourseRep: false,
        username: null,
        email: null,
        passwordHash: null,
      },
      select: { id: true, fullName: true, isCourseRep: true },
    });
  }

  async removeMany(ids: string[]) {
    await this.prisma.student.updateMany({
      where: { id: { in: ids }, isCourseRep: true },
      data: {
        isCourseRep: false,
        username: null,
        email: null,
        passwordHash: null,
      },
    });
    return { demoted: ids.length };
  }
}
