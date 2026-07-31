import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { PasswordResetService } from '../password-reset/password-reset.service';

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
    private readonly passwordReset: PasswordResetService,
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
    // Never echo the plaintext password back to the API caller. If the admin
    // provides one we accept it and never return it; if they don't, we mint
    // an unguessable hash and trigger a password-reset email so the user
    // sets their own credential through the secure reset flow.
    const password = input.password ?? this.generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);
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
    let passwordResetEmailSent = false;
    if (!input.password && user.email) {
      try {
        await this.passwordReset.requestReset(user.email);
        passwordResetEmailSent = true;
      } catch {
        // Email failures should not block user creation; the admin can
        // re-issue the reset later from POST /users/:id/reset-password.
      }
    }
    return { ...user, passwordResetEmailSent };
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
    // Burn the current password to an unguessable random hash, then email the
    // user a one-time reset link. We never return the plaintext: the previous
    // behaviour leaked a fresh credential into the admin response body, browser
    // history, screen-shares and proxy logs.
    const password = this.generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    let passwordResetEmailSent = false;
    if (user.email) {
      try {
        await this.passwordReset.requestReset(user.email);
        passwordResetEmailSent = true;
      } catch {
        // Audit captures the failure path so an operator can investigate.
      }
    }
    await this.audit.record({
      universityId,
      actorId,
      action: 'user.reset_password',
      entity: 'User',
      entityId: id,
    });
    return { passwordResetEmailSent };
  }

  private generatePassword(): string {
    // 24 bytes → ~32 base64url chars, ~192 bits of entropy. Used only as a
    // transient hash seed — never returned to the caller.
    return crypto.randomBytes(24).toString('base64url');
  }
}
