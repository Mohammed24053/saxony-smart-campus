import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ScheduleSlot } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { CreateScheduleSlotDto, UpdateScheduleSlotDto } from './dto/schedule.dto';
import {
  AvailabilityMap,
  PlannerInputDoctor,
  PlannerInputRoom,
  PlannerInputSection,
  PlannerInputSubject,
  PlannerResult,
  planSchedule,
  toMin,
  toTime,
} from './schedule-generator';

export interface GenerateResult {
  slotsCreated: number;
  conflicts: PlannerResult['conflicts'];
}

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listFor(universityId: string): Promise<ScheduleSlot[]> {
    return this.prisma.scheduleSlot.findMany({
      where: { universityId, deletedAt: null, isActive: true },
      include: { subject: true, doctor: { include: { user: true } }, room: true, section: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async listForDoctor(universityId: string, doctorUserId: string): Promise<ScheduleSlot[]> {
    return this.prisma.scheduleSlot.findMany({
      where: { universityId, doctorId: doctorUserId, deletedAt: null, isActive: true },
      include: { subject: true, room: true, section: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async listForStudent(universityId: string, studentUserId: string): Promise<ScheduleSlot[]> {
    const student = await this.prisma.student.findUnique({ where: { id: studentUserId } });
    if (!student?.sectionId) return [];
    return this.prisma.scheduleSlot.findMany({
      where: { universityId, sectionId: student.sectionId, deletedAt: null, isActive: true },
      include: { subject: true, doctor: { include: { user: true } }, room: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Returns the slots scheduled for the given user *today* (server-local
   * day-of-week), ordered by start time. Used by the mobile doctor home
   * screen (`/me/schedule/today`) and the student dashboard.
   *
   * Doctors get all their own slots; students get all slots for their
   * section. Anyone else (admin, no section) gets an empty list.
   */
  async listTodayFor(
    universityId: string,
    userId: string,
    role: 'doctor' | 'student' | 'admin',
    now: Date = new Date(),
  ): Promise<ScheduleSlot[]> {
    const dayOfWeek = now.getDay(); // 0=Sun .. 6=Sat, matches schema comment
    const all =
      role === 'doctor'
        ? await this.listForDoctor(universityId, userId)
        : role === 'student'
          ? await this.listForStudent(universityId, userId)
          : [];
    return all
      .filter((s) => s.dayOfWeek === dayOfWeek)
      .sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));
  }

  async createSlot(universityId: string, dto: CreateScheduleSlotDto): Promise<ScheduleSlot> {
    await this.assertNoConflict(universityId, dto, undefined);
    return this.prisma.scheduleSlot.create({
      data: { universityId, ...dto, isActive: dto.isActive ?? true },
    });
  }

  async updateSlot(
    universityId: string,
    slotId: string,
    dto: UpdateScheduleSlotDto,
  ): Promise<ScheduleSlot> {
    const existing = await this.prisma.scheduleSlot.findFirst({
      where: { id: slotId, universityId, deletedAt: null },
    });
    if (!existing) throw new AppException(ErrorCodes.NOT_FOUND);
    const merged = { ...existing, ...dto } as CreateScheduleSlotDto;
    await this.assertNoConflict(universityId, merged, slotId);
    return this.prisma.scheduleSlot.update({ where: { id: slotId }, data: { ...dto } });
  }

  async deleteSlot(universityId: string, slotId: string): Promise<void> {
    const existing = await this.prisma.scheduleSlot.findFirst({
      where: { id: slotId, universityId, deletedAt: null },
    });
    if (!existing) throw new AppException(ErrorCodes.NOT_FOUND);
    await this.prisma.scheduleSlot.update({
      where: { id: slotId },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getConflicts(universityId: string): Promise<PlannerResult['conflicts']> {
    // Re-run the planner against current data and only return the conflicts.
    const r = await this.runPlanner(universityId);
    return r.conflicts;
  }

  async publish(universityId: string): Promise<{ published: number }> {
    const updated = await this.prisma.scheduleSlot.updateMany({
      where: { universityId, deletedAt: null },
      data: { isActive: true },
    });
    return { published: updated.count };
  }

  async generate(universityId: string): Promise<GenerateResult> {
    this.logger.log(`Generating schedule for ${universityId}`);
    const result = await this.runPlanner(universityId);

    // Wipe existing soft-active slots for this university and replace with the
    // freshly generated set. Anything previously soft-deleted stays as-is.
    await this.prisma.$transaction(async (tx) => {
      await tx.scheduleSlot.updateMany({
        where: { universityId, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });
      if (result.slots.length > 0) {
        await tx.scheduleSlot.createMany({
          data: result.slots.map((s) => ({
            universityId,
            subjectId: s.subjectId,
            doctorId: s.doctorId,
            roomId: s.roomId,
            sectionId: s.sectionId,
            dayOfWeek: s.dayOfWeek,
            startTime: toTime(s.startMin),
            endTime: toTime(s.endMin),
            isActive: true,
          })),
        });
      }
    });

    return { slotsCreated: result.slots.length, conflicts: result.conflicts };
  }

  // ────────────────────────────── helpers ──────────────────────────────

  private async runPlanner(universityId: string): Promise<PlannerResult> {
    const [subjects, sections, doctors, rooms] = await Promise.all([
      this.loadSubjects(universityId),
      this.loadSections(universityId),
      this.loadDoctors(universityId),
      this.loadRooms(universityId),
    ]);
    return planSchedule({ subjects, sections, doctors, rooms });
  }

  private async loadSubjects(universityId: string): Promise<PlannerInputSubject[]> {
    const list = await this.prisma.subject.findMany({
      where: { universityId, deletedAt: null },
    });
    return list.map((s) => ({
      id: s.id,
      hoursPerWeek: s.hoursPerWeek ?? 2,
      defaultDoctorId: s.defaultDoctorId ?? undefined,
      type: s.type,
      maxRoomCapacity: s.maxRoomCapacity ?? undefined,
    }));
  }

  private async loadSections(universityId: string): Promise<PlannerInputSection[]> {
    const list = await this.prisma.section.findMany({
      where: { universityId, deletedAt: null },
      include: {
        students: { where: { user: { is: { deletedAt: null, isActive: true } } } },
        subjects: { select: { subjectId: true } },
      },
    });
    return list.map((s) => ({
      id: s.id,
      studentCount: s.students.length || s.capacity || 30,
      subjectIds: s.subjects.map((j) => j.subjectId),
    }));
  }

  private async loadDoctors(universityId: string): Promise<PlannerInputDoctor[]> {
    const list = await this.prisma.user.findMany({
      where: { universityId, role: 'doctor', deletedAt: null, isActive: true },
      include: { doctor: true },
    });
    return list
      .filter((u) => Boolean(u.doctor))
      .map((u) => ({
        id: u.id,
        availability: parseAvailability(u.doctor!.availability),
      }));
  }

  private async loadRooms(universityId: string): Promise<PlannerInputRoom[]> {
    const list = await this.prisma.room.findMany({ where: { universityId, deletedAt: null } });
    return list.map((r) => ({ id: r.id, capacity: r.capacity, type: r.type }));
  }

  private async assertNoConflict(
    universityId: string,
    dto: CreateScheduleSlotDto,
    ignoreId: string | undefined,
  ): Promise<void> {
    const where: Prisma.ScheduleSlotWhereInput = {
      universityId,
      deletedAt: null,
      dayOfWeek: dto.dayOfWeek,
      OR: [{ doctorId: dto.doctorId }, { roomId: dto.roomId }, { sectionId: dto.sectionId }],
      ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
    };
    const others = await this.prisma.scheduleSlot.findMany({ where });
    const newStart = toMin(dto.startTime);
    const newEnd = toMin(dto.endTime);
    for (const o of others) {
      if (newStart < toMin(o.endTime) && toMin(o.startTime) < newEnd) {
        throw new AppException(ErrorCodes.SCHEDULE_CONFLICT, {
          message: 'Conflict on doctor, room, or section in this time window',
          details: { conflictWithSlotId: o.id },
        });
      }
    }
  }
}

function parseAvailability(raw: unknown): AvailabilityMap {
  // Accepts either { mon: ["09:00-12:00"] } or { 0: [{startMin, endMin}] }
  const out: AvailabilityMap = {};
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  const dayMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  for (const [k, v] of Object.entries(obj)) {
    let day: number | null = null;
    if (k in dayMap) day = dayMap[k];
    else if (/^\d+$/.test(k)) day = Number(k);
    if (day === null || day < 0 || day > 6) continue;
    if (!Array.isArray(v)) continue;
    out[day] = v
      .map((entry) => {
        if (typeof entry === 'string') {
          const [s, e] = entry.split('-');
          if (!s || !e) return null;
          return { startMin: toMin(s), endMin: toMin(e) };
        }
        return null;
      })
      .filter((x): x is { startMin: number; endMin: number } => x !== null);
  }
  return out;
}
