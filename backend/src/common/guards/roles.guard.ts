import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppException } from '../errors/app.exception';
import { ErrorCodes } from '../errors/error-codes';
import { AuthPrincipal } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>();
    const user = req.user;
    if (!user) throw new AppException(ErrorCodes.UNAUTHORIZED);

    if (!required.includes(user.role as UserRole)) {
      throw new AppException(ErrorCodes.FORBIDDEN);
    }
    return true;
  }
}
