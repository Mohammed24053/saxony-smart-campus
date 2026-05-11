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
 * Deterministic hash for refresh-token lookup. Refresh tokens themselves are
 * 48 random bytes (~384 bits of entropy) so an attacker cannot brute-force
 * the preimage from the stored digest — making bcrypt unnecessary and the
 * O(n) scan-and-bcrypt-compare loop a DoS hazard. SHA-256 + a unique index
 * lets us look up the matching row in O(1).
 */
function fingerprintToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
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
    const tokenHash = fingerprintToken(refreshToken);
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
    // O(1) lookup by SHA-256 fingerprint. Includes revoked + expired rows so
    // we can detect re-use of a rotated token (token-theft signal) and burn
    // the entire family.
    const matched = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: fingerprintToken(refreshToken) },
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
      // `replacedBy` is a non-secret diagnostic pointer to the next token in
      // the chain (first 12 chars of the new token fingerprint, NOT the raw
      // token itself). Storing the raw token here would defeat the purpose
      // of hashing.
      data: { revokedAt: new Date(), replacedBy: fingerprintToken(pair.refreshToken).slice(0, 12) },
    });
    return pair;
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const matched = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: fingerprintToken(refreshToken) },
      select: { id: true, revokedAt: true },
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
