#!/usr/bin/env -S node --loader ts-node/esm
/**
 * Pilot SIS-import script — student CSV → User + Student rows.
 *
 * Used on day one of the design-partner pilot when the faculty hands us
 * a CSV export from their existing Student Information System. The CSV
 * must have a header row with at least these columns (any order):
 *
 *   email,studentId,name,sectionName,faculty,year
 *
 * Optional columns:
 *
 *   phone,password
 *
 * If `password` is absent we generate one as `studentId + "!2025"` (the
 * pilot agreement requires students to reset on first login anyway).
 *
 * Behaviour:
 *   - Upserts the university implicitly (matches the seeded
 *     INITIAL_UNIVERSITY_SLUG; pass --university to override).
 *   - Resolves section by name within the university; auto-creates it
 *     if missing so the SIS import can run before sections are wired.
 *   - Idempotent: re-running with the same CSV is safe — emails are
 *     unique, studentIds are unique, repeated runs no-op.
 *   - Dry-run mode prints what would happen without writing.
 *
 * Usage:
 *   pnpm --filter backend exec ts-node scripts/sis-import.ts \
 *     --file /path/to/students.csv \
 *     [--university saxony-egypt] [--dry-run]
 */

import { readFileSync } from 'node:fs';
import { argv, exit } from 'node:process';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

interface Args {
  file: string;
  university: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args: Args = {
    file: '',
    university: process.env.INITIAL_UNIVERSITY_SLUG ?? 'saxony-egypt',
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') args.file = argv[++i];
    else if (a === '--university') args.university = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: ts-node scripts/sis-import.ts --file <students.csv> ' +
          '[--university <slug>] [--dry-run]',
      );
      exit(0);
    }
  }
  if (!args.file) {
    console.error('error: --file <path-to-csv> is required');
    exit(1);
  }
  return args;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    return row;
  });
}

/** Minimal CSV splitter — handles double-quoted fields and embedded commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

interface Row {
  email: string;
  studentId: string;
  name: string;
  sectionName: string;
  faculty?: string;
  year?: number;
  phone?: string;
  password?: string;
}

function normaliseRow(r: Record<string, string>, lineNo: number): Row {
  const required = ['email', 'studentid', 'name', 'sectionname'];
  for (const k of required) {
    if (!r[k]) {
      throw new Error(`row ${lineNo}: missing required column "${k}"`);
    }
  }
  return {
    email: r['email'].toLowerCase(),
    studentId: r['studentid'],
    name: r['name'],
    sectionName: r['sectionname'],
    faculty: r['faculty'] || undefined,
    year: r['year'] ? Number(r['year']) : undefined,
    phone: r['phone'] || undefined,
    password: r['password'] || undefined,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const csvText = readFileSync(args.file, 'utf8');
  const rows = parseCsv(csvText).map((r, i) => normaliseRow(r, i + 2));

  const prisma = new PrismaClient();

  const university = await prisma.university.findUnique({
    where: { slug: args.university },
  });
  if (!university) {
    console.error(
      `error: no university with slug "${args.university}". ` +
        `Run \`pnpm --filter backend run seed\` first.`,
    );
    exit(2);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const sectionCache = new Map<string, string>();

  for (const r of rows) {
    let sectionId = sectionCache.get(r.sectionName);
    if (!sectionId) {
      const existing = await prisma.section.findFirst({
        where: { universityId: university.id, name: r.sectionName },
      });
      if (existing) {
        sectionId = existing.id;
      } else if (!args.dryRun) {
        const s = await prisma.section.create({
          data: {
            universityId: university.id,
            name: r.sectionName,
            studentCount: 0,
          },
        });
        sectionId = s.id;
      }
      if (sectionId) sectionCache.set(r.sectionName, sectionId);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: r.email },
    });

    if (existingUser) {
      // Existing students: refresh section + name only; never overwrite
      // a password that's already in use.
      if (args.dryRun) {
        skipped++;
      } else {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: r.name,
            phone: r.phone,
          },
        });
        await prisma.student.update({
          where: { id: existingUser.id },
          data: {
            sectionId,
            faculty: r.faculty,
            year: r.year,
          },
        });
        updated++;
      }
      continue;
    }

    const passwordHash = await bcrypt.hash(
      r.password ?? `${r.studentId}!2025`,
      12,
    );

    if (args.dryRun) {
      created++;
      continue;
    }

    await prisma.user.create({
      data: {
        universityId: university.id,
        role: UserRole.student,
        name: r.name,
        email: r.email,
        phone: r.phone,
        passwordHash,
        isActive: true,
        student: {
          create: {
            studentId: r.studentId,
            faculty: r.faculty,
            year: r.year,
            sectionId,
          },
        },
      },
    });
    created++;
  }

  console.log(
    `done. created=${created} updated=${updated} skipped=${skipped} ` +
      `dryRun=${args.dryRun}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  exit(1);
});
