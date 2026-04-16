import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no pide roles, no bloqueamos
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<{
      user?: { sub?: string; email?: string; role?: Role };
    }>();
    const user = req.user;

    if (!user?.role) throw new ForbiddenException('Missing user role');

    const allowed = requiredRoles.includes(user.role);
    if (!allowed) throw new ForbiddenException('Insufficient role');

    return true;
  }
}
