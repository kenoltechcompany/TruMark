import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassroomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { name: string; gpsLatitude: number; gpsLongitude: number; radiusMeters: number }) {
    return this.prisma.classroom.create({ data });
  }

  async findAll() {
    return this.prisma.classroom.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const cr = await this.prisma.classroom.findUnique({ where: { id } });
    if (!cr) throw new NotFoundException('Classroom not found');
    return cr;
  }

  async update(id: string, data: { name?: string; gpsLatitude?: number; gpsLongitude?: number; radiusMeters?: number }) {
    await this.findOne(id);
    return this.prisma.classroom.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.classroom.delete({ where: { id } });
  }

  async removeMany(ids: string[]) {
    await this.prisma.classroom.deleteMany({ where: { id: { in: ids } } });
    return { deleted: ids.length };
  }
}
