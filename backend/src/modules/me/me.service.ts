import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { TokenService } from '../auth/token.service';
import { AuditService } from '../audit/audit.service';

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
}

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        university: { select: { id: true, name: true, slug: true, settings: true } },
        student: { select: { studentId: true, faculty: true, year: true, sectionId: true } },
        doctor: { select: { doctorId: true, availability: true } },
        twoFactor: { select: { enabled: true, lastVerifiedAt: true } },
      },
    });
    if (!user) throw new AppException(ErrorCodes.NOT_FOUND);
    const { passwordHash, fcmToken, ...safe } = user;
    void passwordHash;
    void fcmToken;
    return safe;
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
    meta: { ip?: string; ua?: string } = {},
  ) {
    const before = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!before) throw new AppException(ErrorCodes.NOT_FOUND);
    const data: { name?: string; phone?: string | null } = {};
    if (typeof input.name === 'string' && input.name.trim().length > 0)
      data.name = input.name.trim();
    if (typeof input.phone === 'string')
      data.phone = input.phone.trim() === '' ? null : input.phone.trim();
    const after = await this.prisma.user.update({ where: { id: userId }, data });
    await this.audit.record({
      universityId: after.universityId,
      actorId: userId,
      actorRole: after.role,
      action: 'me.profile_updated',
      entity: 'User',
      entityId: userId,
      before: { name: before.name, phone: before.phone },
      after: { name: after.name, phone: after.phone },
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });
    return this.getProfile(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta: { ip?: string; ua?: string } = {},
  ) {
    if (newPassword.length < 8)
      throw new AppException(ErrorCodes.VALIDATION_ERROR, {
        message: 'Password must be at least 8 characters',
      });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(ErrorCodes.NOT_FOUND);
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok)
      throw new AppException(ErrorCodes.UNAUTHORIZED, { message: 'Current password incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.tokens.revokeAllForUser(userId);
    await this.audit.record({
      universityId: user.universityId,
      actorId: userId,
      actorRole: user.role,
      action: 'me.password_changed',
      entity: 'User',
      entityId: userId,
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });
  }

  async listSessions(userId: string) {
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
        familyId: true,
      },
    });
    return rows;
  }

  async revokeAllOtherSessions(userId: string) {
    await this.tokens.revokeAllForUser(userId);
  }

  async registerPushToken(userId: string, token: string, platform: 'ios' | 'android' | 'web') {
    // Anti-hijack: PushToken.token is `@unique`, so a naive upsert would let
    // attacker A claim victim B's known FCM token and silently take over the
    // delivery target. Only allow registration if the token is unbound or
    // already belongs to the same user.
    const existing = await this.prisma.pushToken.findUnique({ where: { token } });
    if (existing && existing.userId !== userId) {
      throw new AppException(ErrorCodes.FORBIDDEN);
    }
    if (existing) {
      await this.prisma.pushToken.update({
        where: { token },
        data: { platform, lastSeenAt: new Date() },
      });
      return;
    }
    await this.prisma.pushToken.create({ data: { userId, token, platform } });
  }

  async unregisterPushToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }
}
