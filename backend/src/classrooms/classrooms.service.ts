import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassroomsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureVirtualClassroom();
  }

  async ensureVirtualClassroom() {
    const existing = await this.prisma.classroom.findFirst({
      where: {
        OR: [
          { isVirtual: true },
          { name: { contains: 'Virtual', mode: 'insensitive' } },
          { name: { contains: 'Online', mode: 'insensitive' } },
        ],
      },
    });

    if (!existing) {
      await this.prisma.classroom.create({
        data: {
          name: 'Online / Virtual Classroom',
          gpsLatitude: 0,
          gpsLongitude: 0,
          radiusMeters: 0,
          isVirtual: true,
        },
      });
    } else if (!existing.isVirtual) {
      await this.prisma.classroom.update({
        where: { id: existing.id },
        data: { isVirtual: true },
      });
    }
  }

  async create(data: {
    name: string;
    gpsLatitude: number;
    gpsLongitude: number;
    radiusMeters: number;
    isVirtual?: boolean;
  }) {
    return this.prisma.classroom.create({ data });
  }

  async findAll() {
    await this.ensureVirtualClassroom();
    return this.prisma.classroom.findMany({ orderBy: [{ isVirtual: 'desc' }, { createdAt: 'desc' }] });
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
      isVirtual?: boolean;
    },
  ) {
    const cr = await this.findOne(id);
    if (cr.isVirtual && data.isVirtual === false) {
      throw new BadRequestException('Cannot remove virtual status from the Online / Virtual Classroom.');
    }
    return this.prisma.classroom.update({ where: { id }, data });
  }

  async remove(id: string) {
    const cr = await this.findOne(id);
    if (cr.isVirtual) {
      throw new BadRequestException('Cannot delete the system Online / Virtual Classroom.');
    }

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
