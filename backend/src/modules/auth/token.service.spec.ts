import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { TokenService } from './token.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

describe('TokenService', () => {
  const config = {
    getOrThrow: jest.fn().mockReturnValue({
      algorithm: 'RS256',
      accessPrivateKey: 'priv',
      accessPublicKey: 'pub',
      accessExpires: '15m',
      refreshExpires: '7d',
    }),
  } as unknown as ConfigService;

  const jwt = {
    sign: jest.fn().mockReturnValue('signed-jwt'),
  } as unknown as JwtService;

  describe('parseExpiry', () => {
    it('parses minutes', () => {
      const svc = new TokenService(jwt, {} as never, config);
      expect(svc.parseExpiry('15m')).toBe(15 * 60_000);
    });
    it('parses days', () => {
      const svc = new TokenService(jwt, {} as never, config);
      expect(svc.parseExpiry('7d')).toBe(7 * 86_400_000);
    });
    it('parses seconds', () => {
      const svc = new TokenService(jwt, {} as never, config);
      expect(svc.parseExpiry('30s')).toBe(30_000);
    });
  });

  describe('issuePair', () => {
    it('creates a refresh-token row with the SHA-256 fingerprint', async () => {
      const create = jest.fn();
      const prisma = { refreshToken: { create } } as never;
      const svc = new TokenService(jwt, prisma, config);
      const pair = await svc.issuePair('uid', {
        sub: 'uid',
        role: 'admin',
        uni: 'u1',
        email: 'admin@x.com',
      });
      expect(pair.accessToken).toBe('signed-jwt');
      expect(pair.refreshToken).toMatch(/^[A-Za-z0-9_\-]+$/);
      expect(create).toHaveBeenCalledTimes(1);
      const args = create.mock.calls[0][0];
      expect(args.data.userId).toBe('uid');
      // The stored hash is a SHA-256 hex digest of the raw token, not bcrypt.
      expect(args.data.tokenHash).toBe(sha256(pair.refreshToken));
      expect(args.data.tokenHash).toHaveLength(64);
    });
  });

  describe('rotateRefreshToken', () => {
    it('rejects unknown refresh tokens with TOKEN_INVALID', async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const prisma = { refreshToken: { findUnique } } as never;
      const svc = new TokenService(jwt, prisma, config);
      await expect(svc.rotateRefreshToken('not-real')).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_INVALID,
      });
      expect(findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: sha256('not-real') } }),
      );
    });

    it('rotates a valid refresh token and revokes the old one', async () => {
      const refresh = 'plain-refresh-token-xyz';
      const matched = {
        id: 'rt1',
        tokenHash: sha256(refresh),
        revokedAt: null,
        familyId: 'fam-1',
        expiresAt: new Date(Date.now() + 86_400_000),
        user: {
          id: 'u1',
          role: 'admin',
          universityId: 'uni1',
          email: 'a@x.com',
          isActive: true,
        },
      };
      const findUnique = jest.fn().mockResolvedValue(matched);
      const create = jest.fn();
      const update = jest.fn();
      const prisma = { refreshToken: { findUnique, create, update } } as never;
      const svc = new TokenService(jwt, prisma, config);
      const pair = await svc.rotateRefreshToken(refresh);
      expect(pair.accessToken).toBe('signed-jwt');
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'rt1' } }));
    });

    it('rejects refresh tokens for inactive users', async () => {
      const refresh = 'inactive-token';
      const matched = {
        id: 'rt1',
        tokenHash: sha256(refresh),
        revokedAt: null,
        familyId: 'fam-1',
        expiresAt: new Date(Date.now() + 86_400_000),
        user: {
          id: 'u1',
          role: 'admin',
          universityId: 'uni1',
          email: 'a@x.com',
          isActive: false,
        },
      };
      const findUnique = jest.fn().mockResolvedValue(matched);
      const prisma = { refreshToken: { findUnique } } as never;
      const svc = new TokenService(jwt, prisma, config);
      await expect(svc.rotateRefreshToken(refresh)).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_INVALID,
      });
    });

    it('detects re-use of a revoked token and burns the entire family', async () => {
      const refresh = 'stolen-token';
      const matched = {
        id: 'rt1',
        tokenHash: sha256(refresh),
        revokedAt: new Date(Date.now() - 60_000),
        familyId: 'fam-1',
        expiresAt: new Date(Date.now() + 86_400_000),
        user: {
          id: 'u1',
          role: 'admin',
          universityId: 'uni1',
          email: 'a@x.com',
          isActive: true,
        },
      };
      const findUnique = jest.fn().mockResolvedValue(matched);
      const updateMany = jest.fn();
      const prisma = { refreshToken: { findUnique, updateMany } } as never;
      const svc = new TokenService(jwt, prisma, config);
      await expect(svc.rotateRefreshToken(refresh)).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_INVALID,
      });
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ familyId: 'fam-1' }) }),
      );
    });
  });
});

// Dummy reference so AppException isn't tree-shaken from coverage.
void AppException;
