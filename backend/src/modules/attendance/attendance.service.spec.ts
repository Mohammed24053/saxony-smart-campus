import { AttendanceService } from './attendance.service';
import { AttendanceGateway } from './attendance.gateway';
import { GpsService } from './gps.service';
import { QrTokenService } from './qr-token.service';
import { ErrorCodes } from '../../common/errors/error-codes';
import { AuthPrincipal } from '../../common/decorators/current-user.decorator';

const studentPrincipal: AuthPrincipal = {
  userId: 'stu1',
  role: 'student',
  universityId: 'uni1',
  email: 'stu@x.com',
};

function setup(
  opts: {
    qrVerify?: object | null;
    qrParse?: object;
    qrCodeRow?: object | null;
    session?: object | null;
    enrolledStudent?: object | null;
    redisGet?: string | null;
    setNxEx?: 'OK' | null;
    rateLimitOk?: boolean;
  } = {},
): any {
  const qr = {
    parsePayload: jest.fn().mockReturnValue(
      opts.qrParse ?? {
        sessionId: 's1',
        roomId: 'r1',
        courseId: 'c1',
        intervalSeconds: 30,
        token: 't1',
      },
    ),
    verify: jest.fn().mockReturnValue(
      opts.qrVerify === undefined
        ? {
            sessionId: 's1',
            roomId: 'r1',
            courseId: 'c1',
            timeWindow: 1,
            ageSeconds: 5,
          }
        : opts.qrVerify,
    ),
    buildPayload: jest.fn().mockReturnValue({ token: 't1', payload: '{}', expiresAt: new Date() }),
  } as unknown as QrTokenService;

  const gps = {
    distance: jest.fn().mockReturnValue(10),
    isWithinRadius: jest.fn().mockReturnValue(true),
  } as unknown as GpsService;

  const gateway = {
    emitAttendance: jest.fn(),
    emitCount: jest.fn(),
    emitQrRefresh: jest.fn(),
    emitTimeout: jest.fn(),
  } as unknown as AttendanceGateway;

  const redis = {
    rateLimit: jest.fn().mockResolvedValue(opts.rateLimitOk ?? true),
    get: jest.fn().mockResolvedValue(opts.redisGet ?? null),
    setex: jest.fn().mockResolvedValue('OK'),
    setNxEx: jest.fn().mockResolvedValue('setNxEx' in opts ? opts.setNxEx : 'OK'),
  } as never;

  const prisma = {
    qrCode: { findFirst: jest.fn().mockResolvedValue(opts.qrCodeRow ?? null), create: jest.fn() },
    attendanceSession: {
      findUnique: jest.fn().mockResolvedValue(opts.session ?? null),
      findUniqueOrThrow: jest.fn().mockResolvedValue(opts.session),
    },
    student: {
      findUnique: jest.fn().mockResolvedValue(opts.enrolledStudent ?? null),
      count: jest.fn().mockResolvedValue(20),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'stu1', name: 'Stu' }) },
    attendanceRecord: {
      upsert: jest.fn().mockResolvedValue({ id: 'rec1', status: 'present' }),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
  } as never;

  const atRiskQueue: any = { add: jest.fn().mockResolvedValue(undefined) };

  return {
    svc: new AttendanceService(prisma, redis, qr, gps, gateway, atRiskQueue),
    qr,
    gps,
    gateway,
    redis,
    prisma,
    atRiskQueue,
  };
}

const goodSession = {
  id: 's1',
  status: 'active',
  startedAt: new Date(Date.now() - 60_000),
  lateAfterMinutes: 15,
  scheduleSlot: {
    sectionId: 'sec1',
    universityId: 'uni1',
    section: { id: 'sec1' },
    room: { latitude: 30.0, longitude: 31.0, gpsRadius: 50, gpsEnabled: true },
    subject: { id: 'sub1' },
  },
};

describe('AttendanceService.scan — 5-step verification', () => {
  it('Step 1: rejects bad QR with QR_INVALID', async () => {
    const { svc } = setup({ qrVerify: null, qrCodeRow: null });
    await expect(svc.scan('uni1', studentPrincipal, { payload: '{}' })).rejects.toMatchObject({
      code: ErrorCodes.QR_INVALID,
    });
  });

  it('Step 1: rejects expired QR with QR_EXPIRED when token was previously valid', async () => {
    const { svc } = setup({ qrVerify: null, qrCodeRow: { id: 'q1' } });
    await expect(svc.scan('uni1', studentPrincipal, { payload: '{}' })).rejects.toMatchObject({
      code: ErrorCodes.QR_EXPIRED,
    });
  });

  it('Step 2/3: rejects when session not found', async () => {
    const { svc } = setup({ session: null });
    await expect(svc.scan('uni1', studentPrincipal, { payload: '{}' })).rejects.toMatchObject({
      code: ErrorCodes.SESSION_NOT_FOUND,
    });
  });

  it('Step 3: rejects when session is closed', async () => {
    const { svc } = setup({ session: { ...goodSession, status: 'closed' } });
    await expect(svc.scan('uni1', studentPrincipal, { payload: '{}' })).rejects.toMatchObject({
      code: ErrorCodes.SESSION_CLOSED,
    });
  });

  it('Step 2: rejects when student not in section (NOT_ENROLLED)', async () => {
    const { svc } = setup({
      session: goodSession,
      enrolledStudent: { id: 'stu1', sectionId: 'someoneelse' },
    });
    await expect(svc.scan('uni1', studentPrincipal, { payload: '{}' })).rejects.toMatchObject({
      code: ErrorCodes.NOT_ENROLLED,
    });
  });

  it('Step 4: rejects when GPS is required but missing', async () => {
    const { svc } = setup({
      session: goodSession,
      enrolledStudent: { id: 'stu1', sectionId: 'sec1' },
    });
    await expect(svc.scan('uni1', studentPrincipal, { payload: '{}' })).rejects.toMatchObject({
      code: ErrorCodes.GPS_UNAVAILABLE,
    });
  });

  it('Step 4: rejects when GPS is out of range', async () => {
    const { svc, gps } = setup({
      session: goodSession,
      enrolledStudent: { id: 'stu1', sectionId: 'sec1' },
    });
    (gps.distance as jest.Mock).mockReturnValue(500); // outside 50m radius
    await expect(
      svc.scan('uni1', studentPrincipal, { payload: '{}', gpsLat: 30.5, gpsLng: 31.5 }),
    ).rejects.toMatchObject({ code: ErrorCodes.GPS_OUT_OF_RANGE });
  });

  it('Step 5: rejects duplicate scan with ALREADY_REGISTERED', async () => {
    const { svc } = setup({
      session: goodSession,
      enrolledStudent: { id: 'stu1', sectionId: 'sec1' },
      setNxEx: null, // SET NX EX returned null — another scan already claimed the key
    });
    await expect(
      svc.scan('uni1', studentPrincipal, { payload: '{}', gpsLat: 30.0, gpsLng: 31.0 }),
    ).rejects.toMatchObject({ code: ErrorCodes.ALREADY_REGISTERED });
  });

  it('Step 5: claims idempotency key atomically with SET NX EX (not GET+SETEX)', async () => {
    const { svc, redis } = setup({
      session: goodSession,
      enrolledStudent: { id: 'stu1', sectionId: 'sec1' },
    });
    await svc.scan('uni1', studentPrincipal, {
      payload: '{}',
      gpsLat: 30.0,
      gpsLng: 31.0,
    });
    expect((redis as any).setNxEx).toHaveBeenCalledWith('attendance:s1:stu1', '1', 86_400);
    // Should NOT use the racy GET → SETEX pair anymore.
    expect((redis as any).setex).not.toHaveBeenCalled();
  });

  it('happy path: marks present and emits realtime event', async () => {
    const { svc, gateway, prisma } = setup({
      session: goodSession,
      enrolledStudent: { id: 'stu1', sectionId: 'sec1' },
    });
    const r = await svc.scan('uni1', studentPrincipal, {
      payload: '{}',
      gpsLat: 30.0,
      gpsLng: 31.0,
    });
    expect(r.status).toBe('present');
    expect(prisma.attendanceRecord.upsert).toHaveBeenCalled();
    expect(gateway.emitAttendance).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        studentId: 'stu1',
        status: 'present',
      }),
    );
  });

  it('marks late when scanned past lateAfterMinutes window', async () => {
    const old = {
      ...goodSession,
      startedAt: new Date(Date.now() - 30 * 60_000), // 30 min ago, threshold 15
    };
    const { svc } = setup({
      session: old,
      enrolledStudent: { id: 'stu1', sectionId: 'sec1' },
    });
    const r = await svc.scan('uni1', studentPrincipal, {
      payload: '{}',
      gpsLat: 30.0,
      gpsLng: 31.0,
    });
    expect(r.status).toBe('late');
  });

  it('rejects when device exceeds rate limit', async () => {
    const { svc } = setup({ rateLimitOk: false });
    await expect(
      svc.scan('uni1', studentPrincipal, { payload: '{}', deviceFingerprint: 'aa' }),
    ).rejects.toMatchObject({ code: ErrorCodes.RATE_LIMITED });
  });

  it('rejects non-student callers with FORBIDDEN', async () => {
    const { svc } = setup();
    await expect(
      svc.scan('uni1', { ...studentPrincipal, role: 'doctor' }, { payload: '{}' }),
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });
});

describe('AttendanceService.endSession', () => {
  it('enqueues an at-risk check after closing the session', async () => {
    const doctorPrincipal: AuthPrincipal = {
      userId: 'doc1',
      role: 'doctor',
      universityId: 'uni1',
      email: 'doc@x.com',
    };
    const session = {
      id: 's1',
      status: 'active',
      doctorId: 'doc1',
      scheduleSlot: { sectionId: 'sec1', universityId: 'uni1', doctorId: 'doc1' },
    };
    const { svc, atRiskQueue, prisma, gateway } = setup({ session });
    (prisma.attendanceSession as any).update = jest
      .fn()
      .mockResolvedValue({ ...session, status: 'closed' });
    (prisma.attendanceSession as any).findUniqueOrThrow = jest.fn().mockResolvedValue(session);

    await svc.endSession('uni1', doctorPrincipal, 's1');

    expect(prisma.attendanceSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } }),
    );
    expect(gateway.emitTimeout).toHaveBeenCalledWith('s1');
    expect(atRiskQueue.add).toHaveBeenCalledWith(
      'check-absences',
      { sessionId: 's1' },
      expect.objectContaining({ removeOnComplete: true }),
    );
  });
});
