import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';
import { LoginDto } from './dto/login.dto';
import { ErrorCodes } from '../../common/errors/error-codes';

const hashed = (pw: string) => bcrypt.hashSync(pw, 4);

function makeService(
  overrides: {
    user?: unknown;
    twoFaEnabled?: boolean;
    twoFaValid?: boolean;
    rateLimitOk?: boolean;
  } = {},
) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(overrides.user ?? null),
    },
  } as never;

  const redis = {
    rateLimit: jest.fn().mockResolvedValue(overrides.rateLimitOk ?? true),
  } as never;

  const tokens = {
    issuePair: jest.fn().mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
    }),
    rotateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
  } as unknown as TokenService;

  const twoFa = {
    isEnabled: jest.fn().mockResolvedValue(overrides.twoFaEnabled ?? false),
    verifyForLogin: jest.fn().mockResolvedValue(overrides.twoFaValid ?? false),
  } as unknown as TwoFactorService;

  return { svc: new AuthService(prisma, redis, tokens, twoFa), prisma, redis, tokens, twoFa };
}

describe('AuthService.login', () => {
  it('issues a token pair on valid student credentials', async () => {
    const { svc } = makeService({
      user: {
        id: 'u1',
        email: 'stu@x.com',
        passwordHash: hashed('pass1234'),
        role: 'student',
        universityId: 'uni1',
        isActive: true,
        deletedAt: null,
        name: 'Stu',
      },
    });
    const dto: LoginDto = { email: 'stu@x.com', password: 'pass1234' };
    const r = await svc.login(dto);
    expect(r.accessToken).toBe('a');
    expect(r.user.role).toBe('student');
  });

  it('rejects unknown emails with INVALID_CREDENTIALS', async () => {
    const { svc } = makeService({ user: null });
    await expect(svc.login({ email: 'nope', password: 'p' })).rejects.toMatchObject({
      code: ErrorCodes.INVALID_CREDENTIALS,
    });
  });

  it('rejects wrong passwords with INVALID_CREDENTIALS', async () => {
    const { svc } = makeService({
      user: {
        id: 'u1',
        email: 'a@x.com',
        passwordHash: hashed('correct'),
        role: 'admin',
        universityId: 'uni1',
        isActive: true,
        deletedAt: null,
        name: 'A',
      },
    });
    await expect(svc.login({ email: 'a@x.com', password: 'wrong' })).rejects.toMatchObject({
      code: ErrorCodes.INVALID_CREDENTIALS,
    });
  });

  it('demands 2FA for admins with 2FA enabled but no code', async () => {
    const { svc } = makeService({
      user: {
        id: 'u1',
        email: 'a@x.com',
        passwordHash: hashed('pw'),
        role: 'admin',
        universityId: 'uni1',
        isActive: true,
        deletedAt: null,
        name: 'A',
      },
      twoFaEnabled: true,
    });
    await expect(svc.login({ email: 'a@x.com', password: 'pw' })).rejects.toMatchObject({
      code: ErrorCodes.TWO_FA_REQUIRED,
    });
  });

  it('rejects bad 2FA codes with TWO_FA_INVALID', async () => {
    const { svc } = makeService({
      user: {
        id: 'u1',
        email: 'a@x.com',
        passwordHash: hashed('pw'),
        role: 'admin',
        universityId: 'uni1',
        isActive: true,
        deletedAt: null,
        name: 'A',
      },
      twoFaEnabled: true,
      twoFaValid: false,
    });
    await expect(
      svc.login({ email: 'a@x.com', password: 'pw', twoFactorCode: '000000' }),
    ).rejects.toMatchObject({ code: ErrorCodes.TWO_FA_INVALID });
  });

  it('admits valid admin + 2FA combo', async () => {
    const { svc } = makeService({
      user: {
        id: 'u1',
        email: 'a@x.com',
        passwordHash: hashed('pw'),
        role: 'admin',
        universityId: 'uni1',
        isActive: true,
        deletedAt: null,
        name: 'A',
      },
      twoFaEnabled: true,
      twoFaValid: true,
    });
    const r = await svc.login({ email: 'a@x.com', password: 'pw', twoFactorCode: '123456' });
    expect(r.accessToken).toBe('a');
  });

  it('rejects login when rate limit exceeded', async () => {
    const { svc } = makeService({ rateLimitOk: false });
    await expect(svc.login({ email: 'a', password: 'b' }, { ip: '1.1.1.1' })).rejects.toMatchObject(
      {
        code: ErrorCodes.RATE_LIMITED,
      },
    );
  });

  it('rejects login for inactive users', async () => {
    const { svc } = makeService({
      user: {
        id: 'u1',
        email: 'a@x.com',
        passwordHash: hashed('pw'),
        role: 'admin',
        universityId: 'uni1',
        isActive: false,
        deletedAt: null,
        name: 'A',
      },
    });
    await expect(svc.login({ email: 'a@x.com', password: 'pw' })).rejects.toMatchObject({
      code: ErrorCodes.INVALID_CREDENTIALS,
    });
  });
});
