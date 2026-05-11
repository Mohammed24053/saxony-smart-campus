import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

export interface AuthPrincipal {
  userId: string;
  role: 'admin' | 'student' | 'doctor';
  universityId: string;
  email?: string | null;
  /** True only for admins who completed 2FA. */
  twoFaVerified?: boolean;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthPrincipal | undefined => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>();
    return req.user;
  },
);
