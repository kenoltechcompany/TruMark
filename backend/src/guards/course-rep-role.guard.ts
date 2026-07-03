import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Guard that restricts access to users with the COURSE_REP role.
 * Relies on the JWT strategy having populated request.user with a role property.
 */
@Injectable()
export class CourseRepRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return user?.role === 'COURSE_REP';
  }
}
