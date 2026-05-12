#!/usr/bin/env -S node --loader ts-node/esm
/**
 * k6 load-test data seeder.
 *
 * Idempotently creates the fixtures the k6 scan storm needs against
 * the seeded university:
 *
 *   - 1 "loadtest" doctor (loadtest.doctor@saxony-egypt.edu)
 *   - 1 section + 1 slot for today owned by that doctor (room = Lecture Hall A)
 *   - N students with email loadtest+1..N@saxony-egypt.edu / password
 *     LoadTest!2025, all enrolled in that section
 *
 * The output is a CSV at load/k6/data/students.csv that the k6 script
 * loads into a SharedArray.
 *
 * Usage:
 *   pnpm --filter backend exec ts-node ../load/k6/seed.ts --count 5000
 *   pnpm --filter backend exec ts-node ../load/k6/seed.ts --count 50 --dry-run
 */

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { argv, exit } from 'node:process';

const prisma = new PrismaClient();

function parseArgs(): { count: number; dryRun: boolean } {
  let count = 5000;
  let dryRun = false;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--count' && argv[i + 1]) {
      count = parseInt(argv[++i], 10);
    } else if (argv[i] === '--dry-run') {
      dryRun = true;
    }
  }
  if (!Number.isFinite(count) || count < 1 || count > 100000) {
    console.error('--count must be an integer in [1, 100000]');
    exit(2);
  }
  return { count, dryRun };
}

async function main(): Promise<void> {
  const { count, dryRun } = parseArgs();
  const universitySlug = process.env.INITIAL_UNIVERSITY_SLUG ?? 'saxony-egypt';
  const university = await prisma.university.findUnique({
    where: { slug: universitySlug },
  });
  if (!university) {
    console.error(`No university with slug ${universitySlug}. Run pnpm run seed first.`);
    exit(2);
  }

  // Doctor + section + slot + room.
  const doctorEmail = 'loadtest.doctor@saxony-egypt.edu';
  let doctorUser = await prisma.user.findUnique({
    where: { email: doctorEmail },
  });
  if (!doctorUser && !dryRun) {
    doctorUser = await prisma.user.create({
      data: {
        universityId: university.id,
        role: UserRole.doctor,
        name: 'Load Test Doctor',
        email: doctorEmail,
        passwordHash: await bcrypt.hash('LoadTest!2025', 10),
        isActive: true,
        doctor: { create: { doctorId: 'LOAD-DOC-001' } },
      },
    });
  }

  let section = await prisma.section.findFirst({
    where: { universityId: university.id, name: 'LOAD-SEC' },
  });
  if (!section && !dryRun) {
    section = await prisma.section.create({
      data: {
        universityId: university.id,
        name: 'LOAD-SEC',
        faculty: 'Computer Science',
        year: 3,
      },
    });
  }

  const subject = await prisma.subject.findUnique({ where: { code: 'CS101' } });
  const room = await prisma.room.findFirst({
    where: { universityId: university.id, name: 'Lecture Hall A' },
  });
  if (!subject || !room) {
    console.error('Seeded CS101 subject or Lecture Hall A room missing.');
    exit(2);
  }

  const now = new Date();
  let slot = section
    ? await prisma.scheduleSlot.findFirst({
        where: {
          universityId: university.id,
          sectionId: section.id,
          doctorId: doctorUser?.id ?? '',
        },
      })
    : null;
  if (!slot && doctorUser && section && !dryRun) {
    slot = await prisma.scheduleSlot.create({
      data: {
        universityId: university.id,
        doctorId: doctorUser.id,
        subjectId: subject.id,
        sectionId: section.id,
        roomId: room.id,
        dayOfWeek: now.getDay(),
        startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
        endTime: `${String((now.getHours() + 1) % 24).padStart(2, '0')}:00`,
        isActive: true,
      },
    });
  }

  // Students. Hash once and reuse — bcrypt(10) is ~50ms each, so for
  // 5 000 students that's still ~4 min. Use bcrypt(8) for the load
  // test only (LoadTest password isn't a security concern in a test env).
  const passwordHash = await bcrypt.hash('LoadTest!2025', 8);
  const existing = new Set(
    (
      await prisma.user.findMany({
        where: {
          universityId: university.id,
          email: { startsWith: 'loadtest+' },
        },
        select: { email: true },
      })
    ).map((u) => u.email),
  );

  let created = 0;
  for (let i = 1; i <= count; i++) {
    const email = `loadtest+${i}@saxony-egypt.edu`;
    if (existing.has(email)) continue;
    if (dryRun) {
      created++;
      continue;
    }
    await prisma.user.create({
      data: {
        universityId: university.id,
        role: UserRole.student,
        name: `Load Test Student ${i}`,
        email,
        passwordHash,
        isActive: true,
        student: {
          create: {
            studentId: `LOAD-STU-${i}`,
            sectionId: section!.id,
            faculty: 'Computer Science',
            year: 3,
          },
        },
      },
    });
    created++;
    if (created % 500 === 0) {
      console.log(`  ${created}/${count} students created…`);
    }
  }

  // Write the CSV the k6 SharedArray reads.
  const csvPath = resolve(__dirname, '..', '..', 'load', 'k6', 'data', 'students.csv');
  mkdirSync(dirname(csvPath), { recursive: true });
  const rows: string[] = ['email,password,studentId'];
  for (let i = 1; i <= count; i++) {
    rows.push(`loadtest+${i}@saxony-egypt.edu,LoadTest!2025,LOAD-STU-${i}`);
  }
  if (!dryRun) writeFileSync(csvPath, rows.join('\n') + '\n');

  console.log(
    `\nseed done. doctor=${doctorEmail} slot=${slot?.id} students=${count} created=${created} dryRun=${dryRun}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  exit(1);
});
