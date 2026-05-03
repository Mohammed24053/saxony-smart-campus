import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';

export interface DoctorRow {
  id: string;
  doctorId: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  availability: Record<string, unknown>;
  createdAt: Date;
}

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    universityId: string,
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<Paginated<DoctorRow>> {
    const where: Prisma.UserWhereInput = {
      universityId,
      role: 'doctor',
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { doctor: { is: { doctorId: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { doctor: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(rows.map((u) => this.shape(u)), total, page, pageSize);
  }

  async create(universityId: string, dto: CreateDoctorDto): Promise<DoctorRow> {
    const existing = await this.prisma.doctor.findUnique({ where: { doctorId: dto.doctorId } });
    if (existing) throw new AppException(ErrorCodes.CONFLICT, { message: 'doctorId already exists' });
    if (dto.email) {
      const e = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (e) throw new AppException(ErrorCodes.CONFLICT, { message: 'email already exists' });
    }
    const password = dto.password ?? `${dto.doctorId}!Pass`;
    const passwordHash = await bcrypt.hash(password, 10);

    const created = await this.prisma.user.create({
      data: {
        universityId,
        role: 'doctor',
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        passwordHash,
        isActive: dto.isActive ?? true,
        doctor: {
          create: {
            doctorId: dto.doctorId,
            availability: (dto.availability ?? {}) as Prisma.InputJsonValue,
          },
        },
      },
      include: { doctor: true },
    });
    return this.shape(created);
  }

  async findById(universityId: string, id: string): Promise<DoctorRow> {
    const u = await this.prisma.user.findFirst({
      where: { id, universityId, role: 'doctor', deletedAt: null },
      include: { doctor: true },
    });
    if (!u) throw new AppException(ErrorCodes.NOT_FOUND);
    return this.shape(u);
  }

  async update(universityId: string, id: string, dto: UpdateDoctorDto): Promise<DoctorRow> {
    await this.findById(universityId, id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
        doctor: {
          update: {
            ...(dto.doctorId !== undefined ? { doctorId: dto.doctorId } : {}),
            ...(dto.availability !== undefined
              ? { availability: dto.availability as Prisma.InputJsonValue }
              : {}),
          },
        },
      },
      include: { doctor: true },
    });
    return this.shape(updated);
  }

  async updateAvailability(
    universityId: string,
    id: string,
    availability: Record<string, string[]>,
  ): Promise<DoctorRow> {
    await this.findById(universityId, id);
    await this.prisma.doctor.update({
      where: { id },
      data: { availability: availability as Prisma.InputJsonValue },
    });
    return this.findById(universityId, id);
  }

  async softDelete(universityId: string, id: string): Promise<void> {
    await this.findById(universityId, id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private shape(u: {
    id: string; name: string; email: string | null; phone: string | null;
    isActive: boolean; createdAt: Date;
    doctor: { doctorId: string; availability: unknown } | null;
  }): DoctorRow {
    return {
      id: u.id,
      doctorId: u.doctor?.doctorId ?? '',
      name: u.name,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      availability: (u.doctor?.availability ?? {}) as Record<string, unknown>,
      createdAt: u.createdAt,
    };
  }
}
