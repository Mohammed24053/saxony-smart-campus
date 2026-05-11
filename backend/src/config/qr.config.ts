import { registerAs } from '@nestjs/config';

export interface QrConfig {
  hmacSecret: string;
  defaultIntervalSeconds: number;
}

/**
 * The QR HMAC secret authorises every rotating attendance token. If the
 * operator forgets to set it, the previous behaviour silently used the empty
 * string — making every token derivable by anyone who knows the (public)
 * payload format. Refuse to start outside of NODE_ENV=test.
 */
export default registerAs('qr', (): QrConfig => {
  const hmacSecret = process.env.QR_HMAC_SECRET ?? '';
  if (process.env.NODE_ENV !== 'test' && hmacSecret.length < 32) {
    throw new Error('QR_HMAC_SECRET must be set to at least 32 characters of high-entropy data.');
  }
  return {
    hmacSecret,
    defaultIntervalSeconds: parseInt(process.env.QR_DEFAULT_INTERVAL_SECONDS ?? '30', 10),
  };
});
