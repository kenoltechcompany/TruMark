import { Injectable, UnauthorizedException } from '@nestjs/common';
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
   * Validates credentials against Admin first, then CourseRep.
   * Returns a signed JWT with role and classId (for reps) claims.
   */
  async login(username: string, password: string): Promise<{ accessToken: string }> {
    // Try Admin lookup first
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    if (admin) {
      const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
      if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

      const payload = { sub: admin.id, username: admin.username, role: 'ADMIN' as const };
      return { accessToken: this.jwtService.sign(payload as Record<string, unknown>) };
    }

    // Try CourseRep lookup
    const rep = await this.prisma.courseRep.findUnique({ where: { username } });
    if (rep) {
      const isPasswordValid = await bcrypt.compare(password, rep.passwordHash);
      if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

      const payload = {
        sub: rep.id,
        username: rep.username,
        role: 'COURSE_REP' as const,
        classId: rep.classId,
      };
      return { accessToken: this.jwtService.sign(payload as Record<string, unknown>) };
    }

    throw new UnauthorizedException('Invalid credentials');
  }
}
