import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { FirebaseConfig } from '../../config/firebase.config';

export interface FcmMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Thin wrapper around firebase-admin. When credentials are not configured
 * (local dev / CI), all sends become no-ops and are logged. This keeps the
 * rest of the system fully functional without Firebase set up.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private app?: admin.app.App;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    const cfg = config.getOrThrow<FirebaseConfig>('firebase');
    this.enabled = cfg.enabled;
    if (!this.enabled) {
      this.logger.warn('FCM disabled — Firebase credentials not configured');
      return;
    }
    try {
      this.app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.cert({
              projectId: cfg.projectId,
              clientEmail: cfg.clientEmail,
              privateKey: cfg.privateKey,
            }),
          });
      this.logger.log(`FCM initialized for project ${cfg.projectId}`);
    } catch (err) {
      this.logger.error(`Failed to initialize FCM: ${(err as Error).message}`);
    }
  }

  async send(token: string | null | undefined, msg: FcmMessage): Promise<boolean> {
    if (!token) return false;
    if (!this.enabled || !this.app) {
      this.logger.debug(`[FCM stub] → ${token.slice(0, 8)}…  ${msg.title} :: ${msg.body}`);
      return true;
    }
    try {
      await this.app.messaging().send({
        token,
        notification: { title: msg.title, body: msg.body },
        data: msg.data,
      });
      return true;
    } catch (err) {
      this.logger.warn(`FCM send failed: ${(err as Error).message}`);
      return false;
    }
  }

  async sendToMany(tokens: (string | null | undefined)[], msg: FcmMessage): Promise<number> {
    const valid = tokens.filter((t): t is string => Boolean(t));
    if (valid.length === 0) return 0;
    if (!this.enabled || !this.app) {
      valid.forEach((t) => this.logger.debug(`[FCM stub] → ${t.slice(0, 8)}…  ${msg.title}`));
      return valid.length;
    }
    try {
      const res = await this.app.messaging().sendEachForMulticast({
        tokens: valid,
        notification: { title: msg.title, body: msg.body },
        data: msg.data,
      });
      return res.successCount;
    } catch (err) {
      this.logger.warn(`FCM multicast failed: ${(err as Error).message}`);
      return 0;
    }
  }
}
