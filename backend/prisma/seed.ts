/* eslint-disable no-console */
import { PrismaClient, RoomType, SubjectType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? 'admin@saxony-egypt.edu';
  // Public default removed (CWE-798). Operators must supply the password
  // explicitly; if absent we mint a strong random one and print it once so
  // the human can reset via the password-reset flow.
  let adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  let generatedPassword = false;
  if (!adminPassword || adminPassword.length < 12) {
    const buf = await import('crypto').then((m) => m.randomBytes(24));
    adminPassword = buf.toString('base64url');
    generatedPassword = true;
    console.log(
      `! INITIAL_ADMIN_PASSWORD not set — generated one-time password (visible ONLY in this log): ${adminPassword}`,
    );
  }
  const universityName = process.env.INITIAL_UNIVERSITY_NAME ?? 'Saxony Egypt University';
  const universitySlug = process.env.INITIAL_UNIVERSITY_SLUG ?? 'saxony-egypt';

  console.log('Seeding…');

  let university = await prisma.university.findUnique({ where: { slug: universitySlug } });
  if (!university) {
    university = await prisma.university.create({
      data: {
        name: universityName,
        slug: universitySlug,
        settings: { timezone: 'Africa/Cairo', locale: 'en' },
      },
    });
    console.log(`+ University created: ${university.name}`);
  }

  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        universityId: university.id,
        role: 'admin',
        name: 'Default Admin',
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        isActive: true,
      },
    });
    console.log(`+ Admin user created: ${admin.email}`);
  }

  // Demo room (idempotent).
  const demoRoom = await prisma.room.findFirst({
    where: { universityId: university.id, name: 'Lecture Hall A' },
  });
  if (!demoRoom) {
    await prisma.room.create({
      data: {
        universityId: university.id,
        name: 'Lecture Hall A',
        type: RoomType.lecture,
        capacity: 60,
        latitude: 30.0444,
        longitude: 31.2357,
        gpsRadius: 50,
        gpsEnabled: true,
        building: 'Main Building',
        floor: 1,
        qrCodeStatic: 'demo-static-code-001',
      },
    });
  }

  // Demo subject.
  const demoSubject = await prisma.subject
    .findUnique({ where: { code: 'CS101' } })
    .catch(() => null);
  if (!demoSubject) {
    await prisma.subject.create({
      data: {
        universityId: university.id,
        code: 'CS101',
        name: 'Introduction to Computer Science',
        type: SubjectType.theory,
        hoursPerWeek: 4,
        maxRoomCapacity: 60,
      },
    });
  }

  console.log(
    `Done. Admin: ${adminEmail}  Password: ${generatedPassword ? '(generated above)' : '(env)'}  University: ${universitySlug}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
