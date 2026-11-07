import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassroomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    gpsLatitude: number;
    gpsLongitude: number;
    radiusMeters: number;
  }) {
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

  async update(
    id: string,
    data: {
      name?: string;
      gpsLatitude?: number;
      gpsLongitude?: number;
      radiusMeters?: number;
    },
  ) {
    await this.findOne(id);
    return this.prisma.classroom.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Prevent deletion if sessions are actively using this classroom location
    const sessionCount = await this.prisma.session.count({
      where: { classroomId: id },
    });
    if (sessionCount > 0) {
      throw new BadRequestException(
        `Cannot delete classroom: it is referenced by ${sessionCount} session(s). Delete or reassign those sessions first.`,
      );
    }

    return this.prisma.classroom.delete({ where: { id } });
  }

  async removeMany(ids: string[]) {
    for (const id of ids) {
      await this.remove(id);
    }
    return { deleted: ids.length };
  }
}
