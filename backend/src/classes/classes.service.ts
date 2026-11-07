import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { deleteLocalFiles } from '../utils/file-cleanup.util';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { name: string }) {
    return this.prisma.class.create({
      data: { name: data.name },
      include: {
        _count: { select: { students: true, sessions: true } },
        students: {
          where: { isCourseRep: true },
          select: { id: true, username: true, fullName: true },
        },
      },
    });
  }

  async findAll() {
    const classes = await this.prisma.class.findMany({
      include: {
        _count: { select: { students: true, sessions: true } },
        students: {
          where: { isCourseRep: true },
          select: { id: true, username: true, fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map `students` where isCourseRep: true to `courseReps` for backwards compatibility with frontend DTOs
    return classes.map((c) => ({
      ...c,
      courseReps: c.students,
    }));
  }

  async findOne(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        _count: { select: { students: true, sessions: true } },
        students: {
          where: { isCourseRep: true },
          select: { id: true, username: true, fullName: true },
        },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    return {
      ...cls,
      courseReps: cls.students,
    };
  }

  async update(id: string, data: { name?: string }) {
    await this.findOne(id);
    const updated = await this.prisma.class.update({
      where: { id },
      data,
      include: {
        _count: { select: { students: true, sessions: true } },
        students: {
          where: { isCourseRep: true },
          select: { id: true, username: true, fullName: true },
        },
      },
    });
    return {
      ...updated,
      courseReps: updated.students,
    };
  }

  /**
   * Deletes a class and cleanly deletes all enrolled students' local images.
   * Cascade-deletes all sessions, students, and attendance records at the DB level.
   */
  async remove(id: string) {
    await this.findOne(id);

    // Retrieve all students' image paths in this class to remove from disk
    const students = await this.prisma.student.findMany({
      where: { classId: id },
      select: { imagePaths: true },
    });

    for (const s of students) {
      deleteLocalFiles(s.imagePaths);
    }

    return this.prisma.class.delete({ where: { id } });
  }

  async removeMany(ids: string[]) {
    for (const id of ids) {
      await this.remove(id);
    }
    return { deleted: ids.length };
  }
}
