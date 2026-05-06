import { registerAs } from '@nestjs/config';

export interface QrConfig {
  hmacSecret: string;
  defaultIntervalSeconds: number;
}

export default registerAs(
  'qr',
  (): QrConfig => ({
    hmacSecret: process.env.QR_HMAC_SECRET ?? '',
    defaultIntervalSeconds: parseInt(process.env.QR_DEFAULT_INTERVAL_SECONDS ?? '30', 10),
  }),
);
