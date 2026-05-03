import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '../../config/jwt.config';
import { AuthPrincipal } from '../../common/decorators/current-user.decorator';
import { Request } from 'express';

interface AccessTokenPayload {
  sub: string;
  role: 'admin' | 'student' | 'doctor';
  uni: string;
  email?: string | null;
  twoFa?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
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
    const principal: AuthPrincipal = {
      userId: payload.sub,
      role: payload.role,
      universityId: payload.uni,
      email: payload.email,
      twoFaVerified: payload.twoFa ?? false,
    };
    // Mirror onto req.auth so TenantMiddleware can hydrate req.universityId.
    req.auth = {
      userId: principal.userId,
      role: principal.role,
      universityId: principal.universityId,
    };
    req.universityId = principal.universityId;
    return principal;
  }
}
