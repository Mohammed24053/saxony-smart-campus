import { MeService } from './me.service';
import { ErrorCodes } from '../../common/errors/error-codes';

describe('MeService.registerPushToken (hijack guard)', () => {
  function makeService(rows: Array<{ token: string; userId: string } | null>) {
    let i = 0;
    const findUnique = jest.fn().mockImplementation(() => Promise.resolve(rows[i++]));
    const create = jest.fn();
    const update = jest.fn();
    const prisma = {
      pushToken: { findUnique, create, update },
    } as never;
    const svc = new MeService(prisma, {} as never, {} as never);
    return { svc, findUnique, create, update };
  }

  it('creates a fresh row when the token is unbound', async () => {
    const { svc, create } = makeService([null]);
    await svc.registerPushToken('user-A', 'fcm-token-1', 'android');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 'user-A', token: 'fcm-token-1', platform: 'android' },
      }),
    );
  });

  it('updates only platform + lastSeenAt when the same user re-registers', async () => {
    const { svc, update, create } = makeService([{ token: 'fcm-token-1', userId: 'user-A' }]);
    await svc.registerPushToken('user-A', 'fcm-token-1', 'ios');
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'fcm-token-1' },
        data: expect.objectContaining({ platform: 'ios' }),
      }),
    );
  });

  it('refuses to rebind a token already owned by another user (CWE-639/841)', async () => {
    const { svc, update, create } = makeService([{ token: 'fcm-token-1', userId: 'victim-B' }]);
    await expect(
      svc.registerPushToken('attacker-C', 'fcm-token-1', 'android'),
    ).rejects.toMatchObject({
      code: ErrorCodes.FORBIDDEN,
    });
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
