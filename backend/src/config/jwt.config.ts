import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  algorithm: 'RS256';
  accessPrivateKey: string;
  accessPublicKey: string;
  refreshSecret: string;
  accessExpires: string;
  refreshExpires: string;
}

/**
 * .env files cannot store newlines in PEM blocks; we accept either the literal
 * key (with real newlines) or the escaped form (with `\n`). normalize() turns
 * both into a real PEM string.
 */
function normalize(key: string | undefined): string {
  if (!key) return '';
  return key.replace(/\\n/g, '\n').trim();
}

export default registerAs(
  'jwt',
  (): JwtConfig => ({
    algorithm: 'RS256',
    accessPrivateKey: normalize(process.env.JWT_ACCESS_PRIVATE_KEY),
    accessPublicKey: normalize(process.env.JWT_ACCESS_PUBLIC_KEY),
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  }),
);
