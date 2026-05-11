import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtConfig } from '../../config/jwt.config';
import { AuthPrincipal } from '../../common/decorators/current-user.decorator';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';

interface AccessTokenPayload {
  sub: string;
  role: 'admin' | 'student' | 'doctor';
  uni: string;
  email?: string | null;
  twoFa?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    const jwt = config.getOrThrow<JwtConfig>('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.accessPublicKey,
      algorithms: ['RS256'],
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: AccessTokenPayload): Promise<AuthPrincipal> {
    // Lightweight per-request liveness check. We cache the result in Redis
    // for `userStatus:<sub>` keyed at 30s so the DB is hit at most twice per
    // minute per active user — but a deactivated user no longer waits for
    // the full access-token expiry (default 15m) to be evicted. If Redis is
    // down we fall back to a direct DB read; if THAT fails we let the user
    // through (the JWT signature already vouched for them).
    const cacheKey = `userStatus:${payload.sub}`;
    let status: 'active' | 'inactive' | null = null;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached === 'active' || cached === 'inactive') status = cached;
    } catch {
      /* redis unavailable — fall through to DB */
    }
    if (status === null) {
      try {
        const row = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { isActive: true, deletedAt: true, role: true, universityId: true },
        });
        if (!row || !row.isActive || row.deletedAt) {
          status = 'inactive';
        } else if (row.role !== payload.role || row.universityId !== payload.uni) {
          // Claims drift — role/tenant changed since token issuance. Treat
          // as inactive to force re-login with the corrected claims.
          status = 'inactive';
        } else {
          status = 'active';
        }
        try {
          await this.redis.setex(cacheKey, 30, status);
        } catch {
          /* best-effort cache write */
        }
      } catch {
        /* if both Redis + DB are unhealthy, fall through and accept */
        status = 'active';
      }
    }
    if (status === 'inactive') {
      throw new UnauthorizedException('User is no longer active');
    }

    const principal: AuthPrincipal = {
      userId: payload.sub,
      role: payload.role,
      universityId: payload.uni,
      email: payload.email,
      twoFaVerified: payload.twoFa ?? false,
    };
    req.auth = {
      userId: principal.userId,
      role: principal.role,
      universityId: principal.universityId,
    };
    req.universityId = principal.universityId;
    return principal;
  }
}
