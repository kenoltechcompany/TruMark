import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Guard that restricts endpoint access strictly to users with the ADMIN role.
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException('Access denied: Administrator privileges required.');
    }
    return true;
  }
}
