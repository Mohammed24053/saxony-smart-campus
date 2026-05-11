import { NotificationsGateway } from './notifications.gateway';

describe('NotificationsGateway (auth + IDOR guard)', () => {
  function makeSocket(initial: { user?: unknown; auth?: Record<string, unknown> } = {}) {
    return {
      id: 'sock-1',
      handshake: { auth: initial.auth ?? {}, headers: {} },
      data: { user: initial.user },
      join: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Parameters<NotificationsGateway['onSubscribe']>[0];
  }

  it('disconnects unauthenticated clients on handleConnection', async () => {
    const jwt = { verifyAsync: jest.fn().mockRejectedValue(new Error('bad token')) } as never;
    const config = {
      getOrThrow: jest.fn().mockReturnValue({ algorithm: 'RS256', accessPublicKey: 'pub' }),
    } as never;
    const gateway = new NotificationsGateway(jwt, config);
    const sock = makeSocket({ auth: { token: 'forged' } });
    await gateway.handleConnection(sock);
    // Unauthenticated handshake => disconnect.
    // (The mocked socket records the call instead of really disconnecting.)
    expect((sock as unknown as { disconnect: jest.Mock }).disconnect).toHaveBeenCalledWith(true);
  });

  it('user:subscribe never honours a userId from the wire — forces the authenticated id', () => {
    const gateway = new NotificationsGateway({} as never, {} as never);
    const sock = makeSocket({
      user: { userId: 'real-user-A', role: 'student', universityId: 'uni-1' },
    });
    const result = gateway.onSubscribe(sock);
    expect(result).toEqual({ ok: true, userId: 'real-user-A' });
    // Joins exactly one room — the caller's own — regardless of any body.
    expect((sock as unknown as { join: jest.Mock }).join.mock.calls).toEqual([
      ['user:real-user-A'],
    ]);
  });

  it('disconnects when user:subscribe is invoked without an authenticated principal', () => {
    const gateway = new NotificationsGateway({} as never, {} as never);
    const sock = makeSocket({ user: undefined });
    const result = gateway.onSubscribe(sock);
    expect(result.ok).toBe(false);
    expect((sock as unknown as { disconnect: jest.Mock }).disconnect).toHaveBeenCalledWith(true);
  });
});
