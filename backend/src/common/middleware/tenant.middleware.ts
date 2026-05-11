import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Lifts the `universityId` claim out of the `req.auth` payload (set by the
 * JwtAuthGuard) and exposes it as `req.universityId`. Used by services and
 * the @CurrentUniversity decorator.
 *
 * Auth itself is performed by JwtAuthGuard; this middleware is a NO-OP for
 * unauthenticated routes (login, refresh, health).
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction): void {
    if (req.auth?.universityId) {
      req.universityId = req.auth.universityId;
      this.logger.debug(`req.universityId = ${req.universityId}`);
    }
    next();
  }
}
