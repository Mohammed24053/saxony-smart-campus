import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';

export interface StudentRow {
  id: string;
  studentId: string;
  name: string;
  email: string | null;
  phone: string | null;
  faculty: string | null;
  year: number | null;
  sectionId: string | null;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    universityId: string,
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<Paginated<StudentRow>> {
    const where: Prisma.UserWhereInput = {
      universityId,
      role: 'student',
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { student: { is: { studentId: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { student: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const data: StudentRow[] = rows.map((u) => ({
      id: u.id,
      studentId: u.student?.studentId ?? '',
      name: u.name,
      email: u.email,
      phone: u.phone,
      faculty: u.student?.faculty ?? null,
      year: u.student?.year ?? null,
      sectionId: u.student?.sectionId ?? null,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));

    return paginate(data, total, page, pageSize);
  }

  async create(universityId: string, dto: CreateStudentDto): Promise<StudentRow> {
    const existing = await this.prisma.student.findUnique({ where: { studentId: dto.studentId } });
    if (existing)
      throw new AppException(ErrorCodes.CONFLICT, { message: 'studentId already exists' });
    if (dto.email) {
      const e = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (e) throw new AppException(ErrorCodes.CONFLICT, { message: 'email already exists' });
    }

    const password = dto.password ?? this.tempPassword(dto.studentId);
    const passwordHash = await bcrypt.hash(password, 10);

    const created = await this.prisma.user.create({
      data: {
        universityId,
        role: 'student',
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        passwordHash,
        isActive: dto.isActive ?? true,
        student: {
          create: {
            studentId: dto.studentId,
            faculty: dto.faculty ?? null,
            year: dto.year ?? null,
            sectionId: dto.sectionId ?? null,
          },
        },
      },
      include: { student: true },
    });

    return this.shape(created);
  }

  async findById(universityId: string, id: string): Promise<StudentRow> {
    const u = await this.prisma.user.findFirst({
      where: { id, universityId, role: 'student', deletedAt: null },
      include: { student: true },
    });
    if (!u) throw new AppException(ErrorCodes.NOT_FOUND);
    return this.shape(u);
  }

  async update(universityId: string, id: string, dto: UpdateStudentDto): Promise<StudentRow> {
    await this.findById(universityId, id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
        student: {
          update: {
            ...(dto.studentId !== undefined ? { studentId: dto.studentId } : {}),
            ...(dto.faculty !== undefined ? { faculty: dto.faculty } : {}),
            ...(dto.year !== undefined ? { year: dto.year } : {}),
            ...(dto.sectionId !== undefined ? { sectionId: dto.sectionId } : {}),
          },
        },
      },
      include: { student: true },
    });
    return this.shape(updated);
  }

  async softDelete(universityId: string, id: string): Promise<void> {
    await this.findById(universityId, id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /**
   * Used by the import pipeline to upsert in bulk. Creates the User+Student
   * if missing; updates basic fields when present.
   */
  async upsertBulk(
    universityId: string,
    rows: CreateStudentDto[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const existing = await this.prisma.student.findUnique({
          where: { studentId: row.studentId },
          include: { user: true },
        });
        if (existing) {
          if (existing.user.universityId !== universityId) {
            skipped++;
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          await this.update(universityId, existing.id, row);
          updated++;
        } else {
          // eslint-disable-next-line no-await-in-loop
          await this.create(universityId, row);
          created++;
        }
      } catch {
        skipped++;
      }
    }
    return { created, updated, skipped };
  }

  private tempPassword(studentId: string): string {
    return `${studentId}!Pass`;
  }

  private shape(u: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    createdAt: Date;
    student: {
      studentId: string;
      faculty: string | null;
      year: number | null;
      sectionId: string | null;
    } | null;
  }): StudentRow {
    return {
      id: u.id,
      studentId: u.student?.studentId ?? '',
      name: u.name,
      email: u.email,
      phone: u.phone,
      faculty: u.student?.faculty ?? null,
      year: u.student?.year ?? null,
      sectionId: u.student?.sectionId ?? null,
      isActive: u.isActive,
      createdAt: u.createdAt,
    };
  }
}
