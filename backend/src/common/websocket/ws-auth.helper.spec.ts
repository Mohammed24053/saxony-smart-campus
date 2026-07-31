import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { verifySocketHandshake } from './ws-auth.helper';

function fakeSocket(opts: { authToken?: string; authHeader?: string }): Socket {
  return {
    handshake: {
      auth: opts.authToken ? { token: opts.authToken } : {},
      headers: opts.authHeader ? { authorization: opts.authHeader } : {},
    },
  } as unknown as Socket;
}

describe('verifySocketHandshake', () => {
  it('returns null when no token is supplied', async () => {
    const jwt = { verifyAsync: jest.fn() } as unknown as JwtService;
    const result = await verifySocketHandshake(fakeSocket({}), jwt);
    expect(result).toBeNull();
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('returns null when JWT verification fails', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('invalid signature')),
    } as unknown as JwtService;
    const result = await verifySocketHandshake(fakeSocket({ authToken: 'bad' }), jwt);
    expect(result).toBeNull();
  });

  it('returns null when claims are incomplete', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1' /* missing role+uni */ }),
    } as unknown as JwtService;
    const result = await verifySocketHandshake(fakeSocket({ authToken: 'x' }), jwt);
    expect(result).toBeNull();
  });

  it('extracts principal from auth.token', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'u1',
        role: 'admin',
        uni: 'uni1',
        email: 'a@x.com',
      }),
    } as unknown as JwtService;
    const result = await verifySocketHandshake(fakeSocket({ authToken: 'good' }), jwt);
    expect(result).toEqual({
      userId: 'u1',
      role: 'admin',
      universityId: 'uni1',
      email: 'a@x.com',
    });
  });

  it('extracts principal from Authorization header', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'u1',
        role: 'student',
        uni: 'uni1',
      }),
    } as unknown as JwtService;
    const result = await verifySocketHandshake(fakeSocket({ authHeader: 'Bearer abc' }), jwt);
    expect(result?.userId).toBe('u1');
    expect(jwt.verifyAsync).toHaveBeenCalledWith('abc');
  });
});
