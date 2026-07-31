import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Per-session attendance report (rows = students). */
  async sessionReport(universityId: string, sessionId: string) {
    const session = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, scheduleSlot: { universityId } },
      include: {
        scheduleSlot: {
          include: {
            subject: true,
            room: true,
            section: true,
            doctor: { include: { user: true } },
          },
        },
        records: { include: { student: { include: { user: true } } } },
      },
    });
    if (!session) throw new AppException(ErrorCodes.SESSION_NOT_FOUND);
    return {
      session: {
        id: session.id,
        subject: session.scheduleSlot.subject.name,
        subjectCode: session.scheduleSlot.subject.code,
        section: session.scheduleSlot.section.name,
        room: session.scheduleSlot.room.name,
        doctor: session.scheduleSlot.doctor.user.name,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        presentCount: session.presentCount,
        lateCount: session.lateCount,
        absentCount: session.absentCount,
      },
      records: session.records.map((r) => ({
        studentId: r.student.user.id,
        name: r.student.user.name,
        externalId: r.student.studentId,
        status: r.status,
        scannedAt: r.scannedAt,
        gpsDistance: r.gpsDistance,
        isManual: r.isManual,
        manualReason: r.manualReason,
      })),
    };
  }

  /** Per-subject roll-up: average attendance %, present/late/absent totals. */
  async subjectReport(universityId: string, subjectId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, universityId, deletedAt: null },
    });
    if (!subject) throw new AppException(ErrorCodes.NOT_FOUND);
    const sessions = await this.prisma.attendanceSession.findMany({
      where: { scheduleSlot: { subjectId, universityId } },
      include: { records: true, scheduleSlot: { include: { section: true } } },
    });
    const totals = sessions.reduce(
      (acc, s) => {
        acc.present += s.presentCount;
        acc.late += s.lateCount;
        acc.absent += s.absentCount;
        return acc;
      },
      { present: 0, late: 0, absent: 0 },
    );
    const denom = totals.present + totals.late + totals.absent;
    return {
      subject: { id: subject.id, code: subject.code, name: subject.name },
      sessionCount: sessions.length,
      totals,
      attendanceRate:
        denom > 0 ? Math.round(((totals.present + totals.late) / denom) * 1000) / 10 : 0,
      sessions: sessions.map((s) => ({
        id: s.id,
        section: s.scheduleSlot.section.name,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        presentCount: s.presentCount,
        lateCount: s.lateCount,
        absentCount: s.absentCount,
      })),
    };
  }

  toCsvSession(report: Awaited<ReturnType<ReportsService['sessionReport']>>): string {
    const header = [
      'studentId',
      'name',
      'externalId',
      'status',
      'scannedAt',
      'gpsDistance',
      'isManual',
      'manualReason',
    ];
    const rows = report.records.map((r) =>
      [
        r.studentId,
        csvEscape(r.name),
        r.externalId,
        r.status,
        r.scannedAt?.toISOString() ?? '',
        r.gpsDistance ?? '',
        r.isManual,
        csvEscape(r.manualReason ?? ''),
      ].join(','),
    );
    return [header.join(','), ...rows].join('\n');
  }

  toCsvSubject(report: Awaited<ReturnType<ReportsService['subjectReport']>>): string {
    const header = ['sessionId', 'section', 'startedAt', 'endedAt', 'present', 'late', 'absent'];
    const rows = report.sessions.map((s) =>
      [
        s.id,
        csvEscape(s.section),
        s.startedAt.toISOString(),
        s.endedAt?.toISOString() ?? '',
        s.presentCount,
        s.lateCount,
        s.absentCount,
      ].join(','),
    );
    return [header.join(','), ...rows].join('\n');
  }
}

/**
 * Escapes a value for inclusion in a CSV cell.
 *
 * Beyond the standard quote/comma/newline handling, this neutralises the
 * spreadsheet-formula injection vector (CWE-1236): when a cell begins with
 * `= + - @ \t \r` Excel, LibreOffice and Google Sheets treat the cell as a
 * formula and will evaluate `=HYPERLINK(...)`, `=cmd|...`, etc. on import.
 * Prefixing a single quote forces text mode in every major spreadsheet app.
 */
export function csvEscape(s: string): string {
  const v = s ?? '';
  const needsFormulaGuard = v.length > 0 && /^[=+\-@\t\r]/.test(v);
  const guarded = needsFormulaGuard ? `'${v}` : v;
  if (/[",\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}
