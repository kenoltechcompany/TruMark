import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminRoleGuard } from './admin-role.guard';

describe('AdminRoleGuard', () => {
  let guard: AdminRoleGuard;

  beforeEach(() => {
    guard = new AdminRoleGuard();
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  };

  it('allows access for ADMIN role', () => {
    const context = createMockContext({ role: 'ADMIN', id: 'admin-1' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException for COURSE_REP role', () => {
    const context = createMockContext({ role: 'COURSE_REP', id: 'rep-1' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when no user is attached to request', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
