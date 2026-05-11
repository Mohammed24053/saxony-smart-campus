import { Injectable } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const DASHBOARD_CACHE_TTL_S = 30;
const CHART_CACHE_TTL_S = 120;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Read-through Redis cache. Expensive aggregate queries (counts across
   * thousands of attendance records) are cached for a short window so the
   * dashboard remains snappy even when many tabs are open.
   */
  private async cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        // Fallthrough to recompute on JSON parse failure.
      }
    }
    const value = await compute();
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // Cache write failures must never break the request.
    }
    return value;
  }

  async dashboard(universityId: string) {
    return this.cached(`analytics:dashboard:${universityId}`, DASHBOARD_CACHE_TTL_S, () =>
      this.computeDashboard(universityId),
    );
  }

  private async computeDashboard(universityId: string) {
    const [studentCount, doctorCount, sectionCount, roomCount, atRiskOpen, sessionsToday] =
      await this.prisma.$transaction([
        this.prisma.user.count({
          where: { universityId, role: 'student', deletedAt: null, isActive: true },
        }),
        this.prisma.user.count({
          where: { universityId, role: 'doctor', deletedAt: null, isActive: true },
        }),
        this.prisma.section.count({ where: { universityId, deletedAt: null } }),
        this.prisma.room.count({ where: { universityId, deletedAt: null } }),
        this.prisma.atRiskRecord.count({
          where: { isResolved: false, student: { user: { is: { universityId } } } },
        }),
        this.prisma.attendanceSession.count({
          where: {
            scheduleSlot: { universityId },
            startedAt: { gte: startOfDay() },
          },
        }),
      ]);

    const presentToday = await this.prisma.attendanceRecord.count({
      where: {
        status: AttendanceStatus.present,
        createdAt: { gte: startOfDay() },
        session: { scheduleSlot: { universityId } },
      },
    });

    return {
      students: studentCount,
      doctors: doctorCount,
      sections: sectionCount,
      rooms: roomCount,
      atRiskOpen,
      sessionsToday,
      presentToday,
    };
  }

  async attendanceChart(universityId: string, days = 14) {
    return this.cached(`analytics:chart:${universityId}:${days}`, CHART_CACHE_TTL_S, () =>
      this.computeAttendanceChart(universityId, days),
    );
  }

  private async computeAttendanceChart(universityId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        createdAt: { gte: since },
        session: { scheduleSlot: { universityId } },
      },
      select: { status: true, createdAt: true },
    });
    const buckets: Record<string, { date: string; present: number; late: number; absent: number }> =
      {};
    for (const r of records) {
      const day = r.createdAt.toISOString().slice(0, 10);
      buckets[day] ??= { date: day, present: 0, late: 0, absent: 0 };
      if (r.status === AttendanceStatus.present) buckets[day].present++;
      else if (r.status === AttendanceStatus.late) buckets[day].late++;
      else if (r.status === AttendanceStatus.absent) buckets[day].absent++;
    }
    return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
  }

  async roomUtilization(universityId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { universityId, deletedAt: null },
      include: { _count: { select: { scheduleSlots: true } } },
    });
    return rooms.map((r) => ({
      roomId: r.id,
      name: r.name,
      capacity: r.capacity,
      slotsPerWeek: r._count.scheduleSlots,
    }));
  }

  async doctorPerformance(universityId: string) {
    const doctors = await this.prisma.user.findMany({
      where: { universityId, role: 'doctor', deletedAt: null, isActive: true },
      include: {
        doctor: {
          include: {
            scheduleSlots: { where: { deletedAt: null, isActive: true } },
            sessions: true,
          },
        },
      },
    });
    return doctors.map((d) => ({
      doctorId: d.id,
      name: d.name,
      slots: d.doctor?.scheduleSlots.length ?? 0,
      sessionsHeld: d.doctor?.sessions.length ?? 0,
    }));
  }

  async weeklyAtRisk(universityId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const grouped = await this.prisma.atRiskRecord.groupBy({
      by: ['warningLevel'],
      where: {
        triggeredAt: { gte: since },
        student: { user: { is: { universityId } } },
      },
      _count: { _all: true },
    });
    return grouped.map((g) => ({ level: g.warningLevel, count: g._count._all }));
  }
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
