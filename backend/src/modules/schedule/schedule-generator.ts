/**
 * Pure functions used by ScheduleService.generate(). Kept side-effect-free so
 * they can be unit-tested without a database.
 */

export interface AvailabilityWindow {
  startMin: number;
  endMin: number;
}

export interface AvailabilityMap {
  /** Indexed 0=Sun … 6=Sat */
  [dayOfWeek: number]: AvailabilityWindow[];
}

export interface PlannerSlot {
  subjectId: string;
  sectionId: string;
  doctorId: string;
  roomId: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

export interface PlannerInputSubject {
  id: string;
  hoursPerWeek: number;
  defaultDoctorId?: string;
  type: 'theory' | 'practical' | 'mixed';
  maxRoomCapacity?: number;
}

export interface PlannerInputSection {
  id: string;
  studentCount: number;
  subjectIds: string[];
}

export interface PlannerInputDoctor {
  id: string;
  availability: AvailabilityMap;
}

export interface PlannerInputRoom {
  id: string;
  capacity: number;
  type: 'lecture' | 'lab' | 'hall';
}

export interface PlannerConflict {
  subjectId: string;
  sectionId: string;
  reason: 'NO_AVAILABLE_SLOT' | 'NO_ROOM' | 'NO_DOCTOR';
  suggestion?: string;
}

export interface PlannerResult {
  slots: PlannerSlot[];
  conflicts: PlannerConflict[];
}

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const SLOT_MINUTES = 60;
const DAY_START = 8 * 60;
const DAY_END = 18 * 60;

export function toMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function toTime(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function isInsideAvailability(
  availability: AvailabilityMap,
  day: number,
  start: number,
  end: number,
): boolean {
  // Empty map → no constraint, doctor is available all the time.
  if (Object.keys(availability).length === 0) return true;
  const windows = availability[day];
  if (!windows || windows.length === 0) return false;
  return windows.some((w) => start >= w.startMin && end <= w.endMin);
}

function pickRoom(
  needed: number,
  rooms: PlannerInputRoom[],
  taken: PlannerSlot[],
  day: number,
  start: number,
  end: number,
  preferType?: 'lecture' | 'lab' | 'hall',
): PlannerInputRoom | null {
  const ordered = rooms.slice().sort((a, b) => {
    if (preferType) {
      if (a.type === preferType && b.type !== preferType) return -1;
      if (b.type === preferType && a.type !== preferType) return 1;
    }
    return a.capacity - b.capacity;
  });
  for (const r of ordered) {
    if (r.capacity < needed) continue;
    const clash = taken.some(
      (s) => s.roomId === r.id && s.dayOfWeek === day && overlaps(s.startMin, s.endMin, start, end),
    );
    if (!clash) return r;
  }
  return null;
}

function isDoctorFree(
  doctorId: string,
  taken: PlannerSlot[],
  day: number,
  start: number,
  end: number,
): boolean {
  return !taken.some(
    (s) => s.doctorId === doctorId && s.dayOfWeek === day && overlaps(s.startMin, s.endMin, start, end),
  );
}

function isSectionFree(
  sectionId: string,
  taken: PlannerSlot[],
  day: number,
  start: number,
  end: number,
): boolean {
  return !taken.some(
    (s) => s.sectionId === sectionId && s.dayOfWeek === day && overlaps(s.startMin, s.endMin, start, end),
  );
}

export function planSchedule(input: {
  subjects: PlannerInputSubject[];
  sections: PlannerInputSection[];
  doctors: PlannerInputDoctor[];
  rooms: PlannerInputRoom[];
}): PlannerResult {
  const slots: PlannerSlot[] = [];
  const conflicts: PlannerConflict[] = [];
  const subjectsById = new Map(input.subjects.map((s) => [s.id, s]));
  const doctorsById = new Map(input.doctors.map((d) => [d.id, d]));

  for (const section of input.sections) {
    for (const subjectId of section.subjectIds) {
      const subject = subjectsById.get(subjectId);
      if (!subject) {
        conflicts.push({ subjectId, sectionId: section.id, reason: 'NO_DOCTOR' });
        continue;
      }
      const doctor = subject.defaultDoctorId
        ? doctorsById.get(subject.defaultDoctorId)
        : undefined;
      if (!doctor) {
        conflicts.push({ subjectId, sectionId: section.id, reason: 'NO_DOCTOR' });
        continue;
      }

      const requiredHours = subject.hoursPerWeek ?? 2;
      let placed = 0;
      const preferType =
        subject.type === 'practical' ? 'lab' : subject.type === 'theory' ? 'lecture' : undefined;

      outer: for (const day of DAYS) {
        for (let start = DAY_START; start + SLOT_MINUTES <= DAY_END; start += SLOT_MINUTES) {
          const end = start + SLOT_MINUTES;
          if (!isInsideAvailability(doctor.availability, day, start, end)) continue;
          if (!isDoctorFree(doctor.id, slots, day, start, end)) continue;
          if (!isSectionFree(section.id, slots, day, start, end)) continue;
          const room = pickRoom(section.studentCount, input.rooms, slots, day, start, end, preferType);
          if (!room) continue;
          slots.push({
            subjectId,
            sectionId: section.id,
            doctorId: doctor.id,
            roomId: room.id,
            dayOfWeek: day,
            startMin: start,
            endMin: end,
          });
          placed += 1;
          if (placed >= requiredHours) break outer;
        }
      }

      if (placed === 0) {
        conflicts.push({
          subjectId,
          sectionId: section.id,
          reason: 'NO_AVAILABLE_SLOT',
          suggestion: 'Increase doctor availability or add more rooms.',
        });
      } else if (placed < requiredHours) {
        conflicts.push({
          subjectId,
          sectionId: section.id,
          reason: 'NO_AVAILABLE_SLOT',
          suggestion: `Only ${placed}/${requiredHours} sessions could be placed.`,
        });
      }
    }
  }

  return { slots, conflicts };
}
