import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { AppConfig } from '../../config/app.config';

export interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  /** Base32 secret to render as a QR code on the admin web. */
  qrPayload: string;
}

@Injectable()
export class TwoFactorService {
  private readonly issuer: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.issuer = config.getOrThrow<AppConfig>('app').totpIssuer;
  }

  async setup(userId: string, label: string): Promise<TotpSetupResult> {
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `${this.issuer}:${label}`,
      issuer: this.issuer,
    });

    await this.prisma.adminTwoFactor.upsert({
      where: { userId },
      update: { secret: secret.base32, enabled: false },
      create: { userId, secret: secret.base32, enabled: false },
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url ?? '',
      qrPayload: secret.otpauth_url ?? '',
    };
  }

  async verifyAndEnable(userId: string, code: string): Promise<void> {
    const row = await this.prisma.adminTwoFactor.findUnique({ where: { userId } });
    if (!row) throw new AppException(ErrorCodes.TWO_FA_NOT_SETUP);
    if (!this.verifyCode(row.secret, code)) throw new AppException(ErrorCodes.TWO_FA_INVALID);
    await this.prisma.adminTwoFactor.update({
      where: { userId },
      data: { enabled: true, lastVerifiedAt: new Date() },
    });
  }

  /** Returns true when the user has 2FA enabled. */
  async isEnabled(userId: string): Promise<boolean> {
    const row = await this.prisma.adminTwoFactor.findUnique({ where: { userId } });
    return Boolean(row?.enabled);
  }

  /** Verifies a 6-digit code against the stored secret. Returns true on match. */
  async verifyForLogin(userId: string, code: string | undefined): Promise<boolean> {
    if (!code) return false;
    const row = await this.prisma.adminTwoFactor.findUnique({ where: { userId } });
    if (!row?.enabled) return false;
    const ok = this.verifyCode(row.secret, code);
    if (ok) {
      await this.prisma.adminTwoFactor.update({
        where: { userId },
        data: { lastVerifiedAt: new Date() },
      });
    }
    return ok;
  }

  verifyCode(secret: string, code: string): boolean {
    return speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
  }
}
