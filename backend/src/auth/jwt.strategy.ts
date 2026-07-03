import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: 'ADMIN' | 'COURSE_REP';
  classId?: string | null;
}

/**
 * Passport strategy that validates JWT tokens from the Authorization header.
 * Attaches { id, username, role, classId } to request.user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'trumark-dev-jwt-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    // Verify the user still exists in the database
    if (payload.role === 'ADMIN') {
      const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub } });
      if (!admin) throw new UnauthorizedException('Admin not found');
    } else {
      const rep = await this.prisma.courseRep.findUnique({ where: { id: payload.sub } });
      if (!rep) throw new UnauthorizedException('CourseRep not found');
    }

    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      classId: payload.classId ?? null,
    };
  }
}
