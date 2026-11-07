import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validates credentials against Admin first, then against Student (with isCourseRep = true).
   * Supports logging in with either username or email for course reps.
   * Returns a signed JWT.
   */
  async login(identifier: string, password: string): Promise<{ accessToken: string; role: 'ADMIN' | 'COURSE_REP'; user: any }> {
    const trimmed = identifier.trim();

    // 1. Try Admin lookup
    const admin = await this.prisma.admin.findUnique({
      where: { username: trimmed },
    });

    if (admin) {
      const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
      if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

      const payload = {
        sub: admin.id,
        username: admin.username,
        role: 'ADMIN' as const,
      };

      return {
        accessToken: this.jwtService.sign(payload),
        role: 'ADMIN',
        user: { id: admin.id, username: admin.username, role: 'ADMIN' },
      };
    }

    // 2. Try CourseRep (Student with isCourseRep = true) lookup by username or email
    const studentRep = await this.prisma.student.findFirst({
      where: {
        isCourseRep: true,
        OR: [{ username: trimmed }, { email: trimmed }],
      },
      include: {
        class: { select: { id: true, name: true } },
      },
    });

    if (studentRep && studentRep.passwordHash) {
      const isPasswordValid = await bcrypt.compare(password, studentRep.passwordHash);
      if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

      const payload = {
        sub: studentRep.id,
        username: studentRep.username,
        role: 'COURSE_REP' as const,
        classId: studentRep.classId,
      };

      return {
        accessToken: this.jwtService.sign(payload),
        role: 'COURSE_REP',
        user: {
          id: studentRep.id,
          username: studentRep.username,
          email: studentRep.email,
          fullName: studentRep.fullName,
          classId: studentRep.classId,
          className: studentRep.class?.name,
          role: 'COURSE_REP',
        },
      };
    }

    throw new UnauthorizedException('Invalid credentials');
  }

  /**
   * Changes the password for the currently logged-in user.
   */
  async changePassword(
    userId: string,
    role: string,
    oldPass: string,
    newPass: string,
  ) {
    if (!newPass || newPass.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters long.');
    }

    if (role === 'ADMIN') {
      const admin = await this.prisma.admin.findUnique({ where: { id: userId } });
      if (!admin) throw new NotFoundException('Admin user not found.');

      const valid = await bcrypt.compare(oldPass, admin.passwordHash);
      if (!valid) throw new UnauthorizedException('Incorrect current password.');

      const passwordHash = await bcrypt.hash(newPass, 10);
      await this.prisma.admin.update({
        where: { id: userId },
        data: { passwordHash },
      });
      return { success: true, message: 'Password updated successfully.' };
    } else {
      const student = await this.prisma.student.findUnique({ where: { id: userId } });
      if (!student || !student.isCourseRep || !student.passwordHash) {
        throw new NotFoundException('Course representative account not found.');
      }

      const valid = await bcrypt.compare(oldPass, student.passwordHash);
      if (!valid) throw new UnauthorizedException('Incorrect current password.');

      const passwordHash = await bcrypt.hash(newPass, 10);
      await this.prisma.student.update({
        where: { id: userId },
        data: { passwordHash },
      });
      return { success: true, message: 'Password updated successfully.' };
    }
  }
}
