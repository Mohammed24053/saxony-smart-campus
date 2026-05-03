import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { TokenService } from './token.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

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
    it('creates a refresh-token row hashed with bcrypt', async () => {
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
      expect(await bcrypt.compare(pair.refreshToken, args.data.tokenHash)).toBe(true);
    });
  });

  describe('rotateRefreshToken', () => {
    it('rejects unknown refresh tokens with TOKEN_INVALID', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { refreshToken: { findMany } } as never;
      const svc = new TokenService(jwt, prisma, config);
      await expect(svc.rotateRefreshToken('not-real')).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_INVALID,
      });
    });

    it('rotates a valid refresh token and revokes the old one', async () => {
      const refresh = 'plain-refresh-token-xyz';
      const tokenHash = await bcrypt.hash(refresh, 12);
      const candidates = [
        {
          id: 'rt1',
          tokenHash,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 86_400_000),
          user: {
            id: 'u1',
            role: 'admin',
            universityId: 'uni1',
            email: 'a@x.com',
            isActive: true,
          },
        },
      ];
      const findMany = jest.fn().mockResolvedValue(candidates);
      const create = jest.fn();
      const update = jest.fn();
      const prisma = { refreshToken: { findMany, create, update } } as never;
      const svc = new TokenService(jwt, prisma, config);
      const pair = await svc.rotateRefreshToken(refresh);
      expect(pair.accessToken).toBe('signed-jwt');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt1' } }),
      );
    });

    it('rejects refresh tokens for inactive users', async () => {
      const refresh = 'inactive-token';
      const tokenHash = await bcrypt.hash(refresh, 12);
      const candidates = [
        {
          id: 'rt1',
          tokenHash,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 86_400_000),
          user: { id: 'u1', role: 'admin', universityId: 'uni1', email: 'a@x.com', isActive: false },
        },
      ];
      const prisma = {
        refreshToken: { findMany: jest.fn().mockResolvedValue(candidates) },
      } as never;
      const svc = new TokenService(jwt, prisma, config);
      await expect(svc.rotateRefreshToken(refresh)).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_INVALID,
      });
    });
  });
});

// Dummy reference so AppException isn't tree-shaken from coverage.
void AppException;
