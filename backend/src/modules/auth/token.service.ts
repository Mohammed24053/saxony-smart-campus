import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtConfig } from '../../config/jwt.config';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

/**
 * HMAC-SHA-256 of the secret over the opaque token. Deterministic — lets us
 * look refresh tokens up in O(1) via the unique `tokenHash` column instead
 * of running bcrypt.compare() over hundreds of rows.
 *
 * We deliberately keep the secret distinct from the access-token RS256 key:
 * - JWT_REFRESH_SECRET — symmetric key used here
 * - JWT_ACCESS_PRIVATE_KEY / PUBLIC_KEY — RS256 keypair for the JWT
 *
 * Migration note: existing bcrypt-hashed rows will not match this lookup
 * after deploy — they live out their 7-day TTL inert, which is equivalent
 * to a one-time forced re-login. Tradeoff documented in SECURITY_AUDIT §2.3.
 */
export function hashRefreshToken(secret: string, token: string): string {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

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
    const tokenHash = hashRefreshToken(cfg.refreshSecret, refreshToken);
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
    // O(1) lookup against ALL refresh tokens (active + revoked) so we can
    // still detect re-use of a previously rotated token (theft signal).
    const cfg = this.config.getOrThrow<JwtConfig>('jwt');
    const lookupHash = hashRefreshToken(cfg.refreshSecret, refreshToken);
    const matched = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: lookupHash },
      include: { user: true },
    });
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
    const cfg = this.config.getOrThrow<JwtConfig>('jwt');
    const lookupHash = hashRefreshToken(cfg.refreshSecret, refreshToken);
    const matched = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: lookupHash },
    });
    if (!matched || matched.revokedAt) return;
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });
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
