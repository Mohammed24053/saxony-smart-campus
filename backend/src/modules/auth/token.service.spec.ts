import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { TokenService, hashRefreshToken } from './token.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

describe('TokenService', () => {
  const refreshSecret = 'unit-test-refresh-secret-32-bytes!';
  const config = {
    getOrThrow: jest.fn().mockReturnValue({
      algorithm: 'RS256',
      accessPrivateKey: 'priv',
      accessPublicKey: 'pub',
      refreshSecret,
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
    it('stores the refresh token as an HMAC-SHA-256 lookup hash', async () => {
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
      // Deterministic — recomputable from the plaintext token + the secret.
      expect(args.data.tokenHash).toBe(hashRefreshToken(refreshSecret, pair.refreshToken));
      // Not a bcrypt hash and not the plaintext.
      expect(args.data.tokenHash.startsWith('$2')).toBe(false);
      expect(args.data.tokenHash).not.toBe(pair.refreshToken);
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
      // O(1) lookup — exactly one query, not a scan.
      expect(findUnique).toHaveBeenCalledTimes(1);
    });

    it('rotates a valid refresh token and revokes the old one', async () => {
      const refresh = crypto.randomBytes(48).toString('base64url');
      const tokenHash = hashRefreshToken(refreshSecret, refresh);
      const matched = {
        id: 'rt1',
        tokenHash,
        familyId: 'fam1',
        revokedAt: null,
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
      const updateMany = jest.fn();
      const prisma = {
        refreshToken: { findUnique, create, update, updateMany },
      } as never;
      const svc = new TokenService(jwt, prisma, config);
      const pair = await svc.rotateRefreshToken(refresh);
      expect(pair.accessToken).toBe('signed-jwt');
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'rt1' } }));
    });

    it('rejects refresh tokens for inactive users', async () => {
      const refresh = crypto.randomBytes(48).toString('base64url');
      const tokenHash = hashRefreshToken(refreshSecret, refresh);
      const matched = {
        id: 'rt1',
        tokenHash,
        familyId: 'fam1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
        user: {
          id: 'u1',
          role: 'admin',
          universityId: 'uni1',
          email: 'a@x.com',
          isActive: false,
        },
      };
      const prisma = {
        refreshToken: { findUnique: jest.fn().mockResolvedValue(matched) },
      } as never;
      const svc = new TokenService(jwt, prisma, config);
      await expect(svc.rotateRefreshToken(refresh)).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_INVALID,
      });
    });

    it('revokes the entire family when a re-used (revoked) refresh token is presented', async () => {
      const refresh = crypto.randomBytes(48).toString('base64url');
      const tokenHash = hashRefreshToken(refreshSecret, refresh);
      const matched = {
        id: 'rt1',
        tokenHash,
        familyId: 'famX',
        revokedAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 86_400_000),
        user: {
          id: 'u1',
          role: 'admin',
          universityId: 'uni1',
          email: 'a@x.com',
          isActive: true,
        },
      };
      const updateMany = jest.fn();
      const prisma = {
        refreshToken: {
          findUnique: jest.fn().mockResolvedValue(matched),
          updateMany,
        },
      } as never;
      const svc = new TokenService(jwt, prisma, config);
      await expect(svc.rotateRefreshToken(refresh)).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_INVALID,
      });
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ familyId: 'famX' }),
          data: expect.objectContaining({ revokedReason: 'family_compromised' }),
        }),
      );
    });
  });
});

// Dummy reference so AppException isn't tree-shaken from coverage.
void AppException;
