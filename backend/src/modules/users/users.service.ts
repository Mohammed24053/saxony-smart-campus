import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  password?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    universityId: string,
    page: number,
    pageSize: number,
    filters: { search?: string; role?: UserRole } = {},
  ): Promise<Paginated<unknown>> {
    const where: Prisma.UserWhereInput = {
      universityId,
      deletedAt: null,
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(rows, total, page, pageSize);
  }

  async create(universityId: string, actorId: string, input: CreateUserInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing)
      throw new AppException(ErrorCodes.VALIDATION_ERROR, { message: 'Email already in use' });
    const password = input.password ?? this.generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        universityId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        passwordHash,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    await this.audit.record({
      universityId,
      actorId,
      action: 'user.create',
      entity: 'User',
      entityId: user.id,
      after: user,
    });
    return { ...user, temporaryPassword: input.password ? undefined : password };
  }

  async update(universityId: string, actorId: string, id: string, input: UpdateUserInput) {
    const before = await this.prisma.user.findFirst({
      where: { id, universityId, deletedAt: null },
    });
    if (!before) throw new AppException(ErrorCodes.NOT_FOUND);
    if (input.email && input.email !== before.email) {
      const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (exists)
        throw new AppException(ErrorCodes.VALIDATION_ERROR, { message: 'Email already in use' });
    }
    const after = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    await this.audit.record({
      universityId,
      actorId,
      action: 'user.update',
      entity: 'User',
      entityId: id,
      before: {
        name: before.name,
        email: before.email,
        phone: before.phone,
        isActive: before.isActive,
      },
      after,
    });
    return after;
  }

  async remove(universityId: string, actorId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, universityId, deletedAt: null } });
    if (!user) throw new AppException(ErrorCodes.NOT_FOUND);
    if (user.id === actorId)
      throw new AppException(ErrorCodes.VALIDATION_ERROR, { message: 'Cannot delete yourself' });
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.record({
      universityId,
      actorId,
      action: 'user.delete',
      entity: 'User',
      entityId: id,
      before: { name: user.name, email: user.email },
    });
  }

  async resetPassword(universityId: string, actorId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, universityId, deletedAt: null } });
    if (!user) throw new AppException(ErrorCodes.NOT_FOUND);
    const password = this.generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.audit.record({
      universityId,
      actorId,
      action: 'user.reset_password',
      entity: 'User',
      entityId: id,
    });
    return { temporaryPassword: password };
  }

  private generatePassword(): string {
    const buf = crypto.randomBytes(8).toString('base64url');
    return `Tmp-${buf}`;
  }
}
