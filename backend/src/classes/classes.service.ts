import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { name: string }) {
    return this.prisma.class.create({ data: { name: data.name } });
  }

  async findAll() {
    return this.prisma.class.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }

  async update(id: string, data: { name?: string }) {
    await this.findOne(id);
    return this.prisma.class.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.class.delete({ where: { id } });
  }

  async removeMany(ids: string[]) {
    await this.prisma.class.deleteMany({ where: { id: { in: ids } } });
    return { deleted: ids.length };
  }
}
