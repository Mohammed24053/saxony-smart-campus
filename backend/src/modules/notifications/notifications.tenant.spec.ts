import { NotificationsService } from './notifications.service';

describe('NotificationsService.send (cross-tenant guard)', () => {
  const baseArgs = {
    type: 'general' as const,
    title: 'hello',
    body: 'world',
  };

  function buildSvc(opts: { allowedUsers: Array<{ id: string }> }) {
    let firstUserFindMany = true;
    const userFindMany = jest
      .fn()
      .mockImplementation(({ where }: { where: { universityId?: string } }) => {
        if (firstUserFindMany) {
          firstUserFindMany = false;
          // First call is the cross-tenant guard — must filter on universityId.
          expect(where.universityId).toBeDefined();
          return Promise.resolve(opts.allowedUsers);
        }
        // Subsequent call is the legacy fcmToken fallback (no tenant filter
        // needed because the recipient list is already tenant-scoped).
        return Promise.resolve([]);
      });
    const tokenFindMany = jest.fn().mockResolvedValue([]);
    const create = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'notif-1',
        ...data,
        sentAt: new Date(),
      }),
    );

    const prisma = {
      user: { findMany: userFindMany },
      notification: { create },
      pushToken: { findMany: tokenFindMany },
    };
    const fcm = { sendToMany: jest.fn() };
    const gateway = { emitNew: jest.fn() };

    const svc = new NotificationsService(prisma as never, fcm as never, gateway as never);
    return { svc, userFindMany, create, gateway };
  }

  it('filters recipientUserIds down to the caller universe', async () => {
    const { svc, create, gateway } = buildSvc({
      allowedUsers: [{ id: 'same-tenant-user-1' }],
    });

    await svc.send('uni-A', 'admin-1', {
      ...baseArgs,
      targetType: 'user',
      recipientUserIds: ['same-tenant-user-1', 'cross-tenant-leaker-2'],
    });

    // Only the in-tenant user should make it into the recipients table.
    expect(create).toHaveBeenCalledTimes(1);
    const created = create.mock.calls[0][0];
    expect(created.data.recipients.createMany.data).toEqual([{ userId: 'same-tenant-user-1' }]);

    // The realtime fan-out must respect the same filter.
    expect(gateway.emitNew).toHaveBeenCalledTimes(1);
    expect(gateway.emitNew).toHaveBeenCalledWith('same-tenant-user-1', expect.any(Object));
  });
});
