import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  apiPrefix: string;
  adminWebOrigin: string;
  logLevel: string;
  initialAdminEmail: string;
  initialAdminPassword: string;
  totpIssuer: string;
}

export default registerAs('app', (): AppConfig => {
  const nodeEnv = (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development';
  // Refuse to ship the well-known default admin credential in production.
  // The previous `ChangeMe!2025` fallback was committed to the public repo,
  // so every fresh install that forgot to override it had a known password.
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD ?? '';
  if (nodeEnv === 'production' && initialAdminPassword.length < 12) {
    throw new Error('INITIAL_ADMIN_PASSWORD must be set to at least 12 characters in production.');
  }
  return {
    nodeEnv,
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    adminWebOrigin: process.env.ADMIN_WEB_ORIGIN ?? 'http://localhost:3001',
    logLevel: process.env.LOG_LEVEL ?? 'debug',
    initialAdminEmail: process.env.INITIAL_ADMIN_EMAIL ?? 'admin@saxony-egypt.edu',
    initialAdminPassword,
    totpIssuer: process.env.ADMIN_TOTP_ISSUER ?? 'SaxonyEgypt',
  };
});
