import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { TokenService, TokenPair } from './token.service';
import { TwoFactorService } from './two-factor.service';
import { LoginDto } from './dto/login.dto';

export interface AuthenticatedUser {
  id: string;
  universityId: string;
  role: 'admin' | 'student' | 'doctor';
  name: string;
  email: string | null;
}

export interface LoginResult extends TokenPair {
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
    private readonly twoFa: TwoFactorService,
  ) {}

  async login(dto: LoginDto, meta: { ip?: string; ua?: string } = {}): Promise<LoginResult> {
    // Per-IP login rate limit: 10 / 60s.
    if (meta.ip) {
      const ok = await this.redis.rateLimit(`rate:login:${meta.ip}`, 10, 60);
      if (!ok) throw new AppException(ErrorCodes.RATE_LIMITED);
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive || user.deletedAt) {
      throw new AppException(ErrorCodes.INVALID_CREDENTIALS);
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new AppException(ErrorCodes.INVALID_CREDENTIALS);

    let twoFaVerified = false;
    if (user.role === 'admin') {
      const enabled = await this.twoFa.isEnabled(user.id);
      if (enabled) {
        twoFaVerified = await this.twoFa.verifyForLogin(user.id, dto.twoFactorCode);
        if (!twoFaVerified) {
          throw new AppException(
            dto.twoFactorCode ? ErrorCodes.TWO_FA_INVALID : ErrorCodes.TWO_FA_REQUIRED,
          );
        }
      }
    }

    const pair = await this.tokens.issuePair(
      user.id,
      {
        sub: user.id,
        role: user.role,
        uni: user.universityId,
        email: user.email,
        twoFa: twoFaVerified,
      },
      { userAgent: meta.ua, ipAddress: meta.ip },
    );

    return {
      ...pair,
      user: {
        id: user.id,
        universityId: user.universityId,
        role: user.role,
        name: user.name,
        email: user.email,
      },
    };
  }

  async refresh(refreshToken: string, meta: { ip?: string; ua?: string } = {}): Promise<TokenPair> {
    return this.tokens.rotateRefreshToken(refreshToken, {
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) await this.tokens.revokeRefreshToken(refreshToken);
  }

  async setupTwoFa(userId: string, label: string) {
    return this.twoFa.setup(userId, label);
  }

  async verifyTwoFa(userId: string, code: string) {
    return this.twoFa.verifyAndEnable(userId, code);
  }
}
