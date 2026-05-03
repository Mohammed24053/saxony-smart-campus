import { AtRiskService } from './at-risk.service';

function makeQueue(): any {
  return { add: jest.fn() };
}

function basePrisma(overrides: Record<string, unknown> = {}): any {
  return {
    atRiskRecord: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'r1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'r1' }),
      update: jest.fn().mockResolvedValue({ id: 'r1', isResolved: true }),
    },
    atRiskSetting: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    user: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    student: { findMany: jest.fn().mockResolvedValue([]) },
    attendanceSession: { findUnique: jest.fn().mockResolvedValue(null) },
    attendanceRecord: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn().mockImplementation((arr: Promise<unknown>[]) => Promise.all(arr)),
    ...overrides,
  };
}

const fcm: any = { send: jest.fn().mockResolvedValue(true) };
const notifications: any = { send: jest.fn().mockResolvedValue({ id: 'n1' }) };

describe('AtRiskService.scheduleSessionCheck', () => {
  it('enqueues a check-absences job', async () => {
    const queue = makeQueue();
    const svc = new AtRiskService(basePrisma(), fcm, notifications, queue);
    await svc.scheduleSessionCheck('s1');
    expect(queue.add).toHaveBeenCalledWith(
      'check-absences',
      { sessionId: 's1' },
      expect.any(Object),
    );
  });
});

describe('AtRiskService.runCheck', () => {
  const session = {
    id: 's1',
    scheduleSlot: {
      sectionId: 'sec1',
      universityId: 'uni1',
      doctorId: 'doc1',
      subject: { id: 'sub1', name: 'Math' },
      doctor: { id: 'doc1' },
    },
  };

  it('exits silently when session is missing', async () => {
    const prisma = basePrisma();
    const svc = new AtRiskService(prisma, fcm, notifications, makeQueue());
    const r = await svc.runCheck('missing');
    expect(r).toEqual({ created: 0, notified: 0 });
  });

  it('exits when no AtRiskSetting is configured', async () => {
    const prisma = basePrisma({
      attendanceSession: { findUnique: jest.fn().mockResolvedValue(session) },
    });
    const svc = new AtRiskService(prisma, fcm, notifications, makeQueue());
    const r = await svc.runCheck('s1');
    expect(r.created).toBe(0);
    expect(r.notified).toBe(0);
  });

  it('creates a warning_1 record when student crosses threshold', async () => {
    const setting = {
      id: 'set1', subjectId: 'sub1', universityId: 'uni1',
      warning1Absences: 3, warning2Absences: 5, deprivationAbsences: 7,
      notifyStudent: true, notifyDoctor: false, notifyAdmin: false,
    };
    const prisma = basePrisma({
      attendanceSession: { findUnique: jest.fn().mockResolvedValue(session) },
      atRiskSetting: {
        ...basePrisma().atRiskSetting,
        findUnique: jest.fn().mockResolvedValue(setting),
      },
      student: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'stu1', user: { id: 'stu1', fcmToken: 'TKN' } },
        ]),
      },
      attendanceRecord: { count: jest.fn().mockResolvedValue(3) },
      atRiskRecord: { ...basePrisma().atRiskRecord, findFirst: jest.fn().mockResolvedValue(null) },
    });
    const svc = new AtRiskService(prisma, fcm, notifications, makeQueue());
    const r = await svc.runCheck('s1');
    expect(r.created).toBe(1);
    expect(r.notified).toBe(1);
    expect(notifications.send).toHaveBeenCalled();
    expect(fcm.send).toHaveBeenCalledWith('TKN', expect.any(Object));
  });

  it('creates a deprivation record when threshold exceeded', async () => {
    const setting = {
      id: 'set1', subjectId: 'sub1', universityId: 'uni1',
      warning1Absences: 3, warning2Absences: 5, deprivationAbsences: 7,
      notifyStudent: true, notifyDoctor: true, notifyAdmin: true,
    };
    notifications.send.mockClear();
    fcm.send.mockClear();
    const prisma = basePrisma({
      attendanceSession: { findUnique: jest.fn().mockResolvedValue(session) },
      atRiskSetting: {
        ...basePrisma().atRiskSetting,
        findUnique: jest.fn().mockResolvedValue(setting),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'admin1' }]),
        findFirst: jest.fn(),
      },
      student: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'stu1', user: { id: 'stu1', fcmToken: null } },
        ]),
      },
      attendanceRecord: { count: jest.fn().mockResolvedValue(8) },
      atRiskRecord: { ...basePrisma().atRiskRecord, findFirst: jest.fn().mockResolvedValue(null) },
    });
    const svc = new AtRiskService(prisma, fcm, notifications, makeQueue());
    const r = await svc.runCheck('s1');
    expect(r.created).toBe(1);
    const args = (notifications.send as jest.Mock).mock.calls[0];
    expect(args[2].title).toContain('Deprivation');
  });

  it('skips students that already have a record at this level', async () => {
    const setting = {
      id: 'set1', subjectId: 'sub1', universityId: 'uni1',
      warning1Absences: 3, warning2Absences: 5, deprivationAbsences: 7,
      notifyStudent: true, notifyDoctor: false, notifyAdmin: false,
    };
    const prisma = basePrisma({
      attendanceSession: { findUnique: jest.fn().mockResolvedValue(session) },
      atRiskSetting: {
        ...basePrisma().atRiskSetting,
        findUnique: jest.fn().mockResolvedValue(setting),
      },
      student: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'stu1', user: { id: 'stu1', fcmToken: null } },
        ]),
      },
      attendanceRecord: { count: jest.fn().mockResolvedValue(4) },
      atRiskRecord: {
        ...basePrisma().atRiskRecord,
        findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
      },
    });
    const svc = new AtRiskService(prisma, fcm, notifications, makeQueue());
    const r = await svc.runCheck('s1');
    expect(r.created).toBe(0);
  });
});
