import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class CourseRepsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { username: string; email: string; password: string }) {
    const existing = await this.prisma.courseRep.findFirst({
      where: { OR: [{ username: data.username }, { email: data.email }] },
    });
    if (existing) {
      if (existing.username === data.username) throw new ConflictException('Username already exists');
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.courseRep.create({
      data: { username: data.username, email: data.email, passwordHash },
      select: { id: true, username: true, email: true, createdAt: true },
    });
  }

  async findAll() {
    return this.prisma.courseRep.findMany({
      select: { id: true, username: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rep = await this.prisma.courseRep.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, createdAt: true },
    });
    if (!rep) throw new NotFoundException('Course rep not found');
    return rep;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.courseRep.delete({ where: { id } });
  }

  async removeMany(ids: string[]) {
    await this.prisma.courseRep.deleteMany({ where: { id: { in: ids } } });
    return { deleted: ids.length };
  }
}
