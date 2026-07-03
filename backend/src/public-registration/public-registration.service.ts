import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicRegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks whether a class has registrationLinkActive = true.
   * Returns the class name + status so the frontend can render the state.
   */
  async checkRegistrationStatus(classId: string) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found.');

    return {
      active: cls.registrationLinkActive,
      className: cls.name,
    };
  }

  /**
   * Registers a new student via the public self-onboarding flow.
   * Rejects if registration is not active or if the index number is taken.
   */
  async registerStudent(
    classId: string,
    data: { fullName: string; indexNumber: string },
    imagePaths: string[],
  ) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found.');
    if (!cls.registrationLinkActive) {
      throw new ForbiddenException('Registration is not currently active for this class.');
    }

    const existing = await this.prisma.student.findUnique({
      where: { indexNumber: data.indexNumber },
    });
    if (existing) {
      throw new BadRequestException('A student with this index number already exists in the system.');
    }

    return this.prisma.student.create({
      data: {
        fullName: data.fullName,
        indexNumber: data.indexNumber,
        classId,
        imagePaths,
      },
      select: {
        id: true,
        fullName: true,
        indexNumber: true,
        createdAt: true,
      },
    });
  }
}
