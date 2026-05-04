import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  SessionStatus,
} from '@prisma/client';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { AuthPrincipal } from '../../common/decorators/current-user.decorator';
import { GpsService } from './gps.service';
import { QrTokenService } from './qr-token.service';
import { AttendanceGateway } from './attendance.gateway';
import { ScanQrDto, StartSessionDto } from './dto/attendance.dto';

export interface ScanResult {
  status: AttendanceStatus;
  recordId: string;
  message: string;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly qr: QrTokenService,
    private readonly gps: GpsService,
    private readonly gateway: AttendanceGateway,
    @InjectQueue('at-risk') private readonly atRiskQueue: Queue,
  ) {}

  async startSession(
    universityId: string,
    doctor: AuthPrincipal,
    dto: StartSessionDto,
  ): Promise<{ session: AttendanceSession; qrPayload: string; expiresAt: Date }> {
    const slot = await this.prisma.scheduleSlot.findFirst({
      where: { id: dto.scheduleSlotId, universityId, deletedAt: null, isActive: true },
      include: { room: true, subject: true, section: true },
    });
    if (!slot) throw new AppException(ErrorCodes.NOT_FOUND);
    if (slot.doctorId !== doctor.userId) throw new AppException(ErrorCodes.FORBIDDEN);

    const existing = await this.prisma.attendanceSession.findFirst({
      where: { scheduleSlotId: slot.id, status: SessionStatus.active },
    });
    if (existing) throw new AppException(ErrorCodes.SESSION_ALREADY_ACTIVE);

    const session = await this.prisma.attendanceSession.create({
      data: { scheduleSlotId: slot.id, doctorId: doctor.userId, status: SessionStatus.active },
    });
    const { token, payload, expiresAt } = this.qr.buildPayload({
      sessionId: session.id,
      roomId: slot.roomId,
      courseId: slot.subjectId,
      intervalSeconds: dto.intervalSeconds,
    });
    await this.prisma.qrCode.create({
      data: { sessionId: session.id, token, expiresAt },
    });
    await this.redis.setex(
      `qr:session:${session.id}:current`,
      Math.max(15, dto.intervalSeconds ?? 30),
      token,
    );
    return { session, qrPayload: payload, expiresAt };
  }

  async getCurrentQr(
    universityId: string,
    doctor: AuthPrincipal,
    sessionId: string,
    intervalSeconds = 30,
  ): Promise<{ token: string; payload: string; expiresAt: Date; refreshIn: number }> {
    const session = await this.requireDoctorSession(universityId, doctor, sessionId, true);
    const slot = await this.prisma.scheduleSlot.findUniqueOrThrow({
      where: { id: session.scheduleSlotId },
    });
    const { token, payload, expiresAt } = this.qr.buildPayload({
      sessionId: session.id,
      roomId: slot.roomId,
      courseId: slot.subjectId,
      intervalSeconds,
    });
    await this.prisma.qrCode.create({ data: { sessionId, token, expiresAt } });
    await this.redis.setex(`qr:session:${sessionId}:current`, intervalSeconds, token);
    this.gateway.emitQrRefresh(sessionId, token, expiresAt);
    return {
      token,
      payload,
      expiresAt,
      refreshIn: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    };
  }

  async endSession(
    universityId: string,
    doctor: AuthPrincipal,
    sessionId: string,
  ): Promise<AttendanceSession> {
    const session = await this.requireDoctorSession(universityId, doctor, sessionId, true);
    const closed = await this.prisma.attendanceSession.update({
      where: { id: session.id },
      data: { status: SessionStatus.closed, endedAt: new Date() },
    });
    await this.markAbsentees(session.id);
    this.gateway.emitTimeout(session.id);
    try {
      await this.atRiskQueue.add(
        'check-absences',
        { sessionId: session.id },
        { removeOnComplete: true, removeOnFail: true },
      );
    } catch (e) {
      this.logger.warn(
        `Failed to enqueue at-risk check for session ${session.id}: ${(e as Error).message}`,
      );
    }
    return closed;
  }

  /**
   * The 5-step verification chain from the spec:
   *   1) QR validity & expiration
   *   2) Section enrollment
   *   3) Session is active
   *   4) GPS within radius (when enabled for the room)
   *   5) Idempotency (Redis) — student can't scan twice
   *
   * Then writes the AttendanceRecord, emits a WebSocket event, returns the
   * resolved status (present | late).
   */
  async scan(
    universityId: string,
    student: AuthPrincipal,
    dto: ScanQrDto,
  ): Promise<ScanResult> {
    if (student.role !== 'student') throw new AppException(ErrorCodes.FORBIDDEN);

    // Per-device rate limit: 5 scans / 30s.
    if (dto.deviceFingerprint) {
      const ok = await this.redis.rateLimit(`rate:scan:${dto.deviceFingerprint}`, 5, 30);
      if (!ok) throw new AppException(ErrorCodes.RATE_LIMITED);
    }

    // ── Step 1: validate QR token
    const parsed = this.parseScanInputs(dto);
    const verified = this.qr.verify(parsed);
    if (!verified) {
      // Was the session ever issued this token? If yes → expired, else invalid.
      const existed = await this.prisma.qrCode.findFirst({
        where: { sessionId: parsed.sessionId, token: parsed.token },
      });
      throw new AppException(existed ? ErrorCodes.QR_EXPIRED : ErrorCodes.QR_INVALID);
    }

    // ── Step 2: load session + check status + check enrollment
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: verified.sessionId },
      include: {
        scheduleSlot: { include: { section: true, room: true, subject: true } },
      },
    });
    if (!session) throw new AppException(ErrorCodes.SESSION_NOT_FOUND);
    if (session.status !== SessionStatus.active) throw new AppException(ErrorCodes.SESSION_CLOSED);

    const enrolled = await this.prisma.student.findUnique({ where: { id: student.userId } });
    if (!enrolled || enrolled.sectionId !== session.scheduleSlot.sectionId) {
      throw new AppException(ErrorCodes.NOT_ENROLLED);
    }

    // ── Step 3 (already done above) — session active

    // ── Step 4: GPS verification (if room has GPS enabled)
    const room = session.scheduleSlot.room;
    let gpsDistance: number | undefined;
    if (room.gpsEnabled && room.latitude !== null && room.longitude !== null) {
      if (dto.gpsLat === undefined || dto.gpsLng === undefined) {
        throw new AppException(ErrorCodes.GPS_UNAVAILABLE);
      }
      gpsDistance = Math.round(
        this.gps.distance(dto.gpsLat, dto.gpsLng, room.latitude, room.longitude),
      );
      if (gpsDistance > room.gpsRadius) {
        throw new AppException(ErrorCodes.GPS_OUT_OF_RANGE, {
          details: { distance: gpsDistance, radius: room.gpsRadius },
        });
      }
    }

    // ── Step 5: idempotency / duplicate prevention.
    // Use an atomic SET … NX EX so two concurrent scans for the same
    // (session, student) can't both pass the check. The previous GET-then-SETEX
    // pair had a race window where two requests interleaved between the GET
    // (both saw "no key") and the SETEX (both wrote, both passed).
    const idemKey = `attendance:${session.id}:${student.userId}`;
    const claimed = await this.redis.setNxEx(idemKey, '1', 86_400);
    if (claimed !== 'OK') throw new AppException(ErrorCodes.ALREADY_REGISTERED);

    // Determine status (present vs late) based on lateAfterMinutes.
    const lateThresholdMs = session.lateAfterMinutes * 60_000;
    const isLate = Date.now() - session.startedAt.getTime() > lateThresholdMs;
    const status = isLate ? AttendanceStatus.late : AttendanceStatus.present;

    const record = await this.prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.userId } },
      create: {
        sessionId: session.id,
        studentId: student.userId,
        status,
        scannedAt: new Date(),
        gpsLat: dto.gpsLat,
        gpsLng: dto.gpsLng,
        gpsDistance,
        deviceFingerprint: dto.deviceFingerprint,
      },
      update: {},
    });

    // Realtime fan-out
    const studentUser = await this.prisma.user.findUnique({ where: { id: student.userId } });
    this.gateway.emitAttendance(session.id, {
      studentId: student.userId,
      studentName: studentUser?.name ?? 'Student',
      status,
      scannedAt: new Date().toISOString(),
    });
    const counts = await this.computeCounts(session.id);
    this.gateway.emitCount(session.id, counts);

    return {
      recordId: record.id,
      status,
      message: status === AttendanceStatus.late ? 'Marked late' : 'Marked present',
    };
  }

  async live(
    universityId: string,
    doctor: AuthPrincipal,
    sessionId: string,
  ): Promise<{ session: AttendanceSession; counts: { present: number; late: number; absent: number; total: number }; records: AttendanceRecord[] }> {
    const session = await this.requireDoctorSession(universityId, doctor, sessionId, false);
    const counts = await this.computeCounts(sessionId);
    const records = await this.prisma.attendanceRecord.findMany({
      where: { sessionId },
      include: { student: { include: { user: true } } },
    });
    return { session, counts, records };
  }

  async manualOverride(
    universityId: string,
    doctor: AuthPrincipal,
    recordId: string,
    status: AttendanceStatus,
    reason?: string,
  ): Promise<AttendanceRecord> {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: { session: true },
    });
    if (!record) throw new AppException(ErrorCodes.NOT_FOUND);
    await this.requireDoctorSession(universityId, doctor, record.sessionId, true);
    return this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { status, isManual: true, manualReason: reason ?? null },
    });
  }

  async studentHistory(
    universityId: string,
    studentUserId: string,
  ): Promise<AttendanceRecord[]> {
    // Confirm the student belongs to this tenant.
    const u = await this.prisma.user.findFirst({
      where: { id: studentUserId, universityId, role: 'student' },
    });
    if (!u) throw new AppException(ErrorCodes.NOT_FOUND);
    return this.prisma.attendanceRecord.findMany({
      where: { studentId: studentUserId },
      include: { session: { include: { scheduleSlot: { include: { subject: true, room: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async sessionReport(
    universityId: string,
    doctor: AuthPrincipal,
    sessionId: string,
  ): Promise<unknown> {
    const session = await this.requireDoctorSession(universityId, doctor, sessionId, false);
    const records = await this.prisma.attendanceRecord.findMany({
      where: { sessionId: session.id },
      include: { student: { include: { user: true } } },
    });
    const counts = await this.computeCounts(sessionId);
    return { session, counts, records };
  }

  // ────────────────────────── helpers ──────────────────────────

  private parseScanInputs(dto: ScanQrDto): {
    sessionId: string;
    roomId: string;
    courseId: string;
    intervalSeconds: number;
    token: string;
  } {
    if (dto.payload) {
      try {
        return this.qr.parsePayload(dto.payload);
      } catch {
        throw new AppException(ErrorCodes.QR_INVALID);
      }
    }
    if (!dto.token || !dto.sessionId) throw new AppException(ErrorCodes.QR_INVALID);
    // When the client only provides the token, we must lookup the QR row to
    // recover the room/course. This is slower but supports legacy payloads.
    throw new AppException(ErrorCodes.QR_INVALID, {
      message: 'QR payload required (token-only scans not supported)',
    });
  }

  private async requireDoctorSession(
    universityId: string,
    doctor: AuthPrincipal,
    sessionId: string,
    requireActive: boolean,
  ): Promise<AttendanceSession> {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { scheduleSlot: true },
    });
    if (!session) throw new AppException(ErrorCodes.SESSION_NOT_FOUND);
    if (session.scheduleSlot.universityId !== universityId) {
      throw new AppException(ErrorCodes.NOT_FOUND);
    }
    if (session.doctorId !== doctor.userId && doctor.role !== 'admin') {
      throw new AppException(ErrorCodes.FORBIDDEN);
    }
    if (requireActive && session.status !== SessionStatus.active) {
      throw new AppException(ErrorCodes.SESSION_NOT_ACTIVE);
    }
    return session;
  }

  private async computeCounts(sessionId: string): Promise<{
    present: number;
    late: number;
    absent: number;
    total: number;
  }> {
    const session = await this.prisma.attendanceSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { scheduleSlot: true },
    });
    const totalStudents = await this.prisma.student.count({
      where: { sectionId: session.scheduleSlot.sectionId },
    });
    const records = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { sessionId },
      _count: { _all: true },
    });
    const counts = { present: 0, late: 0, absent: 0, total: totalStudents };
    for (const r of records) {
      if (r.status === AttendanceStatus.present) counts.present = r._count._all;
      else if (r.status === AttendanceStatus.late) counts.late = r._count._all;
      else if (r.status === AttendanceStatus.absent) counts.absent = r._count._all;
    }
    return counts;
  }

  private async markAbsentees(sessionId: string): Promise<void> {
    const session = await this.prisma.attendanceSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { scheduleSlot: true },
    });
    const students = await this.prisma.student.findMany({
      where: { sectionId: session.scheduleSlot.sectionId },
    });
    if (students.length === 0) return;
    const existing = await this.prisma.attendanceRecord.findMany({
      where: { sessionId },
      select: { studentId: true },
    });
    const have = new Set(existing.map((e) => e.studentId));
    const missing = students.filter((s) => !have.has(s.id));
    if (missing.length === 0) return;
    await this.prisma.attendanceRecord.createMany({
      data: missing.map((s) => ({
        sessionId,
        studentId: s.id,
        status: AttendanceStatus.absent,
      })),
      skipDuplicates: true,
    });
  }
}
