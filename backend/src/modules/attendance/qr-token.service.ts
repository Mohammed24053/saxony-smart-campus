import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { QrConfig } from '../../config/qr.config';

export interface QrTokenInputs {
  sessionId: string;
  roomId: string;
  courseId: string;
  intervalSeconds?: number;
}

export interface VerifiedQrToken {
  sessionId: string;
  roomId: string;
  courseId: string;
  timeWindow: number;
  /** Age of the token's time-window in seconds. */
  ageSeconds: number;
}

/**
 * Rotating HMAC-SHA256 QR tokens (TOTP-style).
 *
 *   token = HMAC(secret, `${sessionId}:${roomId}:${courseId}:${floor(now / interval)}`)
 *
 * The full plaintext (`sessionId`, `roomId`, `courseId`, `interval`) is also
 * embedded in the QR payload so the client doesn't need server lookups before
 * scanning. The server then re-derives the HMAC and accepts the current
 * window or the previous one (5-second grace buffer).
 */
@Injectable()
export class QrTokenService {
  private readonly secret: string;
  private readonly defaultInterval: number;

  constructor(config: ConfigService) {
    const cfg = config.getOrThrow<QrConfig>('qr');
    this.secret = cfg.hmacSecret;
    this.defaultInterval = cfg.defaultIntervalSeconds;
  }

  buildPayload(inputs: QrTokenInputs): { token: string; payload: string; expiresAt: Date } {
    const interval = inputs.intervalSeconds ?? this.defaultInterval;
    const tw = this.currentWindow(interval);
    const token = this.hmac(`${inputs.sessionId}:${inputs.roomId}:${inputs.courseId}:${tw}`);
    // Wire format the mobile app reads.
    const payload = JSON.stringify({
      v: 1,
      s: inputs.sessionId,
      r: inputs.roomId,
      c: inputs.courseId,
      i: interval,
      t: token,
    });
    const expiresAt = new Date((tw + 1) * interval * 1000);
    return { token, payload, expiresAt };
  }

  parsePayload(payload: string): QrTokenInputs & { token: string; intervalSeconds: number } {
    const obj = JSON.parse(payload) as {
      v: number;
      s: string;
      r: string;
      c: string;
      i: number;
      t: string;
    };
    if (!obj || obj.v !== 1) throw new Error('unsupported QR version');
    return {
      sessionId: obj.s,
      roomId: obj.r,
      courseId: obj.c,
      intervalSeconds: obj.i,
      token: obj.t,
    };
  }

  /**
   * Returns the verified token data when the HMAC matches the current OR the
   * immediately-previous time window (5-second grace). Returns null otherwise.
   */
  verify(
    parsed: QrTokenInputs & { token: string; intervalSeconds: number },
  ): VerifiedQrToken | null {
    const interval = parsed.intervalSeconds ?? this.defaultInterval;
    const now = this.currentWindow(interval);
    for (const tw of [now, now - 1]) {
      const expected = this.hmac(`${parsed.sessionId}:${parsed.roomId}:${parsed.courseId}:${tw}`);
      if (timingSafeEqual(expected, parsed.token)) {
        const ageSeconds = (Date.now() - tw * interval * 1000) / 1000;
        return {
          sessionId: parsed.sessionId,
          roomId: parsed.roomId,
          courseId: parsed.courseId,
          timeWindow: tw,
          ageSeconds,
        };
      }
    }
    return null;
  }

  private currentWindow(interval: number): number {
    return Math.floor(Date.now() / (interval * 1000));
  }

  private hmac(data: string): string {
    return crypto.createHmac('sha256', this.secret).update(data).digest('hex');
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}
