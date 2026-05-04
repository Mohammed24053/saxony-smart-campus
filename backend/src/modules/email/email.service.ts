import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * SMTP email sender. Mirrors the FcmService pattern: when SMTP credentials are
 * not configured (local dev / CI), all sends become no-ops and are logged at
 * debug level. The rest of the system stays fully functional.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: nodemailer.Transporter;
  private readonly enabled: boolean;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    this.fromAddress = this.config.get<string>('SMTP_FROM') ?? 'no-reply@smart-campus.local';
    this.enabled = Boolean(host && user && pass);
    if (!this.enabled) {
      this.logger.warn('Email disabled — SMTP credentials not configured (dev/test mode)');
      return;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: { user, pass },
    });
    this.logger.log(`SMTP initialized via ${host}`);
  }

  async send(msg: EmailMessage): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      this.logger.debug(`[email stub] → ${msg.to} :: ${msg.subject}`);
      return true;
    }
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html ?? `<pre style="font-family:Inter,system-ui,sans-serif">${escapeHtml(msg.text)}</pre>`,
      });
      return true;
    } catch (err) {
      this.logger.warn(`Email send failed: ${(err as Error).message}`);
      return false;
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
