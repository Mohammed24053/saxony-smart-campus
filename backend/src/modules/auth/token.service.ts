import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtConfig } from '../../config/jwt.config';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  uni: string;
  email?: string | null;
  twoFa?: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(claims: AccessTokenClaims): string {
    const cfg = this.config.getOrThrow<JwtConfig>('jwt');
    return this.jwt.sign(claims, {
      algorithm: cfg.algorithm,
      privateKey: cfg.accessPrivateKey,
      expiresIn: cfg.accessExpires,
    });
  }

  async issuePair(
    userId: string,
    claims: AccessTokenClaims,
    meta: { userAgent?: string; ipAddress?: string; familyId?: string } = {},
  ): Promise<TokenPair> {
    const cfg = this.config.getOrThrow<JwtConfig>('jwt');
    const accessToken = this.signAccessToken(claims);
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = await bcrypt.hash(refreshToken, 12);
    const expiresAt = new Date(Date.now() + this.parseExpiry(cfg.refreshExpires));
    const familyId = meta.familyId ?? crypto.randomUUID();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: cfg.accessExpires,
      refreshTokenExpiresIn: cfg.refreshExpires,
    };
  }

  async rotateRefreshToken(
    refreshToken: string,
    meta: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<TokenPair> {
    // Match against ALL refresh tokens (active + revoked) so we can detect
    // re-use of a previously rotated token (token theft signal).
    const candidates = await this.prisma.refreshToken.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });
    let matched = null;
    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(refreshToken, c.tokenHash)) {
        matched = c;
        break;
      }
    }
    if (!matched || !matched.user.isActive) throw new AppException(ErrorCodes.TOKEN_INVALID);

    // Token theft: a revoked-or-expired refresh token was presented.
    // Revoke the entire family — every sibling refresh token issued in the
    // same auth chain. The legitimate user will be forced to log in again.
    if (matched.revokedAt || matched.expiresAt < new Date()) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: matched.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'family_compromised' },
      });
      throw new AppException(ErrorCodes.TOKEN_INVALID);
    }

    const claims: AccessTokenClaims = {
      sub: matched.user.id,
      role: matched.user.role,
      uni: matched.user.universityId,
      email: matched.user.email,
      twoFa: matched.user.role === 'admin', // refreshed pairs assume prior 2FA still satisfied
    };
    const pair = await this.issuePair(matched.user.id, claims, {
      ...meta,
      familyId: matched.familyId,
    });
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date(), replacedBy: pair.refreshToken.slice(0, 12) },
    });
    return pair;
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(refreshToken, c.tokenHash)) {
        await this.prisma.refreshToken.update({
          where: { id: c.id },
          data: { revokedAt: new Date() },
        });
        return;
      }
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Parses expiry strings like "15m", "7d", "24h", "60s". */
  parseExpiry(value: string): number {
    const m = /^(\d+)([smhd])$/.exec(value.trim());
    if (!m) return 7 * 24 * 3600 * 1000;
    const n = parseInt(m[1], 10);
    switch (m[2]) {
      case 's':
        return n * 1000;
      case 'm':
        return n * 60_000;
      case 'h':
        return n * 3_600_000;
      case 'd':
        return n * 86_400_000;
      default:
        return 0;
    }
  }
}
