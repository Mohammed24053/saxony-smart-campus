#!/usr/bin/env -S node --loader ts-node/esm
/**
 * Pilot-data teardown — wipe all *non-admin* tenant data so the
 * faculty can dress-rehearse the pilot multiple times against the same
 * DB without dragging old sessions, attendance, or imported students
 * forward.
 *
 * Deletes (in safe order):
 *   - AttendanceRecord
 *   - QrCode
 *   - AttendanceSession
 *   - LeaveRequest
 *   - AtRiskRecord
 *   - Student
 *   - Doctor
 *   - User WHERE role <> 'admin'
 *   - ScheduleSlot
 *   - Section (except the seeded demo if any)
 *
 * Preserves:
 *   - University, Room, Subject (so the catalogue stays seeded).
 *   - The seeded super-admin user.
 *
 * Safety:
 *   - Refuses to run if NODE_ENV=production unless --force is passed.
 *   - --dry-run prints counts and exits.
 *
 * Usage (run from repo root):
 *   pnpm --filter backend exec ts-node scripts/pilot-reset.ts --dry-run
 *   pnpm --filter backend exec ts-node scripts/pilot-reset.ts
 */

import { PrismaClient } from '@prisma/client';
import { argv, exit, env } from 'node:process';

const prisma = new PrismaClient();

interface Args {
  dryRun: boolean;
  force: boolean;
}

function parseArgs(): Args {
  const args: Args = { dryRun: false, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: ts-node scripts/pilot-reset.ts [--dry-run] [--force]');
      exit(0);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (env.NODE_ENV === 'production' && !args.force) {
    console.error(
      'refusing to run in NODE_ENV=production without --force. ' +
        'This script will wipe every non-admin user.',
    );
    exit(2);
  }

  const counts = {
    attendanceRecord: await prisma.attendanceRecord.count(),
    qrCode: await prisma.qrCode.count(),
    attendanceSession: await prisma.attendanceSession.count(),
    leaveRequest: await prisma.leaveRequest.count(),
    atRiskRecord: await prisma.atRiskRecord.count(),
    scheduleSlot: await prisma.scheduleSlot.count(),
    student: await prisma.student.count(),
    doctor: await prisma.doctor.count(),
    nonAdminUsers: await prisma.user.count({
      where: { role: { not: 'admin' } },
    }),
    section: await prisma.section.count(),
  };

  console.log('counts before reset:');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(20)} ${v}`);
  }

  if (args.dryRun) {
    console.log('\n--dry-run: no rows deleted.');
    await prisma.$disconnect();
    return;
  }

  // Order matters: child rows first.
  await prisma.attendanceRecord.deleteMany({});
  await prisma.qrCode.deleteMany({});
  await prisma.attendanceSession.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.atRiskRecord.deleteMany({});
  await prisma.scheduleSlot.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.doctor.deleteMany({});
  await prisma.user.deleteMany({ where: { role: { not: 'admin' } } });
  await prisma.section.deleteMany({});

  console.log('\nreset complete.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  exit(1);
});
