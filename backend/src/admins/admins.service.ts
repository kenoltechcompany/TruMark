import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { username: string; password: string }) {
    const existing = await this.prisma.admin.findUnique({ where: { username: data.username } });
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

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.admin.delete({ where: { id } });
  }

  /** Returns all students across all classes, with their class name. */
  async getAllStudents() {
    return this.prisma.student.findMany({
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Bulk deletes students by ID, also deleting their attendance records. */
  async purgeStudents(studentIds: string[]) {
    await this.prisma.attendanceRecord.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await this.prisma.student.deleteMany({
      where: { id: { in: studentIds } },
    });
    return { deleted: studentIds.length };
  }
}
