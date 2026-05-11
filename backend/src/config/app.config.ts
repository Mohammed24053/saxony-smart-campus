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

export default registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    adminWebOrigin: process.env.ADMIN_WEB_ORIGIN ?? 'http://localhost:3001',
    logLevel: process.env.LOG_LEVEL ?? 'debug',
    initialAdminEmail: process.env.INITIAL_ADMIN_EMAIL ?? 'admin@saxony-egypt.edu',
    initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD ?? 'ChangeMe!2025',
    totpIssuer: process.env.ADMIN_TOTP_ISSUER ?? 'SaxonyEgypt',
  }),
);
