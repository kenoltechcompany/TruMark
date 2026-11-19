import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Guard that allows access to users with either ADMIN or COURSE_REP role.
 */
@Injectable()
export class AdminOrCourseRepRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role = request.user?.role;
    if (role !== 'ADMIN' && role !== 'COURSE_REP') {
      throw new ForbiddenException(
        'Access denied: Administrator or Course Representative privileges required.',
      );
    }
    return true;
  }
}
