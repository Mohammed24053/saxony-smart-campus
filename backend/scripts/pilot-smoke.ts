#!/usr/bin/env -S node --loader ts-node/esm
/**
 * Pilot integration smoke — exercises the critical doctor-home critical
 * path against a live backend.
 *
 *   1. Idempotently seeds a doctor + a student (enrolled in the same
 *      section) + subject + room + schedule-slot for *today* in the
 *      seeded university.
 *   2. Logs in as admin (verifies seeded admin still works).
 *   3. Logs in as the smoke doctor.
 *   4. GET /me                         → 200, role=doctor.
 *   5. GET /me/schedule/today          → 200, items contains the slot.
 *   6. POST /attendance/session/start  → 200, returns session + qr.
 *   7. GET  /attendance/session/:id/qr → 200, returns rotated qr.
 *   8. Logs in as the smoke student.
 *   9. POST /attendance/scan           → 200, status ∈ {present, late}.
 *  10. POST /attendance/session/:id/end → 200.
 *
 * Exits 0 on success, 1 on any failure (with the offending response
 * dumped to stderr so CI logs are actionable). Designed to run as a
 * CI step after `pnpm run seed` and before the Playwright smoke pack.
 *
 * Usage:
 *   API_URL=http://localhost:3000/api/v1 \
 *     pnpm --filter backend exec ts-node scripts/pilot-smoke.ts
 */

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL ?? 'admin@saxony-egypt.edu';
const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD ?? 'ChangeMe!2025';
const UNIVERSITY_SLUG = process.env.INITIAL_UNIVERSITY_SLUG ?? 'saxony-egypt';

const DOCTOR_EMAIL = process.env.SMOKE_DOCTOR_EMAIL ?? 'smoke.doctor@saxony-egypt.edu';
const DOCTOR_PASSWORD = process.env.SMOKE_DOCTOR_PASSWORD ?? 'SmokeDoctor!2025';
const STUDENT_EMAIL = process.env.SMOKE_STUDENT_EMAIL ?? 'smoke.student@saxony-egypt.edu';
const STUDENT_PASSWORD = process.env.SMOKE_STUDENT_PASSWORD ?? 'SmokeStudent!2025';

const prisma = new PrismaClient();

function fail(stage: string, info: unknown): never {
  console.error(`\nFAIL @ ${stage}`);
  console.error(JSON.stringify(info, null, 2));
  prisma.$disconnect().finally(() => process.exit(1));
  // unreachable — process.exit happens in finally
  throw new Error(stage);
}

async function http(
  method: 'GET' | 'POST',
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: API_URL.replace(/\/api\/v1$/, ''),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response — keep null */
  }
  return { status: res.status, body };
}

async function seedFixtures(): Promise<{
  slotId: string;
  roomLat: number;
  roomLng: number;
}> {
  const university = await prisma.university.findUnique({
    where: { slug: UNIVERSITY_SLUG },
  });
  if (!university) fail('seedFixtures.university', { slug: UNIVERSITY_SLUG });

  // Doctor user (idempotent).
  let doctorUser = await prisma.user.findUnique({
    where: { email: DOCTOR_EMAIL },
  });
  if (!doctorUser) {
    doctorUser = await prisma.user.create({
      data: {
        universityId: university!.id,
        role: UserRole.doctor,
        name: 'Pilot Smoke Doctor',
        email: DOCTOR_EMAIL,
        passwordHash: await bcrypt.hash(DOCTOR_PASSWORD, 12),
        isActive: true,
        doctor: { create: { doctorId: 'SMOKE-DOC-001' } },
      },
    });
  } else {
    const existingDoctor = await prisma.doctor.findUnique({
      where: { id: doctorUser.id },
    });
    if (!existingDoctor) {
      await prisma.doctor.create({
        data: { id: doctorUser.id, doctorId: 'SMOKE-DOC-001' },
      });
    }
  }

  // Section, subject, room (idempotent).
  let section = await prisma.section.findFirst({
    where: { universityId: university!.id, name: 'SMOKE-SEC' },
  });
  if (!section) {
    section = await prisma.section.create({
      data: {
        universityId: university!.id,
        name: 'SMOKE-SEC',
        faculty: 'Computer Science',
        year: 3,
      },
    });
  }

  const subject = (await prisma.subject.findUnique({
    where: { code: 'CS101' },
  }))!;
  const room = (await prisma.room.findFirst({
    where: { universityId: university!.id, name: 'Lecture Hall A' },
  }))!;

  // Student user enrolled in the smoke section (idempotent).
  let studentUser = await prisma.user.findUnique({
    where: { email: STUDENT_EMAIL },
  });
  if (!studentUser) {
    studentUser = await prisma.user.create({
      data: {
        universityId: university!.id,
        role: UserRole.student,
        name: 'Pilot Smoke Student',
        email: STUDENT_EMAIL,
        passwordHash: await bcrypt.hash(STUDENT_PASSWORD, 12),
        isActive: true,
        student: {
          create: {
            studentId: 'SMOKE-STU-001',
            sectionId: section.id,
            faculty: 'Computer Science',
            year: 3,
          },
        },
      },
    });
  } else {
    const existing = await prisma.student.findUnique({
      where: { id: studentUser.id },
    });
    if (!existing) {
      await prisma.student.create({
        data: {
          id: studentUser.id,
          studentId: 'SMOKE-STU-001',
          sectionId: section.id,
          faculty: 'Computer Science',
          year: 3,
        },
      });
    } else if (existing.sectionId !== section.id) {
      await prisma.student.update({
        where: { id: studentUser.id },
        data: { sectionId: section.id },
      });
    }
  }

  // Today's slot — overlapping the current minute so the doctor home's
  // "starting now" filter picks it up. dayOfWeek 0..6 with Sun=0.
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = '00';
  const endHh = String((now.getHours() + 1) % 24).padStart(2, '0');

  let slot = await prisma.scheduleSlot.findFirst({
    where: {
      universityId: university!.id,
      doctorId: doctorUser.id,
      subjectId: subject.id,
      sectionId: section.id,
      dayOfWeek,
    },
  });
  if (!slot) {
    slot = await prisma.scheduleSlot.create({
      data: {
        universityId: university!.id,
        doctorId: doctorUser.id,
        subjectId: subject.id,
        sectionId: section.id,
        roomId: room.id,
        dayOfWeek,
        startTime: `${hh}:${mm}`,
        endTime: `${endHh}:${mm}`,
        isActive: true,
      },
    });
  } else {
    slot = await prisma.scheduleSlot.update({
      where: { id: slot.id },
      data: { startTime: `${hh}:${mm}`, endTime: `${endHh}:${mm}` },
    });
  }

  // Close any sessions left active from a previous smoke run so /start
  // doesn't bounce with SESSION_ALREADY_ACTIVE. The service checks
  // status=active (not endedAt), so flip both.
  await prisma.attendanceSession.updateMany({
    where: { scheduleSlotId: slot.id, status: 'active' },
    data: { status: 'closed', endedAt: new Date() },
  });

  return {
    slotId: slot.id,
    roomLat: room.latitude!,
    roomLng: room.longitude!,
  };
}

async function login(email: string, password: string): Promise<string> {
  const res = await http('POST', '/auth/login', {
    body: { email, password },
  });
  if (res.status !== 200) fail(`login(${email})`, res);
  const token = res.body?.data?.accessToken;
  if (!token) fail(`login(${email}) no token`, res);
  return token as string;
}

async function main(): Promise<void> {
  console.log(`smoke: api=${API_URL} university=${UNIVERSITY_SLUG}`);
  const { slotId, roomLat, roomLng } = await seedFixtures();
  console.log(`smoke: fixtures ready (slot ${slotId})`);

  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('smoke: admin login OK');

  const doctorToken = await login(DOCTOR_EMAIL, DOCTOR_PASSWORD);
  console.log('smoke: doctor login OK');

  const me = await http('GET', '/me', { token: doctorToken });
  if (me.status !== 200 || me.body?.data?.role !== 'doctor') {
    fail('GET /me', me);
  }
  console.log('smoke: GET /me OK');

  const sched = await http('GET', '/me/schedule/today', {
    token: doctorToken,
  });
  if (sched.status !== 200) fail('GET /me/schedule/today', sched);
  const items: Array<{ id: string }> = Array.isArray(sched.body?.data?.items)
    ? sched.body.data.items
    : Array.isArray(sched.body?.data)
      ? sched.body.data
      : [];
  if (!items.some((s) => s.id === slotId)) {
    fail('GET /me/schedule/today (slot missing)', { wantSlotId: slotId, got: items });
  }
  console.log(`smoke: GET /me/schedule/today OK (${items.length} slots)`);

  const start = await http('POST', '/attendance/session/start', {
    token: doctorToken,
    body: { scheduleSlotId: slotId, intervalSeconds: 30 },
  });
  if (start.status !== 200 && start.status !== 201) {
    fail('POST /attendance/session/start', start);
  }
  const sessionId = start.body?.data?.id ?? start.body?.data?.session?.id;
  const startedQr = start.body?.data?.qrPayload ?? start.body?.data?.qr;
  if (!sessionId || !startedQr) fail('start: missing id/qrPayload', start);
  console.log(`smoke: POST /session/start OK (session ${sessionId})`);

  const qr = await http('GET', `/attendance/session/${sessionId}/qr`, {
    token: doctorToken,
  });
  if (qr.status !== 200) fail('GET /session/:id/qr', qr);
  // /qr returns { token, payload, expiresAt, refreshIn } directly.
  const rotatedQr = qr.body?.data?.payload ?? qr.body?.data?.qrPayload;
  if (!rotatedQr) fail('qr: missing payload', qr);
  console.log('smoke: GET /session/:id/qr OK');

  // ── Student scan leg ──
  const studentToken = await login(STUDENT_EMAIL, STUDENT_PASSWORD);
  console.log('smoke: student login OK');

  const scan = await http('POST', '/attendance/scan', {
    token: studentToken,
    body: {
      payload: rotatedQr,
      gpsLat: roomLat,
      gpsLng: roomLng,
      deviceFingerprint: 'smoke-device-fp-001',
    },
  });
  if (scan.status !== 200 && scan.status !== 201) {
    fail('POST /attendance/scan', scan);
  }
  const scanStatus = scan.body?.data?.status;
  if (scanStatus !== 'present' && scanStatus !== 'late') {
    fail('scan: unexpected status', scan);
  }
  console.log(`smoke: POST /attendance/scan OK (status=${scanStatus})`);

  const end = await http('POST', `/attendance/session/${sessionId}/end`, {
    token: doctorToken,
  });
  if (end.status !== 200 && end.status !== 201) {
    fail('POST /session/:id/end', end);
  }
  console.log('smoke: POST /session/:id/end OK');

  // Use the admin token at least once so a regression in admin auth
  // also tips the smoke red.
  const adminMe = await http('GET', '/me', { token: adminToken });
  if (adminMe.status !== 200 || adminMe.body?.data?.role !== 'admin') {
    fail('GET /me (admin)', adminMe);
  }

  console.log('\nsmoke: ALL OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
