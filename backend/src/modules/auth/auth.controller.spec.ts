import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppException } from '../../common/errors/app.exception';

/**
 * Cookie-aware auth controller tests.
 *
 * The controller is the only auth surface that touches the HttpOnly refresh
 * cookie — these tests pin down the contract:
 *   1. /login mirrors the refresh token to a Set-Cookie header.
 *   2. /refresh accepts the cookie when the body is empty (web flow) AND
 *      accepts the body when the cookie is missing (mobile flow).
 *   3. /logout clears the cookie.
 *
 * The underlying AuthService is mocked so we never touch the database.
 */
describe('AuthController (cookie wiring)', () => {
  let controller: AuthController;
  let auth: jest.Mocked<AuthService>;

  beforeEach(async () => {
    auth = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      setupTwoFa: jest.fn(),
      verifyTwoFa: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  function buildReq(overrides: Partial<Request> = {}): Request {
    return {
      headers: { 'user-agent': 'jest' },
      cookies: {},
      secure: false,
      ...overrides,
    } as unknown as Request;
  }

  type FakeRes = {
    cookies: Array<{ name: string; value: string; opts: Record<string, unknown> }>;
    cleared: string[];
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };

  function buildRes(): Response {
    const fake: FakeRes = {
      cookies: [],
      cleared: [],
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    fake.cookie.mockImplementation((name: string, value: string, opts: Record<string, unknown>) => {
      fake.cookies.push({ name, value, opts });
      return fake;
    });
    fake.clearCookie.mockImplementation((name: string) => {
      fake.cleared.push(name);
      return fake;
    });
    return fake as unknown as Response;
  }

  // Helpers to read mock state without juggling the FakeRes type at call sites.
  const cookiesOf = (res: Response): FakeRes['cookies'] => (res as unknown as FakeRes).cookies;
  const clearedOf = (res: Response): FakeRes['cleared'] => (res as unknown as FakeRes).cleared;

  it('login: writes the refresh token to an HttpOnly cookie', async () => {
    auth.login.mockResolvedValueOnce({
      accessToken: 'a.b.c',
      refreshToken: 'r.r.r',
      user: { id: 'u1', email: 'a@b.com', name: 'Admin', role: 'admin', universityId: 'uni' },
    } as never);

    const req = buildReq();
    const res = buildRes();
    const result = await controller.login(
      { email: 'a@b.com', password: 'secret-pw' },
      '127.0.0.1',
      req,
      res,
    );

    expect(result).toMatchObject({ accessToken: 'a.b.c' });
    const cookies = cookiesOf(res);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: 'refreshToken',
      value: 'r.r.r',
      opts: expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/' }),
    });
  });

  it('refresh: prefers body token (mobile flow)', async () => {
    auth.refresh.mockResolvedValueOnce({ accessToken: 'A2', refreshToken: 'R2' } as never);
    const req = buildReq({ cookies: { refreshToken: 'cookie-token' } as never });
    const res = buildRes();

    await controller.refresh({ refreshToken: 'body-token' }, '127.0.0.1', req, res);

    expect(auth.refresh).toHaveBeenCalledWith(
      'body-token',
      expect.objectContaining({ ip: '127.0.0.1' }),
    );
    expect(cookiesOf(res)[0].value).toBe('R2');
  });

  it('refresh: falls back to cookie when body is empty (web flow)', async () => {
    auth.refresh.mockResolvedValueOnce({ accessToken: 'A3', refreshToken: 'R3' } as never);
    const req = buildReq({ cookies: { refreshToken: 'cookie-token' } as never });
    const res = buildRes();

    await controller.refresh({}, '127.0.0.1', req, res);

    expect(auth.refresh).toHaveBeenCalledWith('cookie-token', expect.anything());
  });

  it('refresh: rejects when neither body nor cookie carries a token', async () => {
    const req = buildReq();
    const res = buildRes();

    await expect(controller.refresh({}, '127.0.0.1', req, res)).rejects.toBeInstanceOf(
      AppException,
    );
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it('logout: clears the refresh cookie', async () => {
    auth.logout.mockResolvedValueOnce(undefined as never);
    const req = buildReq({ cookies: { refreshToken: 'cookie-token' } as never });
    const res = buildRes();

    const result = await controller.logout({}, req, res);

    expect(result).toEqual({ success: true });
    expect(auth.logout).toHaveBeenCalledWith('cookie-token');
    expect(clearedOf(res)).toContain('refreshToken');
  });
});
