import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { EmailService } from '../email/email.service';
import { TokenService } from '../auth/token.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PasswordResetService {
  private readonly tokenTtlMinutes = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Always returns success — we never reveal whether the email exists.
   * If a matching active user is found, a one-time token is emailed.
   */
  async requestReset(email: string, meta: { ip?: string; ua?: string } = {}): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || user.deletedAt) return;

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + this.tokenTtlMinutes * 60_000);
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const baseUrl = this.config.get<string>('ADMIN_APP_URL') ?? 'http://localhost:3001';
    const link = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.email.send({
      to: user.email!,
      subject: 'Reset your Saxony Smart Campus password',
      text: [
        `Hi ${user.name},`,
        '',
        `Use the link below to reset your password. It expires in ${this.tokenTtlMinutes} minutes.`,
        '',
        link,
        '',
        'If you did not request this, you can safely ignore this email.',
      ].join('\n'),
    });

    await this.audit.record({
      universityId: user.universityId,
      actorId: user.id,
      actorRole: user.role,
      action: 'password_reset.requested',
      entity: 'User',
      entityId: user.id,
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });
  }

  /** Validates the token and applies the new password. */
  async confirmReset(
    token: string,
    newPassword: string,
    meta: { ip?: string; ua?: string } = {},
  ): Promise<void> {
    if (newPassword.length < 8)
      throw new AppException(ErrorCodes.VALIDATION_ERROR, {
        message: 'Password must be at least 8 characters',
      });

    const candidates = await this.prisma.passwordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    let matched = null;
    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(token, c.tokenHash)) {
        matched = c;
        break;
      }
    }
    if (!matched) throw new AppException(ErrorCodes.TOKEN_INVALID);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: matched.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: matched.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Revoke all existing refresh tokens — force re-login on every device.
    await this.tokens.revokeAllForUser(matched.userId);

    await this.audit.record({
      universityId: matched.user.universityId,
      actorId: matched.userId,
      actorRole: matched.user.role,
      action: 'password_reset.completed',
      entity: 'User',
      entityId: matched.userId,
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });
  }
}
